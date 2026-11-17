'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, Store } from 'lucide-react';
import type { AdminOutlet, DiscountType, OutletSlabKey, OutletSlabTypes, ServiceChargeType } from '@lotmorewins/types';
import {
  DEFAULT_WALLET_REDEEM_CAP_PERCENT,
  MAX_FLAT_DISCOUNT_RUPEES,
  MAX_MIN_BILL_RUPEES,
  MAX_OUTLET_IMAGES,
  MAX_SERVICE_CHARGE_PERCENT,
  MAX_SERVICE_CHARGE_RUPEES,
  OUTLET_SLABS,
  normalizeIndianMobile,
} from '@lotmorewins/validation';
import { Button, buttonClass } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';
import { GalleryUpload, LogoUpload } from './image-upload';

export interface OutletFormValues {
  name: string;
  email: string;
  mobile: string;
  description: string;
  address: string;
  mapUrl: string;
  logoUrl: string | null;
  images: string[];
  adminEmail: string;
  adminPassword: string;
  /** Offer fields as typed: '' = use the programme setting (discounts, rates) or 0 (GST). */
  firstTimeDiscount: string;
  achariyaFirstTimeDiscount: string;
  repeatDiscount: string;
  referralDiscount: string;
  /** Each slab's type: PERCENTAGE uses the % fields, FIXED its flat ₹ amount below. */
  slabTypes: OutletSlabTypes;
  /** Each slab's flat ₹ amount as typed ('' = 0). */
  flat: Record<OutletSlabKey, string>;
  /** Bills below this get no discount; '' or 0 = no minimum. */
  minBillAmount: string;
  walletRedemptionEnabled: boolean;
  /** Maximum wallet redemption: a % of the bill (default 50) or a flat ₹ per bill. */
  walletRedeemCapType: DiscountType;
  walletRedeemCapValue: string;
  /** First referral bonus: ₹ amount + % of the bill on a partner's first referral bill here ('' or 0 = none). */
  firstReferralBonusAmount: string;
  firstReferralBonusPercentage: string;
  gstPercentage: string;
  /** Service charge: a % of the discounted amount or a fixed ₹ per bill; '' or 0 = none. */
  serviceChargeType: ServiceChargeType;
  serviceChargeValue: string;
  purchasePointsPercentage: string;
  referralPointsPercentage: string;
  achariyaReferralPointsPercentage: string;
  cashRewardPurchasePercentage: string;
  cashRewardReferralPercentage: string;
  givesCashReward: boolean;
  canEditOffers: boolean;
}

export const DISCOUNT_FIELDS = [
  { key: 'firstTimeDiscount', label: 'First purchase (Non-Achariya)' },
  { key: 'achariyaFirstTimeDiscount', label: 'First purchase (Achariya)' },
  { key: 'repeatDiscount', label: 'Repeat purchase' },
  { key: 'referralDiscount', label: 'Referred friend (referral QR)' },
] as const;

type DiscountKey = (typeof DISCOUNT_FIELDS)[number]['key'];

/** Points and cashback rates (credited into the partner's wallet). Cashback rates apply only while cashback is on. */
export const REWARD_FIELDS = [
  { key: 'purchasePointsPercentage', label: 'Purchase points', cashback: false },
  { key: 'referralPointsPercentage', label: 'Referral points (Non-Achariya)', cashback: false },
  { key: 'achariyaReferralPointsPercentage', label: 'Referral points (Achariya)', cashback: false },
  { key: 'cashRewardPurchasePercentage', label: 'Purchase cashback', cashback: true },
  { key: 'cashRewardReferralPercentage', label: 'Referral cashback', cashback: true },
] as const;

type RewardKey = (typeof REWARD_FIELDS)[number]['key'];
type PercentKey = DiscountKey | RewardKey;

/** Every slab with a % or flat ₹ choice, in form order, with what each means. */
export const SLAB_INFO: Record<OutletSlabKey, { label: string; flatHint: string; cashback?: boolean }> = {
  firstTimeDiscount: { label: 'First purchase discount', flatHint: 'Most ₹ off a first bill; the Outlet Admin picks the amount per bill.' },
  repeatDiscount: { label: 'Repeat purchase discount', flatHint: 'Most ₹ off a repeat bill; the Outlet Admin picks the amount per bill.' },
  referralDiscount: { label: 'Referred friend discount', flatHint: "Most ₹ off a referred friend's bill; picked per bill." },
  purchasePoints: { label: 'Purchase points', flatHint: '₹ worth of points per bill (never more than the bill).' },
  referralPoints: { label: 'Referral points', flatHint: "₹ worth of points to the referrer per referred friend's bill." },
  cashRewardPurchase: { label: 'Purchase cashback', flatHint: '₹ cashback per bill (never more than the bill).', cashback: true },
  cashRewardReferral: { label: 'Referral cashback', flatHint: "₹ cashback to the referrer per referred friend's bill.", cashback: true },
};

const PERCENT_LABEL: Record<PercentKey, string> = Object.fromEntries(
  [...DISCOUNT_FIELDS, ...REWARD_FIELDS].map(({ key, label }) => [key, label])
) as Record<PercentKey, string>;

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** The offer fields of the form as the API payload: a blank discount is null (programme setting). */
export function offerPayload(values: OutletFormValues) {
  const discount = (v: string) => (v.trim() === '' ? null : Number(v));
  const rupees = (v: string) => (v.trim() === '' ? 0 : Number(v));
  return {
    firstTimeDiscount: discount(values.firstTimeDiscount),
    achariyaFirstTimeDiscount: discount(values.achariyaFirstTimeDiscount),
    repeatDiscount: discount(values.repeatDiscount),
    referralDiscount: discount(values.referralDiscount),
    ...Object.fromEntries(OUTLET_SLABS.map((s) => [s.typeField, values.slabTypes[s.key]])),
    ...Object.fromEntries(OUTLET_SLABS.map((s) => [s.flatField, rupees(values.flat[s.key])])),
    minBillAmount: rupees(values.minBillAmount),
    walletRedemptionEnabled: values.walletRedemptionEnabled,
    walletRedeemCapType: values.walletRedeemCapType,
    walletRedeemCapValue: rupees(values.walletRedeemCapValue),
    firstReferralBonusAmount: rupees(values.firstReferralBonusAmount),
    firstReferralBonusPercentage: rupees(values.firstReferralBonusPercentage),
    gstPercentage: values.gstPercentage.trim() === '' ? 0 : Number(values.gstPercentage),
    serviceChargeType: values.serviceChargeType,
    serviceChargeValue: values.serviceChargeValue.trim() === '' ? 0 : Number(values.serviceChargeValue),
    purchasePointsPercentage: discount(values.purchasePointsPercentage),
    referralPointsPercentage: discount(values.referralPointsPercentage),
    achariyaReferralPointsPercentage: discount(values.achariyaReferralPointsPercentage),
    cashRewardPurchasePercentage: discount(values.cashRewardPurchasePercentage),
    cashRewardReferralPercentage: discount(values.cashRewardReferralPercentage),
    givesCashReward: values.givesCashReward,
    canEditOffers: values.canEditOffers,
  };
}

export function emptyOutletForm(outlet?: AdminOutlet): OutletFormValues {
  const offers = outlet?.offers;
  return {
    name: outlet?.name ?? '',
    email: outlet?.email ?? '',
    mobile: outlet?.mobile ?? '',
    description: outlet?.description ?? '',
    address: outlet?.address ?? '',
    mapUrl: outlet?.mapUrl ?? '',
    logoUrl: outlet?.logoUrl ?? null,
    images: outlet?.images ?? [],
    adminEmail: outlet?.adminEmail ?? '',
    adminPassword: '',
    firstTimeDiscount: pct(offers?.firstTimeDiscount),
    achariyaFirstTimeDiscount: pct(offers?.achariyaFirstTimeDiscount),
    repeatDiscount: pct(offers?.repeatDiscount),
    referralDiscount: pct(offers?.referralDiscount),
    slabTypes: Object.fromEntries(
      OUTLET_SLABS.map((s) => [s.key, (offers?.[s.typeField] as DiscountType | undefined) ?? 'PERCENTAGE'])
    ) as OutletSlabTypes,
    flat: Object.fromEntries(OUTLET_SLABS.map((s) => [s.key, String(offers?.[s.flatField] ?? 0)])) as Record<OutletSlabKey, string>,
    minBillAmount: String(offers?.minBillAmount ?? 0),
    walletRedemptionEnabled: offers?.walletRedemptionEnabled ?? true,
    walletRedeemCapType: offers?.walletRedeemCapType ?? 'PERCENTAGE',
    walletRedeemCapValue: String(offers?.walletRedeemCapValue ?? DEFAULT_WALLET_REDEEM_CAP_PERCENT),
    firstReferralBonusAmount: String(offers?.firstReferralBonusAmount ?? 0),
    firstReferralBonusPercentage: String(offers?.firstReferralBonusPercentage ?? 0),
    gstPercentage: outlet ? String(outlet.offers.gstPercentage) : '0',
    serviceChargeType: offers?.serviceChargeType ?? 'PERCENTAGE',
    serviceChargeValue: outlet ? String(outlet.offers.serviceChargeValue ?? 0) : '0',
    purchasePointsPercentage: pct(offers?.purchasePointsPercentage),
    referralPointsPercentage: pct(offers?.referralPointsPercentage),
    achariyaReferralPointsPercentage: pct(offers?.achariyaReferralPointsPercentage),
    cashRewardPurchasePercentage: pct(offers?.cashRewardPurchasePercentage),
    cashRewardReferralPercentage: pct(offers?.cashRewardReferralPercentage),
    givesCashReward: offers?.givesCashReward ?? false,
    canEditOffers: offers?.canEditOffers ?? false,
  };
}

/** Percentage or flat ₹: the radio pair every slab (and the service charge) uses. */
export function TypeRadios({
  name,
  value,
  onChange,
  flatLabel = 'Flat ₹',
}: {
  name: string;
  value: DiscountType;
  onChange: (type: DiscountType) => void;
  flatLabel?: string;
}) {
  return (
    <div className="inline-flex rounded-md border border-stone-200 p-0.5" role="radiogroup" aria-label={`${name} type`}>
      {(
        [
          { v: 'PERCENTAGE', label: 'Percentage %' },
          { v: 'FIXED', label: flatLabel },
        ] as const
      ).map((o) => (
        <label
          key={o.v}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium',
            value === o.v ? 'bg-maroon-50 text-maroon-800' : 'text-stone-500 hover:text-stone-800'
          )}
        >
          <input
            type="radio"
            name={`${name}-type`}
            value={o.v}
            checked={value === o.v}
            onChange={() => onChange(o.v)}
            className="h-3.5 w-3.5 accent-maroon-700"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function OutletLogo({ outlet, size = 'md' }: { outlet: Pick<AdminOutlet, 'logoUrl' | 'name'>; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-14 w-14' : 'h-9 w-9';
  if (outlet.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={outlet.logoUrl} alt="" className={cn(box, 'shrink-0 rounded-md border border-stone-150 object-cover')} />;
  }
  return (
    <div className={cn(box, 'flex shrink-0 items-center justify-center rounded-md border border-stone-150 bg-stone-50 text-stone-400')}>
      <Store className={size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'} />
    </div>
  );
}

/** One labelled group of a long form: description on the left, fields on the right. */
function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-5 px-5 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">{description}</p>
      </div>
      <div className="min-w-0 max-w-2xl">{children}</div>
    </div>
  );
}

const MOBILE = /^[6-9]\d{9}$/;

/** A percentage as typed: 0 to max with up to 2 decimals. */
const validPercent = (v: string, max = 100) => /^\d{1,3}(\.\d{1,2})?$/.test(v.trim()) && Number(v) <= max;

export function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-150 px-3 py-2.5 hover:bg-stone-50">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-maroon-700"
      />
      <span>
        <span className="block text-[13px] font-medium text-stone-900">{label}</span>
        <span className="block text-xs text-stone-500">{hint}</span>
      </span>
    </label>
  );
}

/**
 * Create mode collects the Outlet Admin login; edit mode only offers an optional password reset.
 */
export function OutletForm({
  mode,
  initial,
  submitting,
  error,
  onSubmit,
  cancelHref = '/outlets',
  programme,
}: {
  mode: 'create' | 'edit';
  initial: OutletFormValues;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: OutletFormValues) => void;
  cancelHref?: string;
  /** Programme discounts and rates a blank override falls back to, shown as hints (edit mode). */
  programme?: Partial<Record<PercentKey, number>>;
}) {
  const [values, setValues] = useState(initial);
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(mode === 'create');
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof OutletFormValues>(key: K, value: OutletFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const text = (key: 'name' | 'email' | 'mobile' | 'address' | 'mapUrl' | 'adminEmail' | 'adminPassword') => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
  });

  const errors = useMemo(() => {
    const e: Partial<Record<keyof OutletFormValues | `flat.${OutletSlabKey}`, string>> = {};
    if (values.name.trim().length < 2) e.name = 'Enter the outlet name (at least 2 characters).';
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) e.email = 'Enter a valid email address.';
    if (!MOBILE.test(normalizeIndianMobile(values.mobile))) e.mobile = 'Enter a 10-digit Indian mobile number.';
    if (values.mapUrl.trim() && !/^https?:\/\/\S+$/i.test(values.mapUrl.trim())) e.mapUrl = 'Enter a link starting with http:// or https://.';
    if (mode === 'create' && !/^\S+@\S+\.\S+$/.test(values.adminEmail.trim())) e.adminEmail = 'Enter the login email.';
    if ((mode === 'create' || (resetting && values.adminPassword)) && values.adminPassword.length < 8) {
      e.adminPassword = 'Use at least 8 characters.';
    }
    if (mode === 'edit' && resetting && !values.adminPassword) e.adminPassword = 'Enter the new password or cancel the reset.';
    // A bill is never reduced by more than half: no discount rate above 50%.
    for (const slab of OUTLET_SLABS) {
      if (SLAB_INFO[slab.key].cashback && !values.givesCashReward) continue;
      if (values.slabTypes[slab.key] === 'FIXED') {
        const v = values.flat[slab.key].trim();
        const ok =
          !v ||
          (slab.kind === 'discount' ? /^\d{1,6}$/.test(v) : /^\d{1,6}(\.\d{1,2})?$/.test(v)) && Number(v) <= MAX_FLAT_DISCOUNT_RUPEES;
        if (!ok) {
          e[`flat.${slab.key}`] =
            slab.kind === 'discount' ? `Enter whole rupees, ₹0–${MAX_FLAT_DISCOUNT_RUPEES}.` : `Enter ₹0–${MAX_FLAT_DISCOUNT_RUPEES}, up to 2 decimals.`;
        }
      } else {
        for (const key of slab.percentFields) {
          const max = slab.kind === 'discount' ? 50 : 100;
          if (values[key].trim() && !validPercent(values[key], max)) e[key] = `Enter 0–${max} with up to 2 decimals, or leave blank.`;
        }
      }
    }
    const minBill = values.minBillAmount.trim();
    if (minBill && !(/^\d{1,7}(\.\d{1,2})?$/.test(minBill) && Number(minBill) <= MAX_MIN_BILL_RUPEES)) {
      e.minBillAmount = `Enter ₹0–${MAX_MIN_BILL_RUPEES} with up to 2 decimals.`;
    }
    const cap = values.walletRedeemCapValue.trim();
    if (!cap) e.walletRedeemCapValue = values.walletRedeemCapType === 'PERCENTAGE' ? 'Enter 0–100.' : 'Enter the ₹ amount.';
    else if (
      values.walletRedeemCapType === 'PERCENTAGE'
        ? !validPercent(cap, 100)
        : !(/^\d{1,6}(\.\d{1,2})?$/.test(cap) && Number(cap) <= MAX_FLAT_DISCOUNT_RUPEES)
    ) {
      e.walletRedeemCapValue =
        values.walletRedeemCapType === 'PERCENTAGE'
          ? 'Enter 0–100 with up to 2 decimals.'
          : `Enter ₹0–${MAX_FLAT_DISCOUNT_RUPEES} with up to 2 decimals.`;
    }
    const bonusAmount = values.firstReferralBonusAmount.trim();
    if (bonusAmount && !(/^\d{1,6}(\.\d{1,2})?$/.test(bonusAmount) && Number(bonusAmount) <= MAX_FLAT_DISCOUNT_RUPEES)) {
      e.firstReferralBonusAmount = `Enter ₹0–${MAX_FLAT_DISCOUNT_RUPEES} with up to 2 decimals.`;
    }
    if (values.firstReferralBonusPercentage.trim() && !validPercent(values.firstReferralBonusPercentage, 100)) {
      e.firstReferralBonusPercentage = 'Enter 0–100 with up to 2 decimals.';
    }
    if (values.gstPercentage.trim() && !validPercent(values.gstPercentage, 50)) e.gstPercentage = 'Enter 0–50 with up to 2 decimals.';
    const charge = values.serviceChargeValue.trim();
    if (charge) {
      const ok =
        values.serviceChargeType === 'PERCENTAGE'
          ? validPercent(charge, MAX_SERVICE_CHARGE_PERCENT)
          : /^\d{1,5}(\.\d{1,2})?$/.test(charge) && Number(charge) <= MAX_SERVICE_CHARGE_RUPEES;
      if (!ok) {
        e.serviceChargeValue =
          values.serviceChargeType === 'PERCENTAGE'
            ? `Enter 0–${MAX_SERVICE_CHARGE_PERCENT} with up to 2 decimals.`
            : `Enter ₹0–${MAX_SERVICE_CHARGE_RUPEES} with up to 2 decimals.`;
      }
    }
    return e;
  }, [values, mode, resetting]);

  const dirty = useMemo(
    () =>
      mode === 'create' ||
      JSON.stringify({ ...values, adminPassword: '' }) !== JSON.stringify({ ...initial, adminPassword: '' }) ||
      (resetting && values.adminPassword.length > 0),
    [values, initial, mode, resetting]
  );
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (Object.keys(errors).length) return;
        onSubmit({
          ...values,
          adminPassword: resetting ? values.adminPassword : '',
        });
      }}
    >
      <Panel className="divide-y divide-stone-150">
        <FormSection title="Outlet profile" description="Shown to partners in the Partner App while the outlet is active.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Outlet name" htmlFor="name" required error={show('name')} className="sm:col-span-2">
              <Input {...text('name')} maxLength={120} placeholder="e.g. Green Leaf Café, Anna Nagar" aria-invalid={!!show('name')} />
            </Field>
            <Field label="Contact email" htmlFor="email" required error={show('email')} hint="Public contact for partners.">
              <Input {...text('email')} type="email" placeholder="outlet@example.com" aria-invalid={!!show('email')} />
            </Field>
            <Field label="Mobile" htmlFor="mobile" required error={show('mobile')}>
              <Input {...text('mobile')} type="tel" inputMode="numeric" prefix="+91" placeholder="9876543210" aria-invalid={!!show('mobile')} />
            </Field>
            <Field label="Description" htmlFor="description" hint="A short introduction shown on the outlet's page." className="sm:col-span-2">
              <textarea
                id="description"
                name="description"
                rows={3}
                maxLength={1000}
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="What the outlet offers, opening hours, anything partners should know."
                className="block w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-900 placeholder:text-stone-400 focus:border-maroon-700 focus:outline-none focus:ring-1 focus:ring-maroon-700"
              />
            </Field>
            <Field label="Address" htmlFor="address" hint="Shown as the outlet's location." className="sm:col-span-2">
              <Input {...text('address')} maxLength={300} placeholder="Door no., street, area, city, pincode" />
            </Field>
            <Field label="Map link" htmlFor="mapUrl" error={show('mapUrl')} hint="Optional. The address is searched in Maps when empty." className="sm:col-span-2">
              <Input {...text('mapUrl')} type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" aria-invalid={!!show('mapUrl')} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Branding" description={`A square logo and up to ${MAX_OUTLET_IMAGES} photos. JPEG, PNG or WebP, under 3 MB each.`}>
          <div className="space-y-5">
            <Field label="Logo">
              <LogoUpload value={values.logoUrl} onChange={(url) => set('logoUrl', url)} />
            </Field>
            <Field label="Photos" hint={`${values.images.length} of ${MAX_OUTLET_IMAGES} added`}>
              <GalleryUpload value={values.images} onChange={(urls) => set('images', urls)} />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Offers, service charge & GST"
          description="Each slab is a percentage or a flat ₹ amount. Leave a % blank to use the programme setting. A discount is at most 50% (a bill is never reduced by more than half); a flat discount is the most the Outlet Admin may give, picked on each bill. The first-time discount applies to a partner's first bill at this outlet, and that bill earns no purchase points or cashback; repeat bills do. The service charge is added to the discounted amount, then GST is charged on both. Every change is logged."
        >
          <div className="space-y-3">
            {OUTLET_SLABS.filter((s) => !SLAB_INFO[s.key].cashback || values.givesCashReward).map((slab) => {
              const info = SLAB_INFO[slab.key];
              const type = values.slabTypes[slab.key];
              const flatError = show(`flat.${slab.key}`);
              return (
                <div key={slab.key} className="rounded-md border border-stone-150 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-stone-900">{info.label}</p>
                    <TypeRadios
                      name={slab.key}
                      value={type}
                      onChange={(t) => setValues((v) => ({ ...v, slabTypes: { ...v.slabTypes, [slab.key]: t } }))}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {type === 'FIXED' ? (
                      <Field label={slab.kind === 'discount' ? 'Up to ₹' : '₹ per bill'} htmlFor={`flat-${slab.key}`} error={flatError} hint={info.flatHint}>
                        <Input
                          id={`flat-${slab.key}`}
                          inputMode={slab.kind === 'discount' ? 'numeric' : 'decimal'}
                          prefix="₹"
                          value={values.flat[slab.key]}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              flat: {
                                ...v.flat,
                                [slab.key]: e.target.value.replace(slab.kind === 'discount' ? /[^0-9]/g : /[^0-9.]/g, ''),
                              },
                            }))
                          }
                          placeholder="0"
                          aria-invalid={!!flatError}
                        />
                      </Field>
                    ) : (
                      slab.percentFields.map((key) => (
                        <Field
                          key={key}
                          label={`${PERCENT_LABEL[key]} %`}
                          htmlFor={key}
                          error={show(key)}
                          hint={programme?.[key] !== undefined ? `Blank = programme setting (${programme[key]}%)` : 'Blank = programme setting'}
                        >
                          <Input
                            id={key}
                            name={key}
                            inputMode="decimal"
                            value={values[key]}
                            onChange={(e) => set(key, e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder={programme?.[key] !== undefined ? String(programme[key]) : 'Programme setting'}
                            aria-invalid={!!show(key)}
                          />
                        </Field>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            <div className="rounded-md border border-stone-150 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-stone-900">Service charge</p>
                <TypeRadios
                  name="serviceCharge"
                  value={values.serviceChargeType}
                  flatLabel="Fixed ₹"
                  onChange={(t) => set('serviceChargeType', t)}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field
                  label={values.serviceChargeType === 'PERCENTAGE' ? 'Service charge %' : 'Service charge ₹'}
                  htmlFor="serviceChargeValue"
                  error={show('serviceChargeValue')}
                  hint={
                    values.serviceChargeType === 'PERCENTAGE'
                      ? '% of the discounted amount, added before GST. 0 = none.'
                      : 'Fixed ₹ on every bill, added before GST. 0 = none.'
                  }
                >
                  <Input
                    id="serviceChargeValue"
                    name="serviceChargeValue"
                    inputMode="decimal"
                    prefix={values.serviceChargeType === 'FIXED' ? '₹' : undefined}
                    value={values.serviceChargeValue}
                    onChange={(e) => set('serviceChargeValue', e.target.value)}
                    placeholder="0"
                    aria-invalid={!!show('serviceChargeValue')}
                  />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GST %" htmlFor="gstPercentage" error={show('gstPercentage')} hint="A tax rate, so always a %. 0 = no GST on the bill.">
                <Input
                  id="gstPercentage"
                  name="gstPercentage"
                  inputMode="decimal"
                  value={values.gstPercentage}
                  onChange={(e) => set('gstPercentage', e.target.value)}
                  placeholder="0"
                  aria-invalid={!!show('gstPercentage')}
                />
              </Field>
              <Field
                label="Minimum bill for a discount"
                htmlFor="minBillAmount"
                error={show('minBillAmount')}
                hint="Bills below this get no discount (% or flat). 0 = no minimum."
              >
                <Input
                  id="minBillAmount"
                  name="minBillAmount"
                  inputMode="decimal"
                  prefix="₹"
                  value={values.minBillAmount}
                  onChange={(e) => set('minBillAmount', e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  aria-invalid={!!show('minBillAmount')}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <Toggle
                id="walletRedemptionEnabled"
                label="Wallet redemption available"
                hint="Partners can pay part of a bill here with a wallet redeem QR. Off: this outlet is greyed out when partners generate a redeem QR."
                checked={values.walletRedemptionEnabled}
                onChange={(on) => set('walletRedemptionEnabled', on)}
              />
              {values.walletRedemptionEnabled && (
                <div className="rounded-md border border-stone-150 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-stone-900">Maximum wallet redemption</p>
                    <TypeRadios
                      name="walletRedeemCap"
                      value={values.walletRedeemCapType}
                      flatLabel="Flat amount ₹"
                      onChange={(t) => set('walletRedeemCapType', t)}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field
                      label={values.walletRedeemCapType === 'PERCENTAGE' ? 'Up to % of the bill' : 'Up to ₹ per bill'}
                      htmlFor="walletRedeemCapValue"
                      error={show('walletRedeemCapValue')}
                      hint={
                        values.walletRedeemCapType === 'PERCENTAGE'
                          ? `The most a redeem QR pays of a bill. ${DEFAULT_WALLET_REDEEM_CAP_PERCENT}% = half (default), 100% = the whole bill, 0% = no wallet payment.`
                          : 'The most a redeem QR pays of a bill, never more than the bill. 0 = no wallet payment.'
                      }
                    >
                      <Input
                        id="walletRedeemCapValue"
                        name="walletRedeemCapValue"
                        inputMode="decimal"
                        prefix={values.walletRedeemCapType === 'FIXED' ? '₹' : undefined}
                        value={values.walletRedeemCapValue}
                        onChange={(e) => set('walletRedeemCapValue', e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={values.walletRedeemCapType === 'PERCENTAGE' ? String(DEFAULT_WALLET_REDEEM_CAP_PERCENT) : '0'}
                        aria-invalid={!!show('walletRedeemCapValue')}
                      />
                    </Field>
                  </div>
                </div>
              )}
              <div className="rounded-md border border-stone-150 px-4 py-3">
                <p className="text-[13px] font-medium text-stone-900">First referral bonus</p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                  On a partner&apos;s first referral bill at this outlet, the referring partner gets this ₹ amount plus this % of the bill in their
                  wallet straight away, in place of the usual referral cashback. Bills under the minimum bill don&apos;t count. Both 0 = off.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Bonus ₹" htmlFor="firstReferralBonusAmount" error={show('firstReferralBonusAmount')}>
                    <Input
                      id="firstReferralBonusAmount"
                      name="firstReferralBonusAmount"
                      inputMode="decimal"
                      prefix="₹"
                      value={values.firstReferralBonusAmount}
                      onChange={(e) => set('firstReferralBonusAmount', e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      aria-invalid={!!show('firstReferralBonusAmount')}
                    />
                  </Field>
                  <Field label="Plus % of the bill" htmlFor="firstReferralBonusPercentage" error={show('firstReferralBonusPercentage')}>
                    <Input
                      id="firstReferralBonusPercentage"
                      name="firstReferralBonusPercentage"
                      inputMode="decimal"
                      value={values.firstReferralBonusPercentage}
                      onChange={(e) => set('firstReferralBonusPercentage', e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0"
                      aria-invalid={!!show('firstReferralBonusPercentage')}
                    />
                  </Field>
                </div>
              </div>
              <Toggle
                id="givesCashReward"
                label="Gives cashback"
                hint="Bills here also credit cashback (purchase and referral) into the partner's wallet on top of points."
                checked={values.givesCashReward}
                onChange={(on) => set('givesCashReward', on)}
              />
              <p className="text-xs leading-relaxed text-stone-500">
                The Outlet Admin can also change these slabs, the minimum bill, wallet redemption and its maximum, the first referral bonus, service charge and GST from the Outlet Admin app.
                Every change is in the outlet&apos;s change log.
              </p>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Outlet Admin login"
          description={
            mode === 'create'
              ? 'Credentials the outlet staff use to sign in to the Outlet Admin app. Share them securely.'
              : 'The login email cannot be changed. Reset the password if the outlet has lost access.'
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Login email"
              htmlFor="adminEmail"
              required={mode === 'create'}
              error={show('adminEmail')}
              hint={mode === 'edit' ? 'Fixed after creation' : undefined}
            >
              {mode === 'create' ? (
                <Input {...text('adminEmail')} type="email" autoComplete="off" placeholder="staff@outlet.com" aria-invalid={!!show('adminEmail')} />
              ) : (
                <Input id="adminEmail" value={values.adminEmail || '—'} disabled readOnly />
              )}
            </Field>

            {resetting ? (
              <Field
                label={mode === 'create' ? 'Password' : 'New password'}
                htmlFor="adminPassword"
                required
                error={show('adminPassword')}
                hint="At least 8 characters."
              >
                <div className="relative">
                  <Input
                    {...text('adminPassword')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    aria-invalid={!!show('adminPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-stone-400 hover:text-stone-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetting(false);
                      set('adminPassword', '');
                    }}
                    className="mt-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
                  >
                    Cancel password reset
                  </button>
                )}
              </Field>
            ) : (
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={() => setResetting(true)}>
                  <KeyRound className="h-4 w-4" /> Reset password
                </Button>
              </div>
            )}
          </div>
        </FormSection>
      </Panel>

      {/* Action bar stays in reach on long forms */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-stone-150 bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white/95 sm:px-5">
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-500">
            {touched && Object.keys(errors).length > 0
              ? 'Fix the highlighted fields to continue.'
              : mode === 'edit'
                ? dirty
                  ? 'You have unsaved changes.'
                  : 'No changes yet.'
                : 'New outlets are active immediately.'}
          </p>
          <div className="flex gap-2">
            <Link href={cancelHref} className={buttonClass('secondary')}>
              Cancel
            </Link>
            <Button type="submit" loading={submitting} disabled={!dirty}>
              {mode === 'create' ? 'Create outlet' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
