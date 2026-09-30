'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Power } from 'lucide-react';
import type { BillRecord, UpdateOutletPayload } from '@lotmorewins/types';
import { BillDrawer, BillsTable } from '@/components/admin/bills';
import { OutletForm, OutletLogo, emptyOutletForm, type OutletFormValues } from '@/components/admin/outlet-form';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, isUnauthenticated, useAdminQuery } from '@/lib/admin-client';
import { OUTLET_STATUS } from '@/lib/admin-labels';
import { cn } from '@/lib/utils';
import { formatDate, formatINR, formatNumber } from '@/lib/format';

type TabKey = 'overview' | 'profile';

export default function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { data: outlet, error: loadError, reload, setData } = useAdminQuery(() => adminApi.getAdminOutlet(id).then((r) => r.data), [id]);
  const activity = useAdminQuery(
    () => adminApi.listAdminTransactions({ outletId: id, limit: 8, range: 'all' }).then((r) => r.data),
    [id]
  );

  const [tab, setTab] = useState<TabKey>('overview');
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [selected, setSelected] = useState<BillRecord | null>(null);

  const update = async (payload: UpdateOutletPayload) => {
    const res = await adminApi.updateAdminOutlet(id, payload);
    setData(() => res.data);
    setFormKey((k) => k + 1);
    return res.data;
  };

  const onSubmit = async (values: OutletFormValues) => {
    setSaving(true);
    setSaveError(null);
    try {
      await update({
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        logoUrl: values.logoUrl,
        images: values.images,
        ...(values.adminPassword ? { adminPassword: values.adminPassword } : {}),
      });
      toast('success', values.adminPassword ? 'Outlet saved and password reset' : 'Outlet saved');
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else setSaveError(errorMessage(err, 'Could not save outlet.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!outlet) return;
    const next = outlet.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setToggling(true);
    try {
      await update({ status: next });
      toast('success', next === 'ACTIVE' ? 'Outlet activated' : 'Outlet deactivated');
      setConfirming(false);
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else toast('error', 'Could not change status', errorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  if (loadError) {
    return (
      <>
        <PageHeader title="Outlet" breadcrumbs={[{ label: 'Outlets', href: '/outlets' }, { label: 'Not found' }]} />
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {loadError}
        </Alert>
      </>
    );
  }

  if (!outlet) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-md" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[420px] w-full rounded-lg" />
      </div>
    );
  }

  const active = outlet.status === 'ACTIVE';
  const s = activity.data?.summary;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Outlets', href: '/outlets' }, { label: outlet.name }]}
        title={
          <span className="flex items-center gap-4">
            <OutletLogo outlet={outlet} size="lg" />
            {outlet.name}
          </span>
        }
        meta={<Badge tone={OUTLET_STATUS[outlet.status].tone}>{OUTLET_STATUS[outlet.status].label}</Badge>}
        description={`Added ${formatDate(outlet.createdAt)} · ${outlet.email} · +91 ${outlet.mobile}`}
        actions={
          <Button variant={active ? 'danger-outline' : 'primary'} onClick={() => setConfirming(true)}>
            <Power className="h-4 w-4" />
            {active ? 'Deactivate' : 'Activate'}
          </Button>
        }
      />

      {/* Tabs */}
      <div role="tablist" aria-label="Outlet sections" className="mb-6 flex gap-6 border-b border-stone-150">
        {(
          [
            ['overview', 'Overview'],
            ['profile', 'Profile & login'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-[13px] font-medium transition-colors',
              tab === key ? 'border-gold-500 text-maroon-800' : 'border-transparent text-stone-500 hover:text-stone-800'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="space-y-6 animate-fade-in">
          {!active && (
            <Alert tone="warning" title="This outlet is inactive">
              It is hidden from the Partner App and its staff cannot scan QR codes or create bills.
            </Alert>
          )}

          <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-stone-150 md:grid-cols-4">
            {[
              { label: 'Bills', value: formatNumber(outlet.billCount) },
              { label: 'Gross sales', value: s ? formatINR(s.billAmount) : '—', strong: true },
              { label: 'Discounts given', value: s ? formatINR(s.discountAmount) : '—' },
              { label: 'Points issued', value: s ? formatNumber(s.purchasePoints + s.referralPoints) : '—' },
            ].map((m) => (
              <div key={m.label} className="bg-white px-5 py-4">
                <p className="text-xs text-stone-500">{m.label}</p>
                <p className={cn('tabular mt-1 truncate text-lg font-semibold', m.strong ? 'text-maroon-800' : 'text-stone-900')}>{m.value}</p>
              </div>
            ))}
          </Panel>

          <Panel>
            <PanelHeader
              title="Recent transactions"
              actions={
                <Link href={`/transactions?outletId=${outlet.id}&range=all`} className={buttonClass('ghost', 'sm')}>
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {activity.error ? (
              <div className="p-5">
                <Alert tone="danger">{activity.error}</Alert>
              </div>
            ) : (
              <BillsTable
                bills={activity.data?.bills ?? null}
                onSelect={setSelected}
                hideOutlet
                emptyDescription="Bills appear here once this outlet scans a partner QR and completes a sale."
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Outlet Admin access" description="Staff sign in to the Outlet Admin app with this login." />
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[13px]">
              <span className="text-stone-800">{outlet.adminEmail ?? 'No admin login'}</span>
              <Button variant="secondary" size="sm" onClick={() => setTab('profile')}>
                Manage login
              </Button>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="animate-fade-in">
          <OutletForm
            key={formKey}
            mode="edit"
            initial={emptyOutletForm(outlet)}
            submitting={saving}
            error={saveError}
            onSubmit={onSubmit}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={toggleStatus}
        busy={toggling}
        tone={active ? 'danger' : 'primary'}
        title={active ? `Deactivate ${outlet.name}?` : `Activate ${outlet.name}?`}
        confirmLabel={active ? 'Deactivate outlet' : 'Activate outlet'}
        description={
          active
            ? 'The outlet disappears from the Partner App and its staff can no longer scan QR codes or create bills. Existing bills are kept.'
            : 'The outlet will be listed in the Partner App and its staff can scan QR codes and bill again.'
        }
      />
      <BillDrawer bill={selected} onClose={() => setSelected(null)} />
    </>
  );
}
