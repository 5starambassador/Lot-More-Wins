import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { BillRecord } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, IconMark, Notice, Panel, Txt } from '../ui';
import { Breakdown } from './AmountStep';
import apiClient, { describeError, isAuthError } from '../../lib/api';
import { formatDateTime, notificationBadge } from '../../lib/format';
import { space } from '../../theme/tokens';

/** Message delivery for a bill, with a resend action. Used after billing and in history. */
export function NotificationPanel({
  bill,
  onUpdated,
  onSignedOut,
}: {
  bill: BillRecord;
  onUpdated: (bill: BillRecord) => void;
  onSignedOut?: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = bill.notification;
  const badge = notificationBadge(n);
  const who = bill.transactionType === 'DIRECT_PARTNER' ? 'partner' : 'customer';

  const resend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await apiClient.resendBillNotification(bill.id);
      Haptics.notificationAsync(
        res.data.notification.status === 'SENT' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
      onUpdated(res.data);
    } catch (err) {
      if (isAuthError(err)) return onSignedOut?.();
      setError(describeError(err, 'Could not resend the message'));
    } finally {
      setSending(false);
    }
  };

  const detail =
    n.status === 'SENT'
      ? `Bill, points and app download link sent to the ${who}${n.recipient ? ` (${n.recipient})` : ''}.`
      : n.status === 'PENDING'
        ? 'The message is being sent.'
        : n.error ?? `The bill message did not reach the ${who}.`;

  return (
    <Panel style={styles.section}>
      <View style={styles.head}>
        <Txt variant="bodyMedium">Bill message</Txt>
        <Badge label={badge.label} tone={badge.tone} icon={n.channel === 'whatsapp' ? 'logo-whatsapp' : 'mail-outline'} />
      </View>
      <Txt variant="small" tone="secondary" style={styles.detail}>
        {detail}
      </Txt>
      {n.sentAt && (
        <Txt variant="caption" tone="muted">
          Sent {formatDateTime(n.sentAt)}
        </Txt>
      )}
      {error && <Notice tone="error" message={error} style={styles.error} />}
      {n.status !== 'PENDING' && (
        <Button
          label={n.status === 'SENT' ? 'Send again' : 'Retry sending'}
          variant="secondary"
          compact
          onPress={resend}
          loading={sending}
          style={styles.resend}
        />
      )}
    </Panel>
  );
}

export function BillDone({
  bill: initialBill,
  replayed,
  onNext,
  onSignedOut,
}: {
  bill: BillRecord;
  replayed: boolean;
  onNext: () => void;
  onSignedOut: () => void;
}) {
  const [bill, setBill] = useState(initialBill);
  const partner = bill.partner ?? bill.referrerPartner;

  return (
    <View>
      <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
        <IconMark name="checkmark" size={68} tone="success" />
        <Txt variant="title" align="center" style={styles.heroTitle}>
          Bill completed
        </Txt>
        <Txt variant="mono" tone="muted">
          {bill.billNumber}
        </Txt>
      </Animated.View>

      {replayed && <Notice tone="info" message="This bill had already been completed. Showing the saved record." />}

      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Panel style={styles.section}>
          <Txt variant="bodyMedium">
            {bill.customer ? `${bill.customer.name} · +91 ${bill.customer.mobile}` : `${partner?.name ?? 'Partner'} (partner)`}
          </Txt>
          {bill.customer && partner ? (
            <Txt variant="caption" tone="muted" style={styles.referred}>
              Referred by {partner.name}
            </Txt>
          ) : (
            <View style={styles.referred} />
          )}
          <Breakdown calc={bill} partnerName={partner?.name ?? 'the partner'} />
        </Panel>

        <NotificationPanel bill={bill} onUpdated={setBill} onSignedOut={onSignedOut} />

        <Button label="Scan next customer" onPress={onNext} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.md, paddingBottom: space.xl },
  heroTitle: { marginTop: space.md },
  section: { marginBottom: space.lg },
  referred: { marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  detail: { marginTop: space.xs },
  error: { marginTop: space.sm, marginBottom: 0 },
  resend: { marginTop: space.md, alignSelf: 'flex-start' },
});
