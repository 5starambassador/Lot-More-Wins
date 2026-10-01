'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Coins, Power } from 'lucide-react';
import type { BillRecord, BillTransactionType, UpdateOutletPayload } from '@lotmorewins/types';
import { BillDrawer, BillsTable } from '@/components/admin/bills';
import { OutletForm, OutletLogo, emptyOutletForm, type OutletFormValues } from '@/components/admin/outlet-form';
import { DateRangeFilter, ExportCsvButton, FilterBar, NO_DATES, dateQuery, readDateRange } from '@/components/admin/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Pagination, SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, isUnauthenticated, useAdminQuery } from '@/lib/admin-client';
import { BILL_TYPE_LABEL, OUTLET_STATUS } from '@/lib/admin-labels';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime, formatINR, formatNumber } from '@/lib/format';

type TabKey = 'overview' | 'profile';

const BILLS_PAGE_SIZE = 10;
const REDEMPTIONS_PAGE_SIZE = 10;
const TYPES = ['DIRECT_PARTNER', 'REFERRAL'] as const;

function OutletDetailView({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  const [dates, setDates] = useState(() => readDateRange(params));
  const [type, setType] = useState<BillTransactionType | undefined>(
    TYPES.includes(params.get('type') as BillTransactionType) ? (params.get('type') as BillTransactionType) : undefined
  );
  const [billPage, setBillPage] = useState(1);
  const [redemptionPage, setRedemptionPage] = useState(1);

  useEffect(() => {
    const next = new URLSearchParams();
    if (dates.from) next.set('from', dates.from);
    if (dates.to) next.set('to', dates.to);
    if (type) next.set('type', type);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [dates, type, pathname, router]);

  const { data: outlet, error: loadError, reload, setData } = useAdminQuery(() => adminApi.getAdminOutlet(id).then((r) => r.data), [id]);
  const billFilters = { outletId: id, ...dateQuery(dates), type };
  const activity = useAdminQuery(
    () => adminApi.listAdminTransactions({ ...billFilters, page: billPage, limit: BILLS_PAGE_SIZE }).then((r) => r.data),
    [id, dates.from, dates.to, type, billPage]
  );
  const redemptions = useAdminQuery(
    () => adminApi.getAdminOutletRedemptions(id, { ...dateQuery(dates), page: redemptionPage, limit: REDEMPTIONS_PAGE_SIZE }).then((r) => r.data),
    [id, dates.from, dates.to, redemptionPage]
  );
  const filtered = Boolean(dates.from || dates.to || type);
  const resetPages = () => {
    setBillPage(1);
    setRedemptionPage(1);
  };

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
        description: values.description,
        address: values.address,
        mapUrl: values.mapUrl,
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
  const r = redemptions.data?.summary;

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

          <FilterBar
            className="mb-0"
            onClear={
              filtered &&
              (() => {
                setDates(NO_DATES);
                setType(undefined);
                resetPages();
              })
            }
            exportCsv={{ path: '/admin/transactions', params: billFilters, label: 'Export bills CSV' }}
          >
            <DateRangeFilter
              value={dates}
              onChange={(v) => {
                setDates(v);
                resetPages();
              }}
            />
            <Select
              aria-label="Transaction type"
              value={type ?? ''}
              onChange={(e) => {
                setType((e.target.value || undefined) as BillTransactionType | undefined);
                setBillPage(1);
              }}
              className="w-40"
            >
              <option value="">All bill types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {BILL_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </FilterBar>

          <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-stone-150 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Bills', value: s ? formatNumber(s.billCount) : '—' },
              { label: 'Gross sales', value: s ? formatINR(s.billAmount) : '—', strong: true },
              { label: 'Discounts given', value: s ? formatINR(s.discountAmount) : '—' },
              { label: 'Collected', value: s ? formatINR(s.finalAmount) : '—' },
              { label: 'Points issued', value: s ? formatNumber(s.purchasePoints + s.referralPoints) : '—' },
              { label: 'Points redeemed', value: r ? `${formatNumber(r.points)} · ${formatINR(r.rupeeValue)}` : '—' },
            ].map((m) => (
              <div key={m.label} className="bg-white px-5 py-4">
                <p className="text-xs text-stone-500">{m.label}</p>
                <p className={cn('tabular mt-1 truncate text-lg font-semibold', m.strong ? 'text-maroon-800' : 'text-stone-900')}>{m.value}</p>
              </div>
            ))}
          </Panel>

          <Panel>
            <PanelHeader
              title="Transactions"
              description={filtered ? 'Bills matching the filters above.' : 'Every bill this outlet has created, newest first.'}
              actions={
                <Link href={`/transactions?outletId=${outlet.id}`} className={buttonClass('ghost', 'sm')}>
                  Open in Transactions <ArrowRight className="h-3.5 w-3.5" />
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
                emptyTitle={filtered ? 'No transactions match' : 'No transactions yet'}
                emptyDescription={
                  filtered
                    ? 'Try a wider date range or clear the filters.'
                    : 'Bills appear here once this outlet scans a partner QR and completes a sale.'
                }
              />
            )}
            {activity.data && (
              <Pagination
                page={activity.data.meta.page}
                totalPages={activity.data.meta.totalPages}
                total={activity.data.meta.total}
                pageSize={BILLS_PAGE_SIZE}
                onPage={setBillPage}
                noun="bills"
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Wallet redemptions"
              description="Points partners spent here by showing their redeem QR."
              actions={<ExportCsvButton size="sm" path={`/admin/outlets/${outlet.id}/redemptions`} params={{ ...dateQuery(dates) }} />}
            />
            {redemptions.error ? (
              <div className="p-5">
                <Alert tone="danger">{redemptions.error}</Alert>
              </div>
            ) : redemptions.data && redemptions.data.redemptions.length === 0 ? (
              <EmptyState
                icon={Coins}
                title={dates.from || dates.to ? 'No redemptions in these dates' : 'No redemptions yet'}
                description="They appear here when this outlet scans a partner's redeem QR."
              />
            ) : (
              <TableScroll>
                <Table className="min-w-[560px]">
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Partner</TH>
                      <TH align="right">Value</TH>
                      <TH align="right">Points</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {!redemptions.data ? (
                      <SkeletonRows cols={4} rows={3} />
                    ) : (
                      redemptions.data.redemptions.map((x) => (
                        <TR key={x.id}>
                          <TD className="h-12 whitespace-nowrap text-stone-500">{formatDateTime(x.createdAt)}</TD>
                          <TD className="h-12">
                            <Link href={`/partners/${x.partner.id}`} className="font-medium text-stone-900 hover:text-maroon-700">
                              {x.partner.name}
                            </Link>
                            <span className="ml-2 font-mono text-[11px] text-stone-500">{x.partner.partnerCode}</span>
                          </TD>
                          <TD className="h-12 text-stone-700" align="right">
                            {formatINR(x.rupeeValue)}
                          </TD>
                          <TD className="h-12 font-medium text-maroon-700" align="right">
                            −{formatNumber(x.points)}
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </TableScroll>
            )}
            {redemptions.data && (
              <Pagination
                page={redemptions.data.meta.page}
                totalPages={redemptions.data.meta.totalPages}
                total={redemptions.data.meta.total}
                pageSize={REDEMPTIONS_PAGE_SIZE}
                onPage={setRedemptionPage}
                noun="redemptions"
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

export default function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <OutletDetailView id={id} />
    </Suspense>
  );
}
