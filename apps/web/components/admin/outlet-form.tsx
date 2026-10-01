'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, Store } from 'lucide-react';
import type { AdminOutlet } from '@lotmorewins/types';
import { MAX_OUTLET_IMAGES, normalizeIndianMobile } from '@lotmorewins/validation';
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
}

export function emptyOutletForm(outlet?: AdminOutlet): OutletFormValues {
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
  };
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
}: {
  mode: 'create' | 'edit';
  initial: OutletFormValues;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: OutletFormValues) => void;
  cancelHref?: string;
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
    const e: Partial<Record<keyof OutletFormValues, string>> = {};
    if (values.name.trim().length < 2) e.name = 'Enter the outlet name (at least 2 characters).';
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) e.email = 'Enter a valid email address.';
    if (!MOBILE.test(normalizeIndianMobile(values.mobile))) e.mobile = 'Enter a 10-digit Indian mobile number.';
    if (values.mapUrl.trim() && !/^https?:\/\/\S+$/i.test(values.mapUrl.trim())) e.mapUrl = 'Enter a link starting with http:// or https://.';
    if (mode === 'create' && !/^\S+@\S+\.\S+$/.test(values.adminEmail.trim())) e.adminEmail = 'Enter the login email.';
    if ((mode === 'create' || (resetting && values.adminPassword)) && values.adminPassword.length < 8) {
      e.adminPassword = 'Use at least 8 characters.';
    }
    if (mode === 'edit' && resetting && !values.adminPassword) e.adminPassword = 'Enter the new password or cancel the reset.';
    return e;
  }, [values, mode, resetting]);

  const dirty = useMemo(
    () =>
      mode === 'create' ||
      JSON.stringify({ ...values, adminPassword: '' }) !== JSON.stringify({ ...initial, adminPassword: '' }) ||
      (resetting && values.adminPassword.length > 0),
    [values, initial, mode, resetting]
  );
  const show = (k: keyof OutletFormValues) => (touched ? errors[k] : undefined);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (Object.keys(errors).length) return;
        onSubmit({ ...values, adminPassword: resetting ? values.adminPassword : '' });
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
