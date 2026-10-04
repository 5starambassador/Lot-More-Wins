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
    case 'REDEEM_EXCEEDS_BILL':
      return 'The amount to redeem cannot be more than the bill.';
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

const cleanAmount = (text: string) => text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

/**
 * Wallet redemption: the partner and live balance come from the server. The admin enters the
 * bill first, then how much of it the wallet pays (typed, or the full value the wallet can
 * cover); the server converts that to points, debits the wallet and records the bill.
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
  const [billText, setBillText] = useState('');
  const [amountText, setAmountText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The QR is dead (expired / used): only a fresh scan can continue.
  const [dead, setDead] = useState(false);

  const bill = Number(billText);
  const hasBill = billText !== '' && Number.isFinite(bill);
  const billError = !hasBill
    ? null
    : bill <= 0
      ? 'Enter a bill amount greater than 0'
      : !TWO_DECIMALS.test(billText)
        ? 'Amount can have at most 2 decimal places'
        : null;
  const billValid = hasBill && !billError;
  // The wallet can pay the whole bill, or as much of it as it is worth.
  const maxRedeem = billValid ? Math.min(balance.rupees, bill) : 0;

  const amount = Number(amountText);
  const hasAmount = amountText !== '' && Number.isFinite(amount);
  const amountError = !hasAmount
    ? null
    : amount <= 0
      ? 'Enter an amount greater than 0'
      : !TWO_DECIMALS.test(amountText)
        ? 'Amount can have at most 2 decimal places'
        : amount > balance.rupees
          ? `The wallet is worth ${formatINR(balance.rupees)} at most`
          : billValid && amount > bill
            ? `Cannot be more than the bill of ${formatINR(bill)}`
            : null;
  const valid = billValid && hasAmount && !amountError;
  const points = valid ? Math.round(((amount * pointsRatio.points) / pointsRatio.rupees) * 100) / 100 : 0;
  const payable = valid ? Math.round((bill - amount) * 100) / 100 : 0;

  const confirm = async () => {
    if (!valid || submitting || dead) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.redeemPoints({ qrCode, rupees: amount, billAmount: bill });
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
        label="Bill amount"
        prefix="₹"
        value={billText}
        onChangeText={(t) => setBillText(cleanAmount(t))}
        error={billError}
        keyboardType="decimal-pad"
        placeholder="0.00"
        editable={!submitting && !dead}
        autoFocus
        style={styles.amountInput}
        hint="The customer’s total bill, before the wallet is used."
      />

      <Field
        label="Amount to redeem"
        prefix="₹"
        value={amountText}
        onChangeText={(t) => setAmountText(cleanAmount(t))}
        error={amountError}
        keyboardType="decimal-pad"
        placeholder="0.00"
        editable={billValid && !submitting && !dead}
        style={styles.amountInput}
        hint={
          !billValid
            ? 'Enter the bill amount first.'
            : valid
              ? `Uses ${formatPoints(points)} from the wallet`
              : `Up to ${formatINR(maxRedeem)} can be taken off this bill from the wallet.`
        }
        accessory={
          <Button
            label="Full value"
            variant="ghost"
            compact
            onPress={() => setAmountText(maxRedeem.toFixed(2))}
            disabled={!billValid || submitting || dead || maxRedeem <= 0}
          />
        }
      />

      {valid && (
        <Panel style={styles.card}>
          <InfoRow label="Bill amount" value={formatINR(bill)} />
          <InfoRow label="Paid from wallet" value={`− ${formatINR(amount)}`} />
          <View style={styles.gap}>
            <Divider />
          </View>
          <InfoRow label="Customer pays" value={formatINR(payable)} strong tone="gold" />
        </Panel>
      )}

      {error && <Notice tone="error" message={error} onDismiss={dead ? undefined : () => setError(null)} />}

      {dead ? (
        <Button label="Scan again" onPress={onCancel} />
      ) : (
        <>
          <Button
            label={valid ? `Complete bill · redeem ${formatINR(amount)}` : 'Complete bill'}
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
  gap: { marginVertical: space.xs },
  cancel: { marginTop: space.xs },
});
