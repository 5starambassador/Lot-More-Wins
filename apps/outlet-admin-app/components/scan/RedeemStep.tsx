import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ApiClientError } from '@lotmorewins/api-client';
import { billAmountSchema } from '@lotmorewins/validation';
import type { BillCalculation, BillRecord, RedeemScanResult } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, Divider, Field, IconMark, InfoRow, Notice, Panel, Txt } from '../ui';
import apiClient, { describeError, errorCode, isAuthError } from '../../lib/api';
import { formatINR, formatPercent, formatPoints, newIdempotencyKey } from '../../lib/format';
import { Breakdown } from './AmountStep';
import { colors, fonts, space } from '../../theme/tokens';

const PREVIEW_DEBOUNCE_MS = 450;

/** Staff-facing text for the redemption failures the server reports. */
function redeemError(err: unknown): string {
  switch (errorCode(err)) {
    case 'REDEEM_DISABLED':
      return 'Wallet redemption is turned off';
    case 'REDEEM_QR_INVALID':
      return 'This redeem QR has expired or is not valid. Ask the partner to generate a new one in their wallet.';
    case 'REDEEM_QR_USED':
      return 'This redeem QR has already been used. Ask the partner to generate a new one in their wallet.';
    case 'INSUFFICIENT_POINTS':
      return 'The partner has nothing in the wallet to redeem.';
    case 'PARTNER_INACTIVE':
      return 'This partner account is not active, so the wallet cannot be used.';
    case 'OUTLET_INACTIVE':
      return 'This outlet is inactive. Billing is disabled until the Super Admin reactivates it.';
    case 'SETTINGS_NOT_CONFIGURED':
      return 'Programme settings have not been configured by the Super Admin yet. Billing is unavailable.';
    default:
      return describeError(err, 'Could not complete the bill');
  }
}

/**
 * Redeem bill: the partner pays part of the bill from their wallet with a redeem QR (instead of a
 * discount QR, never together). The admin enters only the bill; the server works out the wallet
 * part — at most half the bill, never more than the QR is worth — and what the customer pays.
 * Whatever the QR was worth beyond that stays in the partner's wallet. No discount and no rewards.
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
  onCompleted: (bill: BillRecord, replayed: boolean) => void;
  onCancel: () => void;
  onSignedOut: () => void;
}) {
  const { partner, pointsRatio } = scan;
  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BillCalculation | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The QR is dead (expired / used): only a fresh scan can continue.
  const [dead, setDead] = useState(false);

  // One key per calculated bill; retries of the same bill reuse it so the server de-duplicates.
  const idempotencyKey = useRef<string | null>(null);
  const requestSeq = useRef(0);

  const amount = Number(amountText);
  const validAmount = amountText !== '' && billAmountSchema.safeParse(amount).success;
  const previewMatches = !!preview && validAmount && preview.billAmount === Number(amount.toFixed(2));

  const fail = (err: unknown) => {
    const code = errorCode(err);
    if (code === 'REDEEM_QR_INVALID' || code === 'REDEEM_QR_USED') setDead(true);
    setError(redeemError(err));
  };

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
        const res = await apiClient.previewBill({ qrCode, billAmount: parsed.data });
        if (seq !== requestSeq.current) return;
        setPreview(res.data);
        idempotencyKey.current = newIdempotencyKey();
        setError(null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        if (isAuthError(err)) return onSignedOut();
        fail(err);
      } finally {
        if (seq === requestSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountText, qrCode]);

  const complete = async () => {
    if (!preview || !previewMatches || !idempotencyKey.current || submitting || dead) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.createBill({
        qrCode,
        billAmount: preview.billAmount,
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
        const next = (err.details as { calculation?: BillCalculation } | undefined)?.calculation;
        if (next) {
          setPreview(next);
          idempotencyKey.current = newIdempotencyKey();
        }
        setNotice('Programme settings or this outlet’s offers were just updated. Check the new amounts, then complete the bill again.');
      } else {
        if (code === 'IDEMPOTENCY_CONFLICT') {
          setPreview(null);
          idempotencyKey.current = null;
        }
        // Network failures keep the same key: tapping Complete again safely replays or creates once.
        fail(err);
      }
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
          <InfoRow label="This QR is worth up to" value={formatINR(scan.maxRupees)} strong tone="gold" />
          <InfoRow label="Wallet balance" value={`${formatPoints(scan.balancePoints)} · ${formatINR(scan.rupeeValue)}`} />
          <Txt variant="caption" tone="muted">
            {pointsRatio.points} pts = ₹{pointsRatio.rupees} · at most half of the bill is paid from the wallet
          </Txt>
        </View>
      </Panel>

      <Field
        label="Bill amount"
        prefix="₹"
        value={amountText}
        onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        error={amountError}
        keyboardType="decimal-pad"
        placeholder="0.00"
        editable={!submitting && !dead}
        autoFocus
        style={styles.amountInput}
        accessory={previewing ? <ActivityIndicator color={colors.gold} style={styles.spinner} /> : null}
        hint={`The customer’s total bill${scan.gstPercentage > 0 ? ` before ${formatPercent(scan.gstPercentage)} GST` : ''}. The server works out the wallet part: up to half the bill.`}
      />

      {notice && <Notice tone="warning" message={notice} onDismiss={() => setNotice(null)} />}
      {error && <Notice tone="error" message={error} onDismiss={dead ? undefined : () => setError(null)} />}

      {preview ? (
        <Panel style={styles.card}>
          <Breakdown calc={preview} />
        </Panel>
      ) : (
        <View style={styles.placeholder}>
          <Txt variant="small" tone="muted">
            {previewing ? 'Calculating…' : 'The wallet part and what the customer pays appear here'}
          </Txt>
        </View>
      )}

      {dead ? (
        <Button label="Scan again" onPress={onCancel} />
      ) : (
        <>
          <Button
            label={preview ? `Complete bill · collect ${formatINR(preview.finalAmount)}` : 'Complete bill'}
            onPress={complete}
            loading={submitting}
            disabled={!previewMatches || previewing}
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
  spinner: { marginRight: space.md },
  placeholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: space.xl,
    alignItems: 'center',
    marginBottom: space.lg,
  },
  cancel: { marginTop: space.xs },
});
