import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ApiClientError } from '@lotmorewins/api-client';
import { billAmountSchema } from '@lotmorewins/validation';
import type { BillCalculation, BillRecord, ReferredCustomerInput, ScanResult } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Button, Divider, Field, IconMark, InfoRow, Notice, Panel, Txt } from '../ui';
import apiClient, { describeError, errorCode, isAuthError } from '../../lib/api';
import { birthdayBonusLabel, referralRewardLabel, formatINR, formatPercent, formatPoints, newIdempotencyKey, purchaseRecipientLabel } from '../../lib/format';
import { colors, fonts, space } from '../../theme/tokens';

const PREVIEW_DEBOUNCE_MS = 450;

function PointsLine({ title, hint, points }: { title: string; hint: string; points: number }) {
  return (
    <View style={styles.pointsLine}>
      <View style={styles.flex}>
        <Txt variant="bodyMedium">{title}</Txt>
        <Txt variant="caption" tone="secondary" numberOfLines={2}>
          {hint}
        </Txt>
      </View>
      <Txt variant="heading" tone="gold">
        +{formatPoints(points)}
      </Txt>
    </View>
  );
}

/** Server-calculated breakdown. Every figure comes from the Super Admin settings via the server. */
export function Breakdown({ calc, partnerName }: { calc: BillCalculation | BillRecord; partnerName: string }) {
  const isReferral = calc.transactionType === 'REFERRAL';
  const bonus = birthdayBonusLabel(calc.birthdayBonusPercentage);
  const reward = referralRewardLabel(calc.referralRewardPercentage);
  return (
    <View>
      <InfoRow label="Bill amount" value={formatINR(calc.billAmount)} />
      <InfoRow label={`Discount (${formatPercent(calc.discountPercentage)})`} value={`− ${formatINR(calc.discountAmount)}`} tone="success" />
      {reward && (
        <Txt variant="caption" tone="gold">
          {reward}
        </Txt>
      )}
      {bonus && (
        <Txt variant="caption" tone="gold">
          {bonus}
        </Txt>
      )}
      <View style={styles.totalGap}>
        <Divider />
      </View>
      <InfoRow label="Customer pays" value={formatINR(calc.finalAmount)} strong tone="gold" />

      <Panel accent style={styles.points}>
        <Txt variant="overline" tone="gold">
          Points earned
        </Txt>
        <PointsLine
          title={isReferral ? 'Customer purchase points' : 'Partner purchase points'}
          hint={purchaseRecipientLabel(calc.purchasePointsRecipient)}
          points={calc.purchasePoints}
        />
        {isReferral && <PointsLine title="Referral points" hint={`To ${partnerName}, who referred this customer`} points={calc.referralPoints} />}
        <Txt variant="caption" tone="muted" style={styles.ratio}>
          {formatPercent(calc.purchasePointsPercentage)} purchase
          {isReferral ? ` · ${formatPercent(calc.referralPointsPercentage)} referral` : ''} of the{' '}
          {calc.pointsBasis === 'BILL_AMOUNT' ? 'bill amount' : 'payable amount'} · {calc.pointsRatio.points} pts = ₹{calc.pointsRatio.rupees}
        </Txt>
      </Panel>
    </View>
  );
}

export function AmountStep({
  qrCode,
  scan,
  customer,
  onEditCustomer,
  onCompleted,
  onCancel,
  onSignedOut,
}: {
  qrCode: string;
  scan: ScanResult;
  customer?: ReferredCustomerInput;
  onEditCustomer?: () => void;
  onCompleted: (bill: BillRecord, replayed: boolean) => void;
  onCancel: () => void;
  onSignedOut: () => void;
}) {
  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BillCalculation | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // One key per calculated bill; retries of the same bill reuse it so the server de-duplicates.
  const idempotencyKey = useRef<string | null>(null);
  const requestSeq = useRef(0);

  const amount = Number(amountText);
  const validAmount = amountText !== '' && billAmountSchema.safeParse(amount).success;
  const previewMatches = !!preview && validAmount && preview.billAmount === Number(amount.toFixed(2));

  // Live, debounced server preview as the amount is typed (the phone never calculates).
  useEffect(() => {
    setPreview(null);
    idempotencyKey.current = null;
    if (!amountText) {
      setAmountError(null);
      return;
    }
    const parsed = billAmountSchema.safeParse(amount);
    if (!parsed.success) {
      setAmountError(parsed.error.issues[0]?.message ?? 'Enter a valid amount');
      return;
    }
    setAmountError(null);
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await apiClient.previewBill({ qrCode, billAmount: parsed.data, customer });
        if (seq !== requestSeq.current) return;
        setPreview(res.data);
        idempotencyKey.current = newIdempotencyKey();
        setError(null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        if (isAuthError(err)) return onSignedOut();
        setError(describeError(err, 'Could not calculate the bill'));
      } finally {
        if (seq === requestSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountText, qrCode, customer]);

  const complete = async () => {
    if (!preview || !previewMatches || !idempotencyKey.current || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.createBill({
        qrCode,
        billAmount: preview.billAmount,
        customer,
        idempotencyKey: idempotencyKey.current,
        settingsVersion: preview.settingsVersion,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCompleted(res.data.bill, res.data.replayed);
    } catch (err) {
      if (isAuthError(err)) return onSignedOut();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const code = errorCode(err);
      if (code === 'SETTINGS_CHANGED' && err instanceof ApiClientError) {
        // The Super Admin changed the programme values: show the new figures for confirmation.
        const next = (err.details as { calculation?: BillCalculation } | undefined)?.calculation;
        if (next) {
          setPreview(next);
          idempotencyKey.current = newIdempotencyKey();
        }
        setNotice('Programme settings were just updated by the Super Admin. Check the new amounts and points, then complete the bill again.');
      } else {
        if (code === 'IDEMPOTENCY_CONFLICT') {
          setPreview(null);
          idempotencyKey.current = null;
        }
        // Network failures keep the same key: tapping Complete again safely replays or creates once.
        setError(describeError(err, 'Could not complete the bill'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      {customer && (
        <Panel style={styles.customer}>
          <IconMark name="person-outline" size={40} />
          <View style={styles.flex}>
            <Txt variant="overline" tone="muted">
              Customer
            </Txt>
            <Txt variant="bodyMedium">{customer.name}</Txt>
            <Txt variant="small" tone="secondary">
              +91 {customer.mobile}
            </Txt>
          </View>
          {onEditCustomer && <Button label="Edit" variant="ghost" compact onPress={onEditCustomer} disabled={submitting} />}
        </Panel>
      )}

      <Field
        label="Bill amount"
        prefix="₹"
        value={amountText}
        onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        error={amountError}
        keyboardType="decimal-pad"
        placeholder="0.00"
        editable={!submitting}
        autoFocus
        style={styles.amountInput}
        accessory={previewing ? <ActivityIndicator color={colors.gold} style={styles.spinner} /> : null}
        hint="Enter the total before discount. The discount and points update automatically."
      />

      {notice && <Notice tone="warning" message={notice} onDismiss={() => setNotice(null)} />}
      {error && <Notice tone="error" message={error} onDismiss={() => setError(null)} />}

      {preview ? (
        <Panel style={styles.section}>
          <Breakdown calc={preview} partnerName={scan.partner.name} />
        </Panel>
      ) : (
        <View style={styles.placeholder}>
          <Txt variant="small" tone="muted">
            {previewing ? 'Calculating…' : 'The discount and points appear here'}
          </Txt>
        </View>
      )}

      <Button
        label={preview ? `Complete bill · ${formatINR(preview.finalAmount)}` : 'Complete bill'}
        onPress={complete}
        loading={submitting}
        disabled={!previewMatches || previewing}
      />
      <Button label="Cancel bill" variant="ghost" onPress={onCancel} disabled={submitting} style={styles.cancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  customer: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  amountInput: { fontFamily: fonts.semibold, fontSize: 24, height: 60 },
  spinner: { marginRight: space.md },
  section: { marginBottom: space.lg },
  placeholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: space.xl,
    alignItems: 'center',
    marginBottom: space.lg,
  },
  totalGap: { marginVertical: space.xs },
  points: { marginTop: space.md, gap: space.sm },
  pointsLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ratio: { marginTop: space.xxs },
  cancel: { marginTop: space.xs },
});
