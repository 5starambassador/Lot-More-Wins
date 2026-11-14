import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, RefreshControl, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OUTLET_SLABS, outletOffersUpdateSchema } from '@lotmorewins/validation';
import type {
  DiscountType,
  OutletOfferChangeRecord,
  OutletSettingsView,
  OutletSlabKey,
  ServiceChargeType,
  UpdateOutletOffersPayload,
} from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Button, Divider, FullScreenLoader, InfoRow, Notice, Panel, Screen, SectionLabel, StateView, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import apiClient, { describeError, isAuthError } from '../../lib/api';
import { formatDateTime, formatINR, formatPercent } from '../../lib/format';
import { useSession } from '../../store/session-store';
import { colors, fonts, radius, space } from '../../theme/tokens';

/**
 * This outlet's slabs, edited by the Outlet Admin: GST, the service charge (a % or a fixed ₹), the
 * first-bill and repeat-bill partner discounts, cashback (the purchase reward credited to the
 * partner's wallet, on repeat bills only), the referring partner's reward and the referred guest's
 * bill discount. Every slab but GST is a % or a flat ₹ amount, chosen per slab: a flat discount is
 * the most the outlet gives (picked on each bill), a flat reward is the ₹ credited per bill. Also the
 * minimum bill for a discount and whether partners can redeem their wallet here. Each slab is one
 * rate for every partner (Achariya and Non-Achariya alike). On a bill the discount comes off the
 * product total first, the service charge is added to what remains and GST is charged on both. A
 * discount is never more than half the bill. Every change is audit-logged and applies to the next bill.
 */

type IconName = ComponentProps<typeof Ionicons>['name'];
type SlabKey = 'gst' | 'firstBill' | 'repeatBill' | 'cashback' | 'referrerReward' | 'guestDiscount';
type OfferField = keyof UpdateOutletOffersPayload;

interface Slab {
  key: SlabKey;
  label: string;
  hint: string;
  icon: IconName;
  /** Every offer field the slab writes; the first is the one it shows. */
  fields: OfferField[];
}

const PARTNER_SLABS: Slab[] = [
  {
    key: 'firstBill',
    label: 'First bill discount',
    hint: "Off a partner's first bill at this outlet",
    icon: 'sparkles-outline',
    fields: ['firstTimeDiscount', 'achariyaFirstTimeDiscount'],
  },
  {
    key: 'repeatBill',
    label: 'Repeat bill discount',
    hint: 'Off every later bill of the partner',
    icon: 'repeat-outline',
    fields: ['repeatDiscount'],
  },
  {
    key: 'cashback',
    label: 'Cashback',
    hint: "Of each repeat bill, credited to the partner's wallet. None on the first bill",
    icon: 'wallet-outline',
    fields: ['purchasePointsPercentage'],
  },
];

const REFERRAL_SLABS: Slab[] = [
  {
    key: 'guestDiscount',
    label: 'Referred guest discount',
    hint: "Off the guest's bill when they show a referral QR",
    icon: 'person-add-outline',
    fields: ['referralDiscount'],
  },
  {
    key: 'referrerReward',
    label: 'Referring partner reward',
    hint: "Of the guest's bill, credited to the partner who referred them",
    icon: 'people-outline',
    fields: ['referralPointsPercentage', 'achariyaReferralPointsPercentage'],
  },
];

const TAX_SLABS: Slab[] = [
  {
    key: 'gst',
    label: 'GST',
    hint: 'A tax rate, so always a %. Charged on the bill after the discount, plus the service charge',
    icon: 'document-text-outline',
    fields: ['gstPercentage'],
  },
];

const SLABS = [...PARTNER_SLABS, ...REFERRAL_SLABS, ...TAX_SLABS];

/** The slabs that can be a % or a flat ₹ amount (every one but GST), and the server slab each is. */
const TYPED: Partial<Record<SlabKey, OutletSlabKey>> = {
  firstBill: 'firstTimeDiscount',
  repeatBill: 'repeatDiscount',
  cashback: 'purchasePoints',
  guestDiscount: 'referralDiscount',
  referrerReward: 'referralPoints',
};
const TYPED_KEYS = Object.keys(TYPED) as SlabKey[];
const slabDef = (key: SlabKey) => OUTLET_SLABS.find((s) => s.key === TYPED[key])!;
/** A flat discount is whole rupees; a flat reward may have paise. */
const isDiscountSlab = (key: SlabKey) => slabDef(key).kind === 'discount';

const FLAT_HINT: Partial<Record<SlabKey, string>> = {
  firstBill: "Most off a partner's first bill here. You pick the amount on each bill",
  repeatBill: 'Most off every later bill. You pick the amount on each bill',
  guestDiscount: "Most off the guest's bill. You pick the amount on each bill",
  cashback: "Credited to the partner's wallet on each repeat bill (never more than the bill)",
  referrerReward: "Credited to the referring partner on each guest's bill (never more than the bill)",
};

const FIELD_LABELS: Record<string, string> = {
  firstTimeDiscount: 'First bill discount',
  achariyaFirstTimeDiscount: 'First bill discount (Achariya)',
  repeatDiscount: 'Repeat bill discount',
  referralDiscount: 'Referred guest discount',
  discountType: 'Discount type',
  firstTimeDiscountType: 'First bill discount type',
  repeatDiscountType: 'Repeat bill discount type',
  referralDiscountType: 'Referred guest discount type',
  purchasePointsType: 'Cashback type',
  referralPointsType: 'Referring partner reward type',
  cashRewardPurchaseType: 'Purchase cash reward type',
  cashRewardReferralType: 'Referral cash reward type',
  flatFirstTimeDiscount: 'First bill discount (flat)',
  flatRepeatDiscount: 'Repeat bill discount (flat)',
  flatReferralDiscount: 'Referred guest discount (flat)',
  flatPurchasePoints: 'Cashback (flat)',
  flatReferralPoints: 'Referring partner reward (flat)',
  flatCashRewardPurchase: 'Purchase cash reward (flat)',
  flatCashRewardReferral: 'Referral cash reward (flat)',
  minBillAmount: 'Minimum bill for a discount',
  walletRedemptionEnabled: 'Wallet redemption',
  gstPercentage: 'GST',
  serviceChargeType: 'Service charge type',
  serviceChargeValue: 'Service charge',
  purchasePointsPercentage: 'Cashback',
  referralPointsPercentage: 'Referring partner reward',
  achariyaReferralPointsPercentage: 'Referring partner reward (Achariya)',
  cashRewardPurchasePercentage: 'Purchase cash reward',
  cashRewardReferralPercentage: 'Referral cash reward',
  givesCashReward: 'Cash reward',
  canEditOffers: 'Outlet can edit offers',
};

type FormState = Record<SlabKey, string> & {
  serviceChargeType: ServiceChargeType;
  serviceCharge: string;
  /** Each typed slab: PERCENTAGE uses the % above, FIXED its ₹ amount in flat. */
  types: Partial<Record<SlabKey, DiscountType>>;
  flat: Partial<Record<SlabKey, string>>;
  minBill: string;
  walletRedemption: boolean;
};
type ErrorKey = SlabKey | 'serviceCharge' | 'minBill';

/** The rate each field resolves to at this outlet (its override, or the programme value). */
function currentValue(view: OutletSettingsView, field: OfferField): number {
  if (field === 'gstPercentage') return view.offers.gstPercentage;
  if (field in view.effectiveDiscounts) return view.effectiveDiscounts[field as keyof OutletSettingsView['effectiveDiscounts']];
  return view.effectiveRewards[field as keyof OutletSettingsView['effectiveRewards']];
}

const toForm = (view: OutletSettingsView): FormState => ({
  ...(Object.fromEntries(SLABS.map((s) => [s.key, String(currentValue(view, s.fields[0]))])) as Record<SlabKey, string>),
  // Older servers send no service charge: none.
  serviceChargeType: view.offers.serviceChargeType ?? 'PERCENTAGE',
  serviceCharge: String(view.offers.serviceChargeValue ?? 0),
  // Older servers send no slab types: percentage.
  types: Object.fromEntries(TYPED_KEYS.map((k) => [k, (view.offers[slabDef(k).typeField] as DiscountType | undefined) ?? 'PERCENTAGE'])),
  flat: Object.fromEntries(TYPED_KEYS.map((k) => [k, String(view.offers[slabDef(k).flatField] ?? 0)])),
  minBill: String(view.offers.minBillAmount ?? 0),
  walletRedemption: view.offers.walletRedemptionEnabled ?? true,
});

const typeChanged = (form: FormState, initial: FormState, key: SlabKey) =>
  form.types[key] !== initial.types[key] || (form.types[key] === 'FIXED' && form.flat[key] !== initial.flat[key]);

const serviceChargeChanged = (form: FormState, initial: FormState) =>
  form.serviceChargeType !== initial.serviceChargeType || form.serviceCharge !== initial.serviceCharge;

/** A slab that writes two fields whose saved values differ (e.g. set separately by the Super Admin earlier). */
function splitNote(view: OutletSettingsView, slab: Slab): string | null {
  if (slab.fields.length < 2) return null;
  const [main, other] = slab.fields.map((f) => currentValue(view, f));
  return main === other ? null : `Achariya partners get ${formatPercent(other)} now. Saving this slab sets one rate for all partners.`;
}

const cleanNumber = (t: string) => t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const cleanRupees = (t: string) => t.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

function changeValue(field: string, value: string | null): string {
  if (field === 'serviceChargeType') return value === 'FIXED' ? 'Fixed ₹' : 'Percentage';
  if (field === 'discountType' || field.endsWith('Type')) return value === 'FIXED' ? 'Flat ₹' : 'Percentage';
  if (field.startsWith('flat') || field === 'minBillAmount') return `₹${value ?? '0'}`;
  // A % or a ₹ amount, by the type saved with it.
  if (field === 'serviceChargeValue') return value ?? '0';
  if (value === null) return field === 'gstPercentage' ? '0%' : 'programme default';
  if (value === 'true') return 'On';
  if (value === 'false') return 'Off';
  return `${value}%`;
}

function ChangeRow({ change }: { change: OutletOfferChangeRecord }) {
  return (
    <View style={styles.change}>
      <Txt variant="smallMedium">{FIELD_LABELS[change.field] ?? change.field}</Txt>
      <Txt variant="small" tone="secondary">
        {changeValue(change.field, change.oldValue)} → {changeValue(change.field, change.newValue)}
      </Txt>
      <Txt variant="caption" tone="muted">
        {change.actorType === 'SUPER_ADMIN' ? 'Super Admin' : 'Outlet Admin'} · {change.actorEmail} · {formatDateTime(change.createdAt)}
      </Txt>
    </View>
  );
}

/** Percentage or flat ₹: the radio pair under every slab but GST. */
function TypeRadios({
  type,
  editable,
  onChange,
  flatLabel = 'Flat(₹)',
  label,
}: {
  type: DiscountType;
  editable: boolean;
  onChange: (type: DiscountType) => void;
  flatLabel?: string;
  label: string;
}) {
  return (
    <View style={styles.chargeTypes} accessibilityRole="radiogroup" accessibilityLabel={`${label} type`}>
      {(['PERCENTAGE', 'FIXED'] as const).map((option) => {
        const active = option === type;
        return (
          <Pressable
            key={option}
            disabled={!editable}
            onPress={() => {
              if (!active) {
                Haptics.selectionAsync();
                onChange(option);
              }
            }}
            style={[styles.chargeType, styles.radio, active && styles.chargeTypeActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled: !editable }}
          >
            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={16} color={active ? colors.gold : colors.textMuted} />
            <Txt variant="smallMedium" tone={active ? 'gold' : 'secondary'}>
              {option === 'PERCENTAGE' ? 'Pct(%)' : flatLabel}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One slab: icon, name and what it does on the left, the % or ₹ input on the right, the type radios below. */
function SlabRow({
  slab,
  value,
  error,
  note,
  editable,
  onChange,
  rupees = false,
  wholeRupees = true,
  type,
  onChangeType,
}: {
  slab: Slab;
  value: string;
  error?: string;
  note: string | null;
  editable: boolean;
  onChange: (value: string) => void;
  /** A flat slab: ₹ instead of %. */
  rupees?: boolean;
  /** Flat discounts are whole rupees; flat rewards may have paise. */
  wholeRupees?: boolean;
  /** Typed slabs only: the current type and how to change it. */
  type?: DiscountType;
  onChangeType?: (type: DiscountType) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.slab}>
      <View style={styles.slabMain}>
        <View style={styles.slabIcon}>
          <Ionicons name={slab.icon} size={18} color={colors.gold} />
        </View>
        <View style={styles.slabText}>
          <Txt variant="bodyMedium">{slab.label}</Txt>
          <Txt variant="caption" tone="muted">
            {rupees ? (FLAT_HINT[slab.key] ?? slab.hint) : slab.hint}
          </Txt>
        </View>
        <View style={[styles.slabInput, rupees && styles.slabInputWide, focused && styles.slabInputFocused, !!error && styles.slabInputError]}>
          {rupees && (
            <Txt variant="bodyMedium" tone="secondary">
              ₹
            </Txt>
          )}
          <TextInput
            value={value}
            onChangeText={(t) => onChange(rupees && wholeRupees ? cleanRupees(t) : cleanNumber(t))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType={rupees && wholeRupees ? 'number-pad' : 'decimal-pad'}
            inputMode={rupees && wholeRupees ? 'numeric' : 'decimal'}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.gold}
            cursorColor={colors.gold}
            editable={editable}
            maxLength={rupees ? 9 : 5}
            style={styles.slabValue}
            accessibilityLabel={rupees ? `${slab.label} in rupees` : `${slab.label} percentage`}
          />
          {!rupees && (
            <Txt variant="bodyMedium" tone="secondary">
              %
            </Txt>
          )}
        </View>
      </View>
      {type && onChangeType ? <TypeRadios type={type} editable={editable} onChange={onChangeType} label={slab.label} /> : null}
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.slabHelper}>
          {error}
        </Txt>
      ) : note ? (
        <Txt variant="caption" tone="gold" style={styles.slabHelper}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * The service charge slab: % of the discounted amount or a fixed ₹ per bill, then the value.
 * 0 = none (no line on the bill).
 */
function ServiceChargeRow({
  type,
  value,
  error,
  editable,
  onChangeType,
  onChange,
}: {
  type: ServiceChargeType;
  value: string;
  error?: string;
  editable: boolean;
  onChangeType: (type: ServiceChargeType) => void;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const fixed = type === 'FIXED';
  return (
    <View style={styles.slab}>
      <View style={styles.slabMain}>
        <View style={styles.slabIcon}>
          <Ionicons name="restaurant-outline" size={18} color={colors.gold} />
        </View>
        <View style={styles.slabText}>
          <Txt variant="bodyMedium">Service charge</Txt>
          <Txt variant="caption" tone="muted">
            {fixed ? 'A fixed amount on every bill, added before GST. 0 for none' : 'Of the bill after the discount, added before GST. 0 for none'}
          </Txt>
        </View>
        <View style={[styles.slabInput, focused && styles.slabInputFocused, !!error && styles.slabInputError]}>
          {fixed && (
            <Txt variant="bodyMedium" tone="secondary">
              ₹
            </Txt>
          )}
          <TextInput
            value={value}
            onChangeText={(t) => onChange(cleanNumber(t))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.gold}
            cursorColor={colors.gold}
            editable={editable}
            maxLength={fixed ? 8 : 5}
            style={styles.slabValue}
            accessibilityLabel={fixed ? 'Service charge in rupees' : 'Service charge percentage'}
          />
          {!fixed && (
            <Txt variant="bodyMedium" tone="secondary">
              %
            </Txt>
          )}
        </View>
      </View>
      <TypeRadios type={type} editable={editable} onChange={onChangeType} flatLabel="Fixed amount (₹)" label="Service charge" />
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.slabHelper}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** Minimum bill for a discount (₹, 0 = none) and the wallet redemption switch. */
function OutletRulesPanel({
  minBill,
  minBillError,
  walletRedemption,
  editable,
  showWallet,
  onChangeMinBill,
  onChangeWallet,
}: {
  minBill: string;
  minBillError?: string;
  walletRedemption: boolean;
  editable: boolean;
  showWallet: boolean;
  onChangeMinBill: (value: string) => void;
  onChangeWallet: (on: boolean) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Panel style={styles.section}>
      <View style={styles.slab}>
        <View style={styles.slabMain}>
          <View style={styles.slabIcon}>
            <Ionicons name="receipt-outline" size={18} color={colors.gold} />
          </View>
          <View style={styles.slabText}>
            <Txt variant="bodyMedium">Minimum bill for a discount</Txt>
            <Txt variant="caption" tone="muted">
              Bills below this get no discount, % or flat. 0 for no minimum
            </Txt>
          </View>
          <View style={[styles.slabInput, styles.slabInputWide, focused && styles.slabInputFocused, !!minBillError && styles.slabInputError]}>
            <Txt variant="bodyMedium" tone="secondary">
              ₹
            </Txt>
            <TextInput
              value={minBill}
              onChangeText={(t) => onChangeMinBill(cleanNumber(t))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.gold}
              cursorColor={colors.gold}
              editable={editable}
              maxLength={10}
              style={styles.slabValue}
              accessibilityLabel="Minimum bill for a discount in rupees"
            />
          </View>
        </View>
        {minBillError ? (
          <Txt variant="caption" tone="danger" style={styles.slabHelper}>
            {minBillError}
          </Txt>
        ) : null}
      </View>
      {showWallet && (
        <>
          <Divider />
          <View style={styles.slab}>
            <View style={styles.slabMain}>
              <View style={styles.slabIcon}>
                <Ionicons name="qr-code-outline" size={18} color={colors.gold} />
              </View>
              <View style={styles.slabText}>
                <Txt variant="bodyMedium">Wallet redemption</Txt>
                <Txt variant="caption" tone="muted">
                  {walletRedemption
                    ? 'On: partners can pay part of a bill here with a wallet redeem QR'
                    : 'Off: partners cannot redeem their wallet at this outlet'}
                </Txt>
              </View>
              <Switch
                value={walletRedemption}
                disabled={!editable}
                onValueChange={(on) => {
                  Haptics.selectionAsync();
                  onChangeWallet(on);
                }}
                trackColor={{ false: colors.line, true: colors.gold }}
                thumbColor={colors.text}
                accessibilityLabel="Wallet redemption"
              />
            </View>
          </View>
        </>
      )}
    </Panel>
  );
}

/**
 * How a first bill comes out with the slabs as typed: discount off the product total, the service
 * charge on the rest, then GST on both. Illustration only (same rounding as the server); real bills
 * are always calculated by the server.
 */
function ExampleBill({
  discount,
  flat,
  gst,
  serviceChargeType,
  serviceCharge,
  minBill,
}: {
  discount: number;
  /** A flat first-bill slab in ₹ (the full slab is used in the example). */
  flat: number | null;
  gst: number;
  serviceChargeType: ServiceChargeType;
  serviceCharge: number;
  minBill: number;
}) {
  const subtotal = 1000;
  const below = minBill > 0 && subtotal < minBill;
  const afterDiscount = below
    ? subtotal
    : flat !== null
      ? Math.round(subtotal - Math.min(flat, subtotal / 2))
      : Math.round(subtotal - (subtotal * Math.min(discount, 50)) / 100);
  const serviceAmount =
    serviceCharge > 0
      ? serviceChargeType === 'FIXED'
        ? Math.round(serviceCharge * 100) / 100
        : Math.round(afterDiscount * serviceCharge) / 100
      : 0;
  const gstBase = afterDiscount + serviceAmount;
  const gstAmount = Math.round(gstBase * gst) / 100;
  const exact = gstBase + gstAmount;
  const netTotal = Math.round(exact);
  const roundOff = Math.round((netTotal - exact) * 100) / 100;
  return (
    <Panel accent style={styles.section}>
      <Txt variant="overline" tone="gold" style={styles.exampleTitle}>
        Example · first bill of {formatINR(subtotal)}
      </Txt>
      <InfoRow label="Product total" value={formatINR(subtotal)} />
      <InfoRow
        label={
          below
            ? `Discount (below the ${formatINR(minBill)} minimum)`
            : flat !== null
              ? 'Discount (flat, full slab)'
              : `Discount (${formatPercent(discount)})`
        }
        value={`− ${formatINR(subtotal - afterDiscount)}`}
        tone="success"
      />
      {serviceAmount > 0 && (
        <InfoRow
          label={serviceChargeType === 'FIXED' ? 'Service charge' : `Service charge (${formatPercent(serviceCharge)})`}
          value={`+ ${formatINR(serviceAmount)}`}
        />
      )}
      <InfoRow label={`GST (${formatPercent(gst)}) on ${formatINR(gstBase)}`} value={`+ ${formatINR(gstAmount)}`} />
      {roundOff !== 0 && <InfoRow label="Round off" value={`${roundOff > 0 ? '+' : '−'} ${formatINR(Math.abs(roundOff))}`} />}
      <View style={styles.exampleTotal}>
        <Txt variant="bodyMedium" style={styles.exampleTotalLabel}>
          Net total
        </Txt>
        <Txt style={styles.exampleTotalValue}>{formatINR(netTotal)}</Txt>
      </View>
    </Panel>
  );
}

export default function SlabsScreen() {
  const queryClient = useQueryClient();
  const signOut = useSession((s) => s.signOut);
  const query = useQuery({
    queryKey: ['outlet-settings'],
    queryFn: async () => (await apiClient.getOutletSettings()).data,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (query.data) setForm(toForm(query.data));
  }, [query.data]);

  useEffect(() => {
    if (query.error && isAuthError(query.error)) signOut();
  }, [query.error, signOut]);

  const save = useMutation({
    mutationFn: async (payload: UpdateOutletOffersPayload) => (await apiClient.updateOutletSettings(payload)).data,
    onSuccess: (view) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.setQueryData(['outlet-settings'], view);
      setForm(toForm(view));
      setMessage({ tone: 'success', text: 'Slabs saved. The next bill uses them.' });
    },
    onError: (err) => {
      if (isAuthError(err)) return signOut();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({ tone: 'error', text: describeError(err, 'Could not save the slabs') });
    },
  });

  if (query.isLoading || (!form && !query.isError)) return <FullScreenLoader />;

  if (query.isError || !query.data || !form) {
    return (
      <Screen edges={['top']}>
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load this outlet's slabs"
          message={describeError(query.error)}
          actionLabel="Try again"
          onAction={() => query.refetch()}
        />
      </Screen>
    );
  }

  const view = query.data;
  const initial = toForm(view);
  // A server that predates service charges sends no service charge fields and would reject them on save.
  const serviceChargeSupported = view.offers.serviceChargeType !== undefined;
  // A server that predates per-slab types, the minimum bill and the wallet switch sends none of them.
  const typesSupported = view.offers.firstTimeDiscountType !== undefined;
  const typeOf = (key: SlabKey): DiscountType => (typesSupported && TYPED[key] ? (form.types[key] ?? 'PERCENTAGE') : 'PERCENTAGE');
  const isFlat = (key: SlabKey) => typeOf(key) === 'FIXED';
  const dirty =
    SLABS.some((s) => !isFlat(s.key) && form[s.key] !== initial[s.key]) ||
    serviceChargeChanged(form, initial) ||
    (typesSupported &&
      (TYPED_KEYS.some((k) => typeChanged(form, initial, k)) ||
        form.minBill !== initial.minBill ||
        form.walletRedemption !== initial.walletRedemption));

  const onSave = () => {
    setMessage(null);
    const errs: Partial<Record<ErrorKey, string>> = {};
    const payload: Record<string, number | string | boolean> = {};
    for (const slab of SLABS) {
      // A flat slab saves its type and ₹ amount together.
      if (typesSupported && TYPED[slab.key] && typeChanged(form, initial, slab.key)) {
        const def = slabDef(slab.key);
        payload[def.typeField] = typeOf(slab.key);
        if (isFlat(slab.key)) {
          if (!form.flat[slab.key]) errs[slab.key] = 'Enter an amount (0 for none)';
          else payload[def.flatField] = Number(form.flat[slab.key]);
        }
      }
      if (isFlat(slab.key)) continue;
      // A % slab is saved when its value changed, or when it would bring split rates back to one.
      if (form[slab.key] === initial[slab.key] && !splitNote(view, slab)) continue;
      if (form[slab.key] === '') {
        errs[slab.key] = 'Enter a percentage (0 for none)';
        continue;
      }
      for (const field of slab.fields) payload[field] = Number(form[slab.key]);
    }
    // The service charge type and value are always saved together.
    if (serviceChargeChanged(form, initial)) {
      if (form.serviceCharge === '') errs.serviceCharge = 'Enter an amount (0 for none)';
      else {
        payload.serviceChargeType = form.serviceChargeType;
        payload.serviceChargeValue = Number(form.serviceCharge);
      }
    }
    if (typesSupported && form.minBill !== initial.minBill) {
      if (form.minBill === '') errs.minBill = 'Enter an amount (0 for no minimum)';
      else payload.minBillAmount = Number(form.minBill);
    }
    if (typesSupported && form.walletRedemption !== initial.walletRedemption) payload.walletRedemptionEnabled = form.walletRedemption;

    const parsed = outletOffersUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (field === 'serviceChargeType' || field === 'serviceChargeValue') {
          errs.serviceCharge ??= issue.message;
          continue;
        }
        if (field === 'minBillAmount') {
          errs.minBill ??= issue.message;
          continue;
        }
        const typed = TYPED_KEYS.find((k) => slabDef(k).flatField === field || slabDef(k).typeField === field);
        if (typed) {
          errs[typed] ??= issue.message;
          continue;
        }
        const slab = SLABS.find((s) => s.fields.includes(field as OfferField));
        if (slab) errs[slab.key] ??= issue.message;
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !parsed.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (Object.keys(payload).length === 0) {
      setMessage({ tone: 'success', text: 'Nothing to save: no slab has changed.' });
      return;
    }
    save.mutate(parsed.data);
  };

  const renderSlab = (slab: Slab) => {
    const typed = typesSupported && !!TYPED[slab.key];
    const flat = isFlat(slab.key);
    return (
      <SlabRow
        slab={slab}
        rupees={flat}
        wholeRupees={!TYPED[slab.key] || isDiscountSlab(slab.key)}
        value={flat ? (form.flat[slab.key] ?? '') : form[slab.key]}
        error={errors[slab.key]}
        note={flat ? null : splitNote(view, slab)}
        editable={!save.isPending}
        onChange={(value) =>
          setForm(flat ? { ...form, flat: { ...form.flat, [slab.key]: value } } : { ...form, [slab.key]: value })
        }
        type={typed ? typeOf(slab.key) : undefined}
        onChangeType={
          typed
            ? (type) => {
                setErrors((e) => ({ ...e, [slab.key]: undefined }));
                setForm({ ...form, types: { ...form.types, [slab.key]: type } });
              }
            : undefined
        }
      />
    );
  };

  const renderSlabs = (slabs: Slab[]) => (
    <Panel style={styles.section}>
      {slabs.map((slab, i) => (
        <View key={slab.key}>
          {i > 0 && <Divider />}
          {renderSlab(slab)}
        </View>
      ))}
    </Panel>
  );

  return (
    <Screen
      edges={['top']}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.gold} />}
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <Txt variant="title">Slabs</Txt>
          <Txt variant="small" tone="secondary">
            Discounts, cashback, service charge and GST for this outlet
          </Txt>
        </View>
        <BrandLogo size={36} />
      </View>

      <Animated.View entering={FadeInDown.duration(350)}>
        {message && <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} />}

        <SectionLabel label="Partner bills" />
        {renderSlabs(PARTNER_SLABS)}

        <SectionLabel label="Referral bills" />
        {renderSlabs(REFERRAL_SLABS)}

        <SectionLabel label={serviceChargeSupported ? 'Service charge and tax' : 'Tax'} />
        <Panel style={styles.section}>
          {serviceChargeSupported && (
            <ServiceChargeRow
              type={form.serviceChargeType}
              value={form.serviceCharge}
              error={errors.serviceCharge}
              editable={!save.isPending}
              onChangeType={(serviceChargeType) => setForm({ ...form, serviceChargeType })}
              onChange={(serviceCharge) => setForm({ ...form, serviceCharge })}
            />
          )}
          {TAX_SLABS.map((slab, i) => (
            <View key={slab.key}>
              {(serviceChargeSupported || i > 0) && <Divider />}
              {renderSlab(slab)}
            </View>
          ))}
        </Panel>

        {typesSupported && (
          <>
            <SectionLabel label="Discount and wallet rules" />
            <OutletRulesPanel
              minBill={form.minBill}
              minBillError={errors.minBill}
              walletRedemption={form.walletRedemption}
              editable={!save.isPending}
              showWallet
              onChangeMinBill={(minBill) => setForm({ ...form, minBill })}
              onChangeWallet={(walletRedemption) => setForm({ ...form, walletRedemption })}
            />
          </>
        )}

        <ExampleBill
          discount={Number(form.firstBill) || 0}
          flat={isFlat('firstBill') ? Number(form.flat.firstBill) || 0 : null}
          gst={Number(form.gst) || 0}
          serviceChargeType={form.serviceChargeType}
          serviceCharge={Number(form.serviceCharge) || 0}
          minBill={Number(form.minBill) || 0}
        />

        <Txt variant="caption" tone="muted" style={styles.note}>
          Partners see this outlet as “{view.summary.label}”. A discount is never more than half the bill.{serviceChargeSupported ? " A partner's first bill here earns no cashback." : ''} Changes apply to the next bill.
        </Txt>

        <Button label="Save slabs" onPress={onSave} loading={save.isPending} disabled={!dirty && !SLABS.some((s) => splitNote(view, s))} />

        <View style={styles.history}>
          <SectionLabel label="Recent changes" />
          {view.changes.length === 0 ? (
            <Txt variant="small" tone="muted">
              No changes yet.
            </Txt>
          ) : (
            view.changes.slice(0, 20).map((c, i) => (
              <View key={c.id}>
                {i > 0 && <Divider />}
                <ChangeRow change={c} />
              </View>
            ))
          )}
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  section: { marginBottom: space.lg, paddingVertical: space.xs },
  slab: { paddingVertical: space.sm },
  slabMain: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  slabIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  slabText: { flex: 1, minWidth: 0 },
  slabInput: {
    width: 88,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.maroonSoft,
  },
  slabInputWide: { width: 112 },
  slabInputFocused: { borderColor: colors.gold },
  slabInputError: { borderColor: colors.danger },
  slabValue: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    textAlign: 'right',
    marginRight: 2,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  slabHelper: { marginTop: space.xs, marginLeft: 36 + space.sm },
  chargeTypes: { flexDirection: 'row', gap: space.xs, marginTop: space.sm, marginLeft: 36 + space.sm },
  chargeType: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  chargeTypeActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exampleTitle: { marginBottom: space.xs },
  exampleTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.canvasDeep,
  },
  exampleTotalLabel: { textTransform: 'uppercase', letterSpacing: 0.6 },
  exampleTotalValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.gold },
  note: { marginBottom: space.md },
  history: { marginTop: space.xl },
  change: { paddingVertical: space.sm, gap: 2 },
});
