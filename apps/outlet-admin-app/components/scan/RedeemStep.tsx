import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiClientError } from '@lotmorewins/api-client';
import type { RedeemScanResult, RedemptionReceipt } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, Divider, Field, IconMark, InfoRow, Notice, Panel, Txt } from '../ui';
import apiClient, { describeError, errorCode, isAuthError } from '../../lib/api';
import { formatINR, formatPoints } from '../../lib/format';
import { fonts, space } from '../../theme/tokens';

/** Staff-facing text for the redemption failures the server reports. */
function redeemError(err: unknown): string {
  switch (errorCode(err)) {
    case 'REDEEM_QR_INVALID':
      return 'This redeem QR has expired or is not valid. Ask the partner to generate a new one in their wallet.';
    case 'REDEEM_QR_USED':
      return 'This redeem QR has already been used. Ask the partner to generate a new one in their wallet.';
    case 'INSUFFICIENT_POINTS':
      return 'The partner does not have enough points for this amount. The balance below has been refreshed.';
    case 'PARTNER_INACTIVE':
      return 'This partner account is not active, so points cannot be redeemed.';
    case 'OUTLET_INACTIVE':
      return 'This outlet is inactive. Redemptions are disabled until the Super Admin reactivates it.';
    case 'SETTINGS_NOT_CONFIGURED':
      return 'Programme settings have not been configured by the Super Admin yet. Redemption is unavailable.';
    default:
      return describeError(err, 'Could not redeem the points');
  }
}

/**
 * Wallet redemption: the partner and live balance come from the server; the admin enters the
 * rupee amount to take off the bill and the server converts it to points and debits the wallet.
 */
export function RedeemStep({
  qrCode,
  scan,
  onCompleted,
  onCancel,
  onSignedOut,
}: {
  qrCode: string;
  scan: RedeemScanResult;
  onCompleted: (receipt: RedemptionReceipt) => void;
  onCancel: () => void;
  onSignedOut: () => void;
}) {
  const { partner, pointsRatio } = scan;
  // Refreshed from the server when a redemption is refused for insufficient points.
  const [balance, setBalance] = useState({ points: scan.balancePoints, rupees: scan.rupeeValue });
  const [amountText, setAmountText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The QR is dead (expired / used): only a fresh scan can continue.
  const [dead, setDead] = useState(false);

  const amount = Number(amountText);
  const hasAmount = amountText !== '' && Number.isFinite(amount);
  const amountError = !hasAmount
    ? null
    : amount <= 0
      ? 'Enter an amount greater than 0'
      : !/^\d+(\.\d{1,2})?$/.test(amountText)
        ? 'Amount can have at most 2 decimal places'
        : amount > balance.rupees
          ? `The wallet is worth ${formatINR(balance.rupees)} at most`
          : null;
  const valid = hasAmount && !amountError;
  const points = valid ? Math.round(((amount * pointsRatio.points) / pointsRatio.rupees) * 100) / 100 : 0;

  const confirm = async () => {
    if (!valid || submitting || dead) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.redeemPoints({ qrCode, rupees: amount });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCompleted(res.data);
    } catch (err) {
      if (isAuthError(err)) return onSignedOut();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const code = errorCode(err);
      if (code === 'INSUFFICIENT_POINTS' && err instanceof ApiClientError) {
        const details = err.details as { balancePoints?: number; rupeeValue?: number } | undefined;
        if (typeof details?.balancePoints === 'number' && typeof details?.rupeeValue === 'number') {
          setBalance({ points: details.balancePoints, rupees: details.rupeeValue });
        }
      }
      if (code === 'REDEEM_QR_INVALID' || code === 'REDEEM_QR_USED') setDead(true);
      // Network failures can be retried: the redeem QR works once, so a retry replays the result.
      setError(redeemError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <Panel style={styles.card}>
        <View style={styles.head}>
          <IconMark name="wallet-outline" />
          <View style={styles.flex}>
            <Txt variant="overline" tone="gold">
              Wallet redeem code of
            </Txt>
            <Txt variant="heading" numberOfLines={1}>
              {partner.name}
            </Txt>
          </View>
          <Badge label="Redeem QR" />
        </View>
        <View style={styles.details}>
          <InfoRow label="Mobile" value={`+91 ${partner.mobile}`} />
          <InfoRow label="Partner code" value={partner.partnerCode} />
        </View>
        <Divider />
        <View style={styles.balance}>
          <InfoRow label="Points balance" value={formatPoints(balance.points)} />
          <InfoRow label="Worth" value={formatINR(balance.rupees)} strong tone="gold" />
          <Txt variant="caption" tone="muted">
            {pointsRatio.points} pts = ₹{pointsRatio.rupees}
          </Txt>
        </View>
      </Panel>

      <Field
        label="Amount to redeem"
        prefix="₹"
        value={amountText}
        onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        error={amountError}
        keyboardType="decimal-pad"
        placeholder="0.00"
        editable={!submitting && !dead}
        autoFocus
        style={styles.amountInput}
        hint={valid ? `Uses ${formatPoints(points)} from the wallet` : 'This amount is taken off the customer’s bill and debited from the wallet as points.'}
        accessory={
          <Button
            label="Full value"
            variant="ghost"
            compact
            onPress={() => setAmountText(balance.rupees.toFixed(2))}
            disabled={submitting || dead || balance.rupees <= 0}
          />
        }
      />

      {error && <Notice tone="error" message={error} onDismiss={dead ? undefined : () => setError(null)} />}

      {dead ? (
        <Button label="Scan again" onPress={onCancel} />
      ) : (
        <>
          <Button
            label={valid ? `Redeem ${formatINR(amount)} · ${formatPoints(points)}` : 'Redeem points'}
            onPress={confirm}
            loading={submitting}
            disabled={!valid}
          />
          <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={submitting} style={styles.cancel} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginBottom: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  details: { marginTop: space.md, marginBottom: space.sm },
  balance: { paddingTop: space.sm },
  amountInput: { fontFamily: fonts.semibold, fontSize: 24, height: 60 },
  cancel: { marginTop: space.xs },
});
