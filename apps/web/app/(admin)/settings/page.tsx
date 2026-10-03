'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, BellRing, Coins, Download, Gift, Globe, IndianRupee, Link2, Mail, MessageCircle, Percent, RotateCcw, Smartphone, Store } from 'lucide-react';
import type { AppLinkType, MessagingMode, PointsBasis, ProgramSettings, WalletDisplay } from '@lotmorewins/types';
import { LogoUpload } from '@/components/admin/image-upload';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, isUnauthenticated, useAdminQuery } from '@/lib/admin-client';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Numeric inputs are kept as strings while editing; the server validates the submitted numbers. */
interface FormState {
  messagingMode: MessagingMode;
  firstDiscount: string;
  firstValidityDays: string;
  repeatDiscount: string;
  birthdayBonus: string;
  referralDiscount: string;
  rewardGoal: string;
  rewardDiscount: string;
  ratioPoints: string;
  ratioRupees: string;
  referralPoints: string;
  purchasePoints: string;
  purchaseValidityDays: string;
  referralValidityDays: string;
  pointsBasis: PointsBasis;
  appDownloadUrl: string;
  /** Uploaded image URL, or '' for none. */
  inviteImageUrl: string;
  homePopup: 'on' | 'off';
  /** e.g. "1.1.0", or '' for every version. */
  latestAppVersion: string;
  androidAppUrl: string;
  androidAppLinkType: AppLinkType;
  iosAppUrl: string;
  iosAppLinkType: AppLinkType;
  walletDisplay: WalletDisplay;
}

function toForm(s: ProgramSettings): FormState {
  return {
    messagingMode: s.messagingMode,
    firstDiscount: String(s.firstTimeDiscount),
    firstValidityDays: String(s.firstTimeValidityDays),
    repeatDiscount: String(s.repeatDiscount),
    birthdayBonus: String(s.birthdayBonusDiscount),
    referralDiscount: String(s.referralDiscount),
    rewardGoal: String(s.referralRewardGoal),
    rewardDiscount: String(s.referralRewardDiscount),
    ratioPoints: String(s.pointsToRupees.points),
    ratioRupees: String(s.pointsToRupees.rupees),
    referralPoints: String(s.referralPointsPercentage),
    purchasePoints: String(s.purchasePointsPercentage),
    purchaseValidityDays: String(s.purchasePointsValidityDays),
    referralValidityDays: String(s.referralPointsValidityDays),
    pointsBasis: s.pointsBasis,
    appDownloadUrl: s.appDownloadUrl ?? '',
    inviteImageUrl: s.inviteImageUrl ?? '',
    homePopup: s.homePopupEnabled ? 'on' : 'off',
    latestAppVersion: s.latestAppVersion ?? '',
    androidAppUrl: s.androidAppUrl ?? '',
    androidAppLinkType: s.androidAppLinkType,
    iosAppUrl: s.iosAppUrl ?? '',
    iosAppLinkType: s.iosAppLinkType,
    walletDisplay: s.walletDisplay,
  };
}

const formatDays = (v: string) => (Number(v) > 0 ? `${formatNumber(Number(v))} day${Number(v) === 1 ? '' : 's'}` : 'No expiry');

const BASIS_LABEL: Record<PointsBasis, string> = { PAYABLE_AMOUNT: 'Payable amount', BILL_AMOUNT: 'Bill amount' };
const DISPLAY_LABEL: Record<WalletDisplay, string> = { RUPEES: 'Rupees (₹)', POINTS: 'Points' };
const MODE_LABEL: Record<MessagingMode, string> = { email: 'Email', whatsapp: 'WhatsApp' };

/** Labels used in the review dialog, in display order. */
const FIELDS: { key: keyof FormState; label: string; unit?: string; format?: (v: string) => string }[] = [
  { key: 'firstDiscount', label: 'First-time discount', unit: '%' },
  { key: 'firstValidityDays', label: 'First-time discount · Validity', format: formatDays },
  { key: 'repeatDiscount', label: 'Repeat discount', unit: '%' },
  { key: 'birthdayBonus', label: 'Birthday bonus discount', unit: '%' },
  { key: 'referralDiscount', label: 'Referral discount', unit: '%' },
  { key: 'rewardGoal', label: 'Referral reward · Successful referrals needed' },
  { key: 'rewardDiscount', label: 'Referral reward · Special discount', unit: '%' },
  { key: 'referralPoints', label: 'Referral points', unit: '%' },
  { key: 'purchasePoints', label: 'Purchase points', unit: '%' },
  { key: 'purchaseValidityDays', label: 'Purchase points · Validity', format: formatDays },
  { key: 'referralValidityDays', label: 'Referral points · Validity', format: formatDays },
  { key: 'walletDisplay', label: 'Wallet display', format: (v) => DISPLAY_LABEL[v as WalletDisplay] },
  { key: 'ratioPoints', label: 'Conversion · points' },
  { key: 'ratioRupees', label: 'Conversion · rupees', unit: '₹' },
  { key: 'pointsBasis', label: 'Points calculated on', format: (v) => BASIS_LABEL[v as PointsBasis] },
  { key: 'messagingMode', label: 'Messaging channel', format: (v) => MODE_LABEL[v as MessagingMode] },
  { key: 'appDownloadUrl', label: 'Partner app link', format: (v) => v || 'Not set' },
  { key: 'homePopup', label: 'Home popup (new version)', format: (v) => (v === 'on' ? 'Shown' : 'Hidden') },
  { key: 'latestAppVersion', label: 'Home popup · Latest app version', format: (v) => v || 'Every version' },
  { key: 'androidAppUrl', label: 'Android download link', format: (v) => v || 'Not set' },
  { key: 'androidAppLinkType', label: 'Android link type', format: (v) => (v === 'STORE' ? 'Google Play Store' : 'Direct APK download') },
  { key: 'iosAppUrl', label: 'iOS download link', format: (v) => v || 'Not set' },
  { key: 'iosAppLinkType', label: 'iOS link type', format: (v) => (v === 'STORE' ? 'Apple App Store' : 'Web app / direct link') },
  { key: 'inviteImageUrl', label: 'Invite image', format: (v) => (v ? v.split('/').pop()! : 'App logo') },
];

const SECTIONS = [
  { id: 'discounts', label: 'Discounts', icon: Percent },
  { id: 'referral-reward', label: 'Referral reward', icon: Gift },
  { id: 'rewards', label: 'Rewards & points', icon: Coins },
  { id: 'messaging', label: 'Messaging', icon: MessageCircle },
  { id: 'app', label: 'Partner app', icon: Link2 },
  { id: 'downloads', label: 'App downloads', icon: Download },
] as const;

function PercentInput({
  id,
  value,
  onChange,
  changed,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  changed: boolean;
  label: string;
}) {
  return (
    <Input
      id={id}
      aria-label={label}
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      max="100"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      suffix="%"
      className={cn('tabular text-right font-medium', changed && 'border-gold-400 bg-gold-50/50')}
    />
  );
}

function DaysInput({
  id,
  value,
  onChange,
  changed,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  changed: boolean;
  label: string;
}) {
  return (
    <Input
      id={id}
      aria-label={label}
      type="number"
      inputMode="numeric"
      step="1"
      min="0"
      max="3650"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      suffix="days"
      className={cn('tabular pr-12 text-right font-medium', changed && 'border-gold-400 bg-gold-50/50')}
    />
  );
}

function ChoiceCards<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  name: string;
  options: readonly { value: T; label: string; hint: string; icon?: React.ComponentType<{ className?: string }> }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-3 sm:grid-cols-2">
      {options.map(({ value: v, label, hint, icon: Icon }) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(v)}
            className={cn(
              'relative flex items-start gap-3 rounded-md border px-4 py-3.5 text-left transition-all',
              selected
                ? 'border-maroon-700 bg-maroon-50/50 shadow-[inset_0_0_0_1px_theme(colors.maroon.700)]'
                : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-25'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                selected ? 'border-maroon-700' : 'border-stone-300'
              )}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-maroon-700" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[13px] font-medium text-stone-900">
                {Icon && <Icon className={cn('h-4 w-4', selected ? 'text-gold-600' : 'text-stone-400')} />}
                {label}
              </span>
              <span className="mt-0.5 block text-xs text-stone-500">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const EXAMPLE_BILL = 1000;

/** Illustration only, using the unsaved form values. The server performs the real calculation. */
function PointsExample({ form }: { form: FormState }) {
  const n = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const inRupees = form.walletDisplay === 'RUPEES';
  const pointsPerRupee = n(form.ratioRupees) > 0 ? n(form.ratioPoints) / n(form.ratioRupees) : 0;
  // Payable is rounded half-up to the rupee, as the server does.
  const pays = Math.round(EXAMPLE_BILL - (EXAMPLE_BILL * n(form.referralDiscount)) / 100);
  const discount = EXAMPLE_BILL - pays;
  const base = form.pointsBasis === 'BILL_AMOUNT' ? EXAMPLE_BILL : pays;
  // Rupee worth does not depend on the ratio: points = rupees × ratio, valued back at ÷ ratio.
  const purchaseRupees = (base * n(form.purchasePoints)) / 100;
  const referralRupees = (base * n(form.referralPoints)) / 100;
  const fmt = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const earned = (rupees: number) => (inRupees ? `₹${fmt(rupees)}` : `${fmt(rupees * pointsPerRupee)} pts`);
  const rows = [
    ['Customer discount', `₹${fmt(discount)}`],
    ['Customer pays', `₹${fmt(pays)}`],
    [`${inRupees ? 'Rewards' : 'Points'} calculated on (${form.pointsBasis === 'BILL_AMOUNT' ? 'bill' : 'payable'})`, `₹${fmt(base)}`],
    ['Customer earns', earned(purchaseRupees)],
    ['Referring partner earns', earned(referralRupees)],
  ];
  return (
    <div className="rounded-md border border-gold-200 bg-gold-50/40">
      <p className="border-b border-gold-200/70 px-4 py-2.5 text-xs font-medium text-gold-800">
        Live example · ₹{fmt(EXAMPLE_BILL)} bill on a partner&apos;s referral QR
      </p>
      <dl className="divide-y divide-gold-200/50 px-4 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-stone-600">{k}</dt>
            <dd className="tabular font-medium text-stone-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: settings, error: loadError, reload, setData } = useAdminQuery(() => adminApi.getAdminSettings().then((r) => r.data), []);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const baseline = useMemo(() => (settings ? toForm(settings) : null), [settings]);
  const values = form ?? baseline;
  const changes = useMemo(
    () => (values && baseline ? FIELDS.filter((f) => values[f.key].trim() !== baseline[f.key].trim()) : []),
    [values, baseline]
  );
  const changed = (key: keyof FormState) => changes.some((c) => c.key === key);
  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...(f ?? baseline!), [key]: value }));

  const save = async () => {
    if (!values) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await adminApi.updateAdminSettings({
        messagingMode: values.messagingMode,
        firstTimeDiscount: Number(values.firstDiscount),
        firstTimeValidityDays: Number(values.firstValidityDays),
        repeatDiscount: Number(values.repeatDiscount),
        birthdayBonusDiscount: Number(values.birthdayBonus),
        referralDiscount: Number(values.referralDiscount),
        referralRewardGoal: Number(values.rewardGoal),
        referralRewardDiscount: Number(values.rewardDiscount),
        pointsToRupees: { points: Number(values.ratioPoints), rupees: Number(values.ratioRupees) },
        referralPointsPercentage: Number(values.referralPoints),
        purchasePointsPercentage: Number(values.purchasePoints),
        purchasePointsValidityDays: Number(values.purchaseValidityDays),
        referralPointsValidityDays: Number(values.referralValidityDays),
        pointsBasis: values.pointsBasis,
        appDownloadUrl: values.appDownloadUrl.trim() || null,
        inviteImageUrl: values.inviteImageUrl || null,
        homePopupEnabled: values.homePopup === 'on',
        latestAppVersion: values.latestAppVersion.trim() || null,
        androidAppUrl: values.androidAppUrl.trim() || null,
        androidAppLinkType: values.androidAppLinkType,
        iosAppUrl: values.iosAppUrl.trim() || null,
        iosAppLinkType: values.iosAppLinkType,
        walletDisplay: values.walletDisplay,
      });
      setData(() => res.data);
      setForm(null);
      setReviewing(false);
      toast('success', 'Programme settings saved', 'New bills use these values immediately.');
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else {
        setSaveError(errorMessage(err, 'Could not save settings.'));
        setReviewing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const needsFirstSave = settings && !settings.isPersisted;
  const canSave = changes.length > 0 || needsFirstSave;

  return (
    <>
      <PageHeader
        title="Programme settings"
        description="The rules the server applies to every scan, bill and points credit. Bills keep a snapshot of the values they were calculated with."
        meta={
          settings?.updatedAt && (
            <span className="text-xs text-stone-500" title={formatDateTime(settings.updatedAt)}>
              Last saved {formatRelative(settings.updatedAt)}
            </span>
          )
        }
      />

      {loadError && (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {loadError}
        </Alert>
      )}

      {!values && !loadError && (
        <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          <Skeleton className="hidden h-40 lg:block" />
          <div className="space-y-6">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        </div>
      )}

      {values && settings && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) setReviewing(true);
          }}
          className="grid gap-8 animate-rise-in lg:grid-cols-[200px_minmax(0,1fr)]"
        >
          {/* Section navigation */}
          <nav aria-label="Settings sections" className="hidden lg:block">
            <ul className="sticky top-24 space-y-0.5 border-l border-stone-150">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="-ml-px flex items-center gap-2.5 border-l-2 border-transparent py-2 pl-4 text-[13px] text-stone-500 transition-colors hover:border-gold-400 hover:text-stone-900"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 space-y-6">
            {needsFirstSave && (
              <Alert tone="warning" title="Settings have never been saved">
                Defaults are shown below, and outlets cannot create bills until you save them. Messaging uses the server&apos;s
                environment default until then.
              </Alert>
            )}
            {saveError && <Alert tone="danger">{saveError}</Alert>}

            {/* Discounts */}
            <Panel id="discounts" className="scroll-mt-24">
              <PanelHeader
                eyebrow="High impact"
                title="Discount rates"
                description="Percentage taken off the bill. Every partner gets the same rates; the rule is picked by the QR that was scanned."
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-150 text-[11px] uppercase tracking-[0.06em] text-stone-500">
                      <th className="px-5 py-2.5 text-left font-semibold">Rule</th>
                      <th className="w-36 px-3 py-2.5 text-right font-semibold">Discount</th>
                      <th className="w-36 px-5 py-2.5 text-right font-semibold">Validity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(
                      [
                        ['First-time sale', "Partner's first ever bill on their own discount QR, including customers who later register.", 'firstDiscount'],
                        ['Repeat sale', 'Every later bill on the partner’s own discount QR.', 'repeatDiscount'],
                        ['Birthday bonus', 'Added on top of the partner’s own discount on their birthday only.', 'birthdayBonus'],
                        ['Referral customer', 'A customer bringing a partner’s referral QR.', 'referralDiscount'],
                      ] as const
                    ).map(([title, hint, a]) => (
                      <tr key={title}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-stone-900">{title}</p>
                          <p className="mt-0.5 text-xs text-stone-500">{hint}</p>
                        </td>
                        <td className="px-3 py-3.5">
                          <PercentInput id={a} label={`${title} discount`} value={values[a]} onChange={set(a)} changed={changed(a)} />
                        </td>
                        <td className="px-5 py-3.5">
                          {a === 'firstDiscount' ? (
                            <>
                              <DaysInput
                                id="firstValidityDays"
                                label="First-time sale validity in days"
                                value={values.firstValidityDays}
                                onChange={set('firstValidityDays')}
                                changed={changed('firstValidityDays')}
                              />
                              <p className="mt-1 text-right text-[11px] text-stone-400">From registration · 0 = no expiry</p>
                            </>
                          ) : (
                            <p className="text-right text-stone-300">—</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Referral reward */}
            <Panel id="referral-reward" className="scroll-mt-24">
              <PanelHeader
                eyebrow="High impact"
                title="Referral reward"
                description="A successful referral is a bill a customer closes with the partner's referral QR. Reaching the goal gives the partner a special discount on their next own purchase with their Personal Discount QR; using it takes their progress back to zero, so the reward repeats for every goal reached."
              />
              <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Successful referrals needed" htmlFor="rewardGoal" hint="Shown as the progress bar in the Partner App">
                  <Input
                    id="rewardGoal"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    max="1000"
                    required
                    value={values.rewardGoal}
                    onChange={(e) => set('rewardGoal')(e.target.value)}
                    suffix="referrals"
                    className={cn('tabular pr-20 text-right font-medium', changed('rewardGoal') && 'border-gold-400 bg-gold-50/50')}
                  />
                </Field>
                <Field
                  label="Special discount"
                  htmlFor="rewardDiscount"
                  hint="Replaces the usual discount on that bill when it is higher; the birthday bonus still adds on top"
                >
                  <PercentInput
                    id="rewardDiscount"
                    label="Referral reward special discount"
                    value={values.rewardDiscount}
                    onChange={set('rewardDiscount')}
                    changed={changed('rewardDiscount')}
                  />
                </Field>
              </div>
            </Panel>

            {/* Rewards */}
            <Panel id="rewards" className="scroll-mt-24">
              <PanelHeader
                eyebrow="High impact"
                title="Rewards & points"
                description="Purchase points go to whoever buys — the partner on a direct bill, the customer's mobile on a referral bill. Referral points go to the partner whose QR brought the customer."
              />
              <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Purchase points" htmlFor="purchasePoints" hint="Of the points base">
                      <PercentInput id="purchasePoints" label="Purchase points" value={values.purchasePoints} onChange={set('purchasePoints')} changed={changed('purchasePoints')} />
                    </Field>
                    <Field label="Referral points" htmlFor="referralPoints" hint="To the referring partner">
                      <PercentInput id="referralPoints" label="Referral points" value={values.referralPoints} onChange={set('referralPoints')} changed={changed('referralPoints')} />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Purchase points validity" htmlFor="purchaseValidityDays" hint="From the bill date · 0 = no expiry">
                      <DaysInput
                        id="purchaseValidityDays"
                        label="Purchase points validity in days"
                        value={values.purchaseValidityDays}
                        onChange={set('purchaseValidityDays')}
                        changed={changed('purchaseValidityDays')}
                      />
                    </Field>
                    <Field label="Referral points validity" htmlFor="referralValidityDays" hint="From the bill date · 0 = no expiry">
                      <DaysInput
                        id="referralValidityDays"
                        label="Referral points validity in days"
                        value={values.referralValidityDays}
                        onChange={set('referralValidityDays')}
                        changed={changed('referralValidityDays')}
                      />
                    </Field>
                  </div>

                  <Field label="Wallet display" hint="How the Partner App shows wallet balances, transaction history and notifications.">
                    <ChoiceCards<WalletDisplay>
                      name="Wallet display"
                      value={values.walletDisplay}
                      onChange={set('walletDisplay') as (v: WalletDisplay) => void}
                      options={[
                        { value: 'RUPEES', label: 'Rupees', hint: 'Earnings shown directly as ₹ value', icon: IndianRupee },
                        { value: 'POINTS', label: 'Points', hint: 'Earnings shown as points, with their ₹ worth', icon: Coins },
                      ]}
                    />
                  </Field>

                  {values.walletDisplay === 'POINTS' && (
                  <Field label="Conversion rate" hint="How many points equal how many rupees when a wallet is valued.">
                    <div className="flex items-center gap-3">
                      <div className="w-32">
                        <Input
                          aria-label="Points"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          required
                          value={values.ratioPoints}
                          onChange={(e) => set('ratioPoints')(e.target.value)}
                          suffix="pts"
                          className={cn('tabular pr-11 text-right font-medium', changed('ratioPoints') && 'border-gold-400 bg-gold-50/50')}
                        />
                      </div>
                      <span className="text-sm font-medium text-stone-400">=</span>
                      <div className="w-32">
                        <Input
                          aria-label="Rupees"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          required
                          value={values.ratioRupees}
                          onChange={(e) => set('ratioRupees')(e.target.value)}
                          prefix="₹"
                          className={cn('tabular pl-8 text-right font-medium', changed('ratioRupees') && 'border-gold-400 bg-gold-50/50')}
                        />
                      </div>
                    </div>
                  </Field>
                  )}

                  <Field label="Calculate points on">
                    <ChoiceCards<PointsBasis>
                      name="Points basis"
                      value={values.pointsBasis}
                      onChange={set('pointsBasis') as (v: PointsBasis) => void}
                      options={[
                        { value: 'PAYABLE_AMOUNT', label: 'Payable amount', hint: 'Bill amount after the discount' },
                        { value: 'BILL_AMOUNT', label: 'Bill amount', hint: 'Full bill before the discount' },
                      ]}
                    />
                  </Field>
                </div>
                <div>
                  <PointsExample form={values} />
                </div>
              </div>
            </Panel>

            {/* Messaging */}
            <Panel id="messaging" className="scroll-mt-24">
              <PanelHeader
                eyebrow="System"
                title="Messaging channel"
                description="Used for every OTP and bill message. Switching channel affects all partners and outlets immediately."
              />
              <div className="px-5 py-5">
                <ChoiceCards<MessagingMode>
                  name="Messaging mode"
                  value={values.messagingMode}
                  onChange={set('messagingMode') as (v: MessagingMode) => void}
                  options={[
                    { value: 'email', label: 'Email', hint: 'Delivered through Gmail SMTP', icon: Mail },
                    { value: 'whatsapp', label: 'WhatsApp', hint: 'Delivered through MSG91', icon: MessageCircle },
                  ]}
                />
                {changed('messagingMode') && (
                  <Alert tone="warning" className="mt-4">
                    OTPs and bill messages will switch to {MODE_LABEL[values.messagingMode]} as soon as you save. Make sure that
                    provider is configured on the server.
                  </Alert>
                )}
              </div>
            </Panel>

            {/* App link */}
            <Panel id="app" className="scroll-mt-24">
              <PanelHeader
                title="Partner app link & invite"
                description="Play Store listing or download page behind the button in bill messages, and the image partners share when they invite family and friends."
              />
              <div className="space-y-5 px-5 py-5">
                <Field label="Download URL" htmlFor="appDownloadUrl" hint="Leave empty to omit the button from messages.">
                  <Input
                    id="appDownloadUrl"
                    type="url"
                    inputMode="url"
                    icon={Link2}
                    placeholder="https://play.google.com/store/apps/details?id=…"
                    value={values.appDownloadUrl}
                    onChange={(e) => set('appDownloadUrl')(e.target.value)}
                    className={cn(changed('appDownloadUrl') && 'border-gold-400 bg-gold-50/50')}
                  />
                </Field>
                <Field label="Home popup" hint="Asks partners to install the latest app version, with the download link above.">
                  <ChoiceCards<'on' | 'off'>
                    name="Home popup"
                    value={values.homePopup}
                    onChange={set('homePopup') as (v: 'on' | 'off') => void}
                    options={[
                      { value: 'on', label: 'Show popup', hint: 'Shown once each time a partner opens the app', icon: BellRing },
                      { value: 'off', label: 'Hide popup', hint: 'Partners do not see it', icon: BellOff },
                    ]}
                  />
                  {values.homePopup === 'on' && !values.appDownloadUrl.trim() && (
                    <Alert tone="warning" className="mt-3">
                      Add a download URL so the popup can link to the new version.
                    </Alert>
                  )}
                </Field>
                {values.homePopup === 'on' && (
                  <Field
                    label="Latest app version"
                    htmlFor="latestAppVersion"
                    hint="The popup shows every time the app is opened, only on phones with an older version than this (e.g. 1.1.0 for the Play Store release). Partners who install it stop seeing the popup. Leave empty to show it on every version."
                  >
                    <div className="w-40">
                      <Input
                        id="latestAppVersion"
                        inputMode="decimal"
                        placeholder="e.g. 1.1.0"
                        pattern="\d+(\.\d+){0,3}"
                        value={values.latestAppVersion}
                        onChange={(e) => set('latestAppVersion')(e.target.value)}
                        className={cn('tabular font-medium', changed('latestAppVersion') && 'border-gold-400 bg-gold-50/50')}
                      />
                    </div>
                  </Field>
                )}
                <Field
                  label="Invite image"
                  hint="Attached to the invite message and download link that partners share from the Partner App home page. Without one, the app logo is attached. Saved as WebP under 1 MB."
                >
                  <div className={cn('inline-block rounded-md', changed('inviteImageUrl') && 'ring-2 ring-gold-400 ring-offset-2')}>
                    <LogoUpload label="image" value={values.inviteImageUrl || null} onChange={(url) => set('inviteImageUrl')(url ?? '')} />
                  </div>
                </Field>
              </div>
            </Panel>

            {/* App downloads */}
            <Panel id="downloads" className="scroll-mt-24">
              <PanelHeader
                title="App downloads"
                description="Where partners download the Partner App on each platform. The landing page download buttons and the Android update popup use these links."
              />
              <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
                {(
                  [
                    {
                      platform: 'Android',
                      icon: Smartphone,
                      url: 'androidAppUrl',
                      type: 'androidAppLinkType',
                      placeholder: 'https://play.google.com/store/apps/details?id=com.lotmorewins.partner',
                      hint: 'Leave empty if not available yet. Google Drive and Dropbox share links are turned into a direct APK download automatically.',
                      direct: { label: 'Direct APK download', hint: 'A link to the .apk file', icon: Download },
                      store: { label: 'Google Play Store', hint: 'The app listing on Google Play', icon: Store },
                    },
                    {
                      platform: 'iPhone (iOS)',
                      icon: Smartphone,
                      url: 'iosAppUrl',
                      type: 'iosAppLinkType',
                      placeholder: 'https://apps.apple.com/… or the Partner App web address',
                      hint: 'Leave empty if not available yet.',
                      direct: { label: 'Web app / direct link', hint: 'iPhones cannot install APKs: e.g. the web version to add to the Home Screen', icon: Globe },
                      store: { label: 'Apple App Store', hint: 'The app listing on the App Store', icon: Store },
                    },
                  ] as const
                ).map((p) => (
                  <div key={p.platform} className="space-y-4 rounded-md border border-stone-150 p-4">
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-stone-900">
                      <p.icon className="h-4 w-4 text-gold-600" /> {p.platform}
                    </p>
                    <Field label="Download link" htmlFor={p.url} hint={p.hint}>
                      <Input
                        id={p.url}
                        type="url"
                        inputMode="url"
                        icon={Link2}
                        placeholder={p.placeholder}
                        value={values[p.url]}
                        onChange={(e) => set(p.url)(e.target.value)}
                        className={cn(changed(p.url) && 'border-gold-400 bg-gold-50/50')}
                      />
                    </Field>
                    <Field label="This link is">
                      <ChoiceCards<AppLinkType>
                        name={`${p.platform} link type`}
                        value={values[p.type]}
                        onChange={set(p.type) as (v: AppLinkType) => void}
                        options={[
                          { value: 'DIRECT', ...p.direct },
                          { value: 'STORE', ...p.store },
                        ]}
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Save bar */}
            <div
              className={cn(
                'sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-5 py-3 transition-all',
                canSave ? 'border-[#5C0404] bg-brand-gradient text-white shadow-raised' : 'border-stone-150 bg-white text-stone-500'
              )}
            >
              <p className="text-[13px]">
                {changes.length > 0 ? (
                  <>
                    <span className="font-semibold text-gold-300">{changes.length}</span> unsaved change{changes.length === 1 ? '' : 's'}
                  </>
                ) : needsFirstSave ? (
                  'Save to activate billing with these values.'
                ) : (
                  'All changes saved.'
                )}
              </p>
              <div className="flex gap-2">
                {changes.length > 0 && (
                  <Button type="button" variant="ghost" className="text-maroon-100 hover:bg-white/10 hover:text-white" onClick={() => setForm(null)}>
                    <RotateCcw className="h-4 w-4" /> Discard
                  </Button>
                )}
                <Button type="submit" variant={canSave ? 'gold' : 'secondary'} disabled={!canSave}>
                  Review & save
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        onConfirm={save}
        busy={saving}
        title="Apply new programme settings?"
        confirmLabel="Save settings"
        description="New bills use these values immediately. Existing bills keep the values they were created with."
      >
        {changes.length > 0 ? (
          <ul className="max-h-60 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-150 text-xs">
            {changes.map((c) => {
              const fmt = (v: string) => (c.format ? c.format(v) : `${c.unit === '₹' ? '₹' : ''}${formatNumber(Number(v))}${c.unit === '%' ? '%' : ''}`);
              return (
                <li key={c.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-stone-600">{c.label}</span>
                  <span className="tabular whitespace-nowrap">
                    <span className="text-stone-400 line-through">{fmt(baseline![c.key])}</span>
                    <span className="mx-1.5 text-stone-300">→</span>
                    <span className="font-semibold text-maroon-800">{fmt(values![c.key])}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-stone-500">No values changed — this saves the defaults so outlets can start billing.</p>
        )}
      </ConfirmDialog>
    </>
  );
}
