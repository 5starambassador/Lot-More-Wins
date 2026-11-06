import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiClientError } from '@lotmorewins/api-client';
import { billAmountSchema } from '@lotmorewins/validation';
import type { BillCalculation, BillRecord, ReferredCustomerInput, ScanResult } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Button, Divider, Field, IconMark, InfoRow, Notice, Panel, Txt } from '../ui';
import apiClient, { describeError, errorCode, isAuthError } from '../../lib/api';
import { birthdayBonusLabel, referralRewardLabel, formatINR, formatPercent, formatPoints, newIdempotencyKey } from '../../lib/format';
import { colors, fonts, radius, space } from '../../theme/tokens';

const PREVIEW_DEBOUNCE_MS = 450;

/** The paise the server added or took off to bring the payable to whole rupees (absent from older servers). */
function RoundOffLine({ calc }: { calc: BillCalculation | BillRecord }) {
  const roundOff = calc.roundOffAmount ?? 0;
  if (roundOff === 0) return null;
  return <InfoRow label="Round off" value={`${roundOff > 0 ? '+' : '−'} ${formatINR(Math.abs(roundOff))}`} />;
}

/** The service charge on this bill (absent from older servers); no line when the outlet has none. */
const serviceChargeOf = (calc: BillCalculation | BillRecord) => calc.serviceChargeAmount ?? 0;

function ServiceChargeLine({ calc }: { calc: BillCalculation | BillRecord }) {
  const amount = serviceChargeOf(calc);
  if (amount <= 0) return null;
  const label =
    calc.serviceChargeType === 'PERCENTAGE' ? `Service charge (${formatPercent(calc.serviceChargeValue)})` : 'Service charge';
  return <InfoRow label={label} value={`+ ${formatINR(amount)}`} />;
}

/** GST with its working (e.g. 5% of ₹159.00 = ₹7.95), then the round-off. */
function GstLines({ calc, base, showRoundOff = true }: { calc: BillCalculation | BillRecord; base: number; showRoundOff?: boolean }) {
  return (
    <>
      {calc.gstPercentage > 0 ? (
        <View style={styles.gst}>
          <InfoRow label={`GST (${formatPercent(calc.gstPercentage)})`} value={`+ ${formatINR(calc.gstAmount)}`} />
          <Txt variant="caption" tone="muted" style={styles.gstWorking}>
            {formatPercent(calc.gstPercentage)} of {formatINR(base)} = {formatINR(calc.gstAmount)}
          </Txt>
        </View>
      ) : (
        <InfoRow label="GST" value="Not charged" />
      )}
      {showRoundOff && <RoundOffLine calc={calc} />}
    </>
  );
}

/** Redeem bill: service charge and GST on the bill, then up to half of the bill paid from the partner's wallet. No discount, no rewards. */
function RedeemBreakdown({ calc }: { calc: BillCalculation | BillRecord }) {
  return (
    <View>
      <InfoRow label="Bill amount" value={formatINR(calc.billAmount)} />
      <ServiceChargeLine calc={calc} />
      <GstLines calc={calc} base={calc.billAmount + serviceChargeOf(calc)} showRoundOff={false} />
      <InfoRow label="Paid from partner wallet" value={`− ${formatINR(calc.walletRedeemAmount)}`} tone="success" />
      <RoundOffLine calc={calc} />
      <Txt variant="caption" tone="muted">
        {formatPoints(calc.walletRedeemPoints)} from the wallet · at most half the bill. Anything the QR was worth beyond this stays in the
        partner’s wallet.
      </Txt>
      <View style={styles.totalGap}>
        <Divider />
      </View>
      <InfoRow label="Customer pays" value={formatINR(calc.finalAmount)} strong tone="gold" />
      <Txt variant="caption" tone="muted" style={styles.ratio}>
        Wallet bills get no discount.
      </Txt>
    </View>
  );
}

/** Which slab the bill's discount came from. */
function offerLabel(calc: BillCalculation | BillRecord): string {
  if (calc.transactionType === 'REFERRAL') return 'Referral offer';
  return calc.isFirstTime ? 'First bill offer' : 'Repeat bill offer';
}

/**
 * Server-calculated bill, laid out like a till receipt: the product total, the discount taken off
 * it, the service charge (when the outlet has one) and GST on the discounted amount, then the net total. Every figure comes from the server.
 * The points and cashback the bill earns are not shown to outlet staff (the partner sees them in their wallet).
 */
export function Breakdown({ calc }: { calc: BillCalculation | BillRecord }) {
  if (calc.transactionType === 'WALLET_REDEEM') return <RedeemBreakdown calc={calc} />;
  const bonus = birthdayBonusLabel(calc.birthdayBonusPercentage);
  const reward = referralRewardLabel(calc.referralRewardPercentage);
  return (
    <View>
      <InfoRow label="Subtotal" value={formatINR(calc.billAmount)} />
      <View style={styles.offerRow}>
        <Ionicons name="pricetag" size={14} color={colors.gold} />
        <Txt variant="smallMedium" tone="gold" style={styles.offerLabel}>
          {offerLabel(calc)} ({formatPercent(calc.discountPercentage)} OFF)
        </Txt>
        <Txt variant="bodyMedium" tone="gold" selectable>
          − {formatINR(calc.discountAmount)}
        </Txt>
      </View>
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
      <InfoRow label="After discount" value={formatINR(calc.taxableAmount)} />
      <ServiceChargeLine calc={calc} />
      <GstLines calc={calc} base={calc.taxableAmount + serviceChargeOf(calc)} />
      <View style={styles.netTotal}>
        <Txt variant="bodyMedium" style={styles.netLabel}>
          Net total
        </Txt>
        <Txt style={styles.netValue} selectable numberOfLines={1} adjustsFontSizeToFit>
          {formatINR(calc.finalAmount)}
        </Txt>
      </View>
    </View>
  );
}

/** How the bill is worked out at this outlet; the service charge is mentioned only when it has one. */
function amountHint(scan: ScanResult): string {
  const value = scan.serviceChargeValue ?? 0;
  const service =
    value > 0
      ? scan.serviceChargeType === 'FIXED'
        ? `a ${formatINR(value)} service charge`
        : `a ${formatPercent(value)} service charge`
      : null;
  const gst = scan.gstPercentage > 0 ? `${formatPercent(scan.gstPercentage)} GST` : null;
  if (service && gst) return `The discount comes off this total, then ${service} and ${gst} are added.`;
  if (service) return `The discount comes off this total, then ${service} is added. This outlet charges no GST.`;
  if (gst) return `The discount comes off this total, then ${gst} is added to the discounted amount.`;
  return 'The discount comes off this total. This outlet charges no GST.';
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
        const res = await apiClient.previewBill({
          qrCode,
          billAmount: parsed.data,
          customer,
        });
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
        setNotice('Programme settings or this outlet’s offers were just updated. Check the new amounts, then complete the bill again.');
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
        label="Total product bill (before discount and GST)"
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
        hint={amountHint(scan)}
      />

      {notice && <Notice tone="warning" message={notice} onDismiss={() => setNotice(null)} />}
      {error && <Notice tone="error" message={error} onDismiss={() => setError(null)} />}

      {preview ? (
        <Panel style={styles.section}>
          <Breakdown calc={preview} />
        </Panel>
      ) : (
        <View style={styles.placeholder}>
          <Txt variant="small" tone="muted">
            {previewing ? 'Calculating…' : 'The discount appears here'}
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
  customer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
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
  gst: { marginBottom: 2 },
  gstWorking: { marginTop: -4, textAlign: 'right' },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  offerLabel: { flex: 1 },
  netTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.canvasDeep,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  netLabel: { textTransform: 'uppercase', letterSpacing: 0.8 },
  netValue: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, color: colors.gold },
  ratio: { marginTop: space.xxs },
  cancel: { marginTop: space.xs },
});
