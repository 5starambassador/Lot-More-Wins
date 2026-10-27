import { useEffect, useState, type ComponentProps } from 'react';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { outletOffersUpdateSchema } from '@lotmorewins/validation';
import type { OutletOfferChangeRecord, OutletSettingsView, UpdateOutletOffersPayload } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Button, Divider, FullScreenLoader, InfoRow, Notice, Panel, Screen, SectionLabel, StateView, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import apiClient, { describeError, isAuthError } from '../../lib/api';
import { formatDateTime, formatINR, formatPercent } from '../../lib/format';
import { useSession } from '../../store/session-store';
import { colors, fonts, radius, space } from '../../theme/tokens';

/**
 * This outlet's slabs, edited by the Outlet Admin: GST, the first-bill and repeat-bill partner
 * discounts, cashback (the purchase reward credited to the partner's wallet), the referring
 * partner's reward and the referred guest's bill discount. Each slab is one rate for every partner
 * (Achariya and Non-Achariya alike). On a bill the discount comes off the product total first and
 * GST is charged on what remains. A discount is never more than half the bill. Every change is
 * audit-logged on the server and applies to the next bill.
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
    hint: "Of each bill, credited to the partner's wallet",
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
    hint: 'Charged on the bill after the discount',
    icon: 'document-text-outline',
    fields: ['gstPercentage'],
  },
];

const SLABS = [...PARTNER_SLABS, ...REFERRAL_SLABS, ...TAX_SLABS];

const FIELD_LABELS: Record<string, string> = {
  firstTimeDiscount: 'First bill discount',
  achariyaFirstTimeDiscount: 'First bill discount (Achariya)',
  repeatDiscount: 'Repeat bill discount',
  referralDiscount: 'Referred guest discount',
  gstPercentage: 'GST',
  purchasePointsPercentage: 'Cashback',
  referralPointsPercentage: 'Referring partner reward',
  achariyaReferralPointsPercentage: 'Referring partner reward (Achariya)',
  cashRewardPurchasePercentage: 'Purchase cash reward',
  cashRewardReferralPercentage: 'Referral cash reward',
  givesCashReward: 'Cash reward',
  canEditOffers: 'Outlet can edit offers',
};

type FormState = Record<SlabKey, string>;

/** The rate each field resolves to at this outlet (its override, or the programme value). */
function currentValue(view: OutletSettingsView, field: OfferField): number {
  if (field === 'gstPercentage') return view.offers.gstPercentage;
  if (field in view.effectiveDiscounts) return view.effectiveDiscounts[field as keyof OutletSettingsView['effectiveDiscounts']];
  return view.effectiveRewards[field as keyof OutletSettingsView['effectiveRewards']];
}

const toForm = (view: OutletSettingsView): FormState =>
  Object.fromEntries(SLABS.map((s) => [s.key, String(currentValue(view, s.fields[0]))])) as FormState;

/** A slab that writes two fields whose saved values differ (e.g. set separately by the Super Admin earlier). */
function splitNote(view: OutletSettingsView, slab: Slab): string | null {
  if (slab.fields.length < 2) return null;
  const [main, other] = slab.fields.map((f) => currentValue(view, f));
  return main === other ? null : `Achariya partners get ${formatPercent(other)} now. Saving this slab sets one rate for all partners.`;
}

const cleanNumber = (t: string) => t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

function changeValue(field: string, value: string | null): string {
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

/** One slab: icon, name and what it does on the left, the percentage input on the right. */
function SlabRow({
  slab,
  value,
  error,
  note,
  editable,
  onChange,
}: {
  slab: Slab;
  value: string;
  error?: string;
  note: string | null;
  editable: boolean;
  onChange: (value: string) => void;
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
            {slab.hint}
          </Txt>
        </View>
        <View style={[styles.slabInput, focused && styles.slabInputFocused, !!error && styles.slabInputError]}>
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
            maxLength={5}
            style={styles.slabValue}
            accessibilityLabel={`${slab.label} percentage`}
          />
          <Txt variant="bodyMedium" tone="secondary">
            %
          </Txt>
        </View>
      </View>
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
 * How a first bill comes out with the slabs as typed: discount off the product total, then GST
 * on the rest. Illustration only (same rounding as the server); real bills are always calculated
 * by the server.
 */
function ExampleBill({ discount, gst }: { discount: number; gst: number }) {
  const subtotal = 1000;
  const afterDiscount = Math.round(subtotal - (subtotal * Math.min(discount, 50)) / 100);
  const gstAmount = Math.round(afterDiscount * gst) / 100;
  const exact = afterDiscount + gstAmount;
  const netTotal = Math.round(exact);
  const roundOff = Math.round((netTotal - exact) * 100) / 100;
  return (
    <Panel accent style={styles.section}>
      <Txt variant="overline" tone="gold" style={styles.exampleTitle}>
        Example · first bill of {formatINR(subtotal)}
      </Txt>
      <InfoRow label="Product total" value={formatINR(subtotal)} />
      <InfoRow label={`Discount (${formatPercent(discount)})`} value={`− ${formatINR(subtotal - afterDiscount)}`} tone="success" />
      <InfoRow label={`GST (${formatPercent(gst)}) on ${formatINR(afterDiscount)}`} value={`+ ${formatINR(gstAmount)}`} />
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
  const [errors, setErrors] = useState<Partial<Record<SlabKey, string>>>({});
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
  const dirty = SLABS.some((s) => form[s.key] !== initial[s.key]);

  const onSave = () => {
    setMessage(null);
    const errs: Partial<Record<SlabKey, string>> = {};
    const payload: Record<string, number> = {};
    for (const slab of SLABS) {
      // A slab is saved when its value changed, or when it would bring split rates back to one.
      if (form[slab.key] === initial[slab.key] && !splitNote(view, slab)) continue;
      if (form[slab.key] === '') {
        errs[slab.key] = 'Enter a percentage (0 for none)';
        continue;
      }
      for (const field of slab.fields) payload[field] = Number(form[slab.key]);
    }
    const parsed = outletOffersUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const slab = SLABS.find((s) => s.fields.includes(issue.path[0] as OfferField));
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

  const renderSlabs = (slabs: Slab[]) => (
    <Panel style={styles.section}>
      {slabs.map((slab, i) => (
        <View key={slab.key}>
          {i > 0 && <Divider />}
          <SlabRow
            slab={slab}
            value={form[slab.key]}
            error={errors[slab.key]}
            note={splitNote(view, slab)}
            editable={!save.isPending}
            onChange={(value) => setForm({ ...form, [slab.key]: value })}
          />
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
            Discounts, cashback and GST for this outlet
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

        <SectionLabel label="Tax" />
        {renderSlabs(TAX_SLABS)}

        <ExampleBill discount={Number(form.firstBill) || 0} gst={Number(form.gst) || 0} />

        <Txt variant="caption" tone="muted" style={styles.note}>
          Partners see this outlet as “{view.summary.label}”. A discount is never more than half the bill. Changes apply to the next bill.
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
