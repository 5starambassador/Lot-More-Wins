'use client';

import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Activity, ArrowRight, Coins, Gift, QrCode } from 'lucide-react';
import type { AdminPartnerActivityKind, AdminPartnerActivityRow } from '@lotmorewins/types';
import { DateRangeFilter, FilterBar, NO_DATES, dateQuery, readDateRange } from '@/components/admin/filter-bar';
import { Badge, Tag } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { PageHeader, Segmented } from '@/components/ui/page-header';
import { DetailList, Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Pagination, SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { adminApi, useAdminQuery } from '@/lib/admin-client';
import { PARTNER_STATUS, QR_TYPE_LABEL } from '@/lib/admin-labels';
import { formatDate, formatDateTime, formatINR, formatNumber, formatRelative } from '@/lib/format';

const PAGE_SIZE = 25;
const KINDS = ['PURCHASE', 'REFERRAL', 'REDEMPTION', 'SHARE'] as const;
const UUID = /^[0-9a-f-]{36}$/i;

const KIND: Record<AdminPartnerActivityKind, { label: string; gold?: boolean }> = {
  PURCHASE: { label: 'Own purchase' },
  REFERRAL: { label: 'Successful referral', gold: true },
  REDEMPTION: { label: 'Points redeemed' },
  SHARE: { label: 'Referral QR shared' },
};

function Figure({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`tabular mt-2 text-2xl font-semibold tracking-[-0.01em] ${accent ? 'text-maroon-800' : 'text-stone-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-stone-500">{sub}</p>}
    </div>
  );
}

/** What happened, in one cell: the referred customer, the bill, or the redeemed value. */
function ActivityDetail({ row }: { row: AdminPartnerActivityRow }) {
  if (row.kind === 'SHARE') return <span className="text-stone-500">Tapped “Share QR” in the Partner App</span>;
  if (row.kind === 'REDEMPTION') return <span className="text-stone-700">Redeemed {formatINR(row.rupeeValue ?? 0)} from the wallet</span>;
  return (
    <div className="min-w-0">
      {row.kind === 'REFERRAL' && (
        <p className="truncate font-medium text-stone-900">
          {row.customerName ?? 'Customer'} <span className="tabular font-normal text-stone-500">· {row.customerMobile ?? '—'}</span>
        </p>
      )}
      <p className="font-mono text-[12px] text-stone-600">{row.billNumber}</p>
      {row.note && <p className="text-[11px] text-gold-700">{row.note}</p>}
    </div>
  );
}

function PartnerDetailView({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [dates, setDates] = useState(() => readDateRange(params));
  const [kind, setKind] = useState<AdminPartnerActivityKind | undefined>(
    KINDS.includes(params.get('kind') as AdminPartnerActivityKind) ? (params.get('kind') as AdminPartnerActivityKind) : undefined
  );
  const [outletId, setOutletId] = useState(UUID.test(params.get('outletId') ?? '') ? params.get('outletId')! : '');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const next = new URLSearchParams();
    if (dates.from) next.set('from', dates.from);
    if (dates.to) next.set('to', dates.to);
    if (kind) next.set('kind', kind);
    if (outletId) next.set('outletId', outletId);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [dates, kind, outletId, pathname, router]);

  const { data: p, error, reload } = useAdminQuery(() => adminApi.getAdminPartner(id).then((r) => r.data), [id]);
  const outlets = useAdminQuery(() => adminApi.listAdminOutlets().then((r) => r.data), []);
  const filters = { ...dateQuery(dates), outletId: outletId || undefined, kind };
  const activity = useAdminQuery(
    () => adminApi.getAdminPartnerActivity(id, { page, limit: PAGE_SIZE, ...filters }).then((r) => r.data),
    [id, page, dates.from, dates.to, outletId, kind]
  );

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const filtered = Boolean(dates.from || dates.to || kind || outletId);
  const clearAll = () => {
    setDates(NO_DATES);
    setKind(undefined);
    setOutletId('');
    setPage(1);
  };

  if (error) {
    return (
      <>
        <PageHeader title="Partner" breadcrumbs={[{ label: 'Partners', href: '/partners' }, { label: 'Not found' }]} />
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      </>
    );
  }

  if (!p) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-14 rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-lg lg:col-span-2" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  const status = PARTNER_STATUS[p.status];
  const location = [p.city, p.state].filter(Boolean).join(', ');
  const t = p.referralTracking;
  const s = activity.data?.summary;
  const rows = activity.data?.rows ?? null;
  const periodLabel = dates.from || dates.to ? 'in the selected dates' : 'all time';

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partners', href: '/partners' }, { label: p.name }]}
        title={p.name}
        meta={<Badge tone={status.tone}>{status.label}</Badge>}
        description={
          <>
            <span className="font-mono">{p.partnerCode}</span> · Joined {formatDate(p.createdAt)}
          </>
        }
        actions={
          <Link href={`/transactions?partnerId=${p.id}`} className={buttonClass('secondary')}>
            All transactions <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <FilterBar
        onClear={filtered && clearAll}
        exportCsv={{ path: `/admin/partners/${p.id}/activity`, params: filters }}
      >
        <DateRangeFilter value={dates} onChange={reset(setDates)} />
        <Segmented<'ALL' | AdminPartnerActivityKind>
          label="Activity"
          value={kind ?? 'ALL'}
          onChange={(v) => reset(setKind)(v === 'ALL' ? undefined : v)}
          options={[
            { value: 'ALL', label: 'All activity' },
            { value: 'REFERRAL', label: 'Successful referrals' },
            { value: 'PURCHASE', label: 'Own purchases' },
            { value: 'REDEMPTION', label: 'Redemptions' },
            { value: 'SHARE', label: 'QR shares' },
          ]}
          className="max-w-full overflow-x-auto"
        />
        <Select aria-label="Outlet" value={outletId} onChange={(e) => reset(setOutletId)(e.target.value)} className="w-44">
          <option value="">All outlets</option>
          {outlets.data?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </FilterBar>

      <div className="grid gap-6 animate-rise-in lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Figures for the filter above */}
          <Panel className="grid gap-px overflow-hidden bg-stone-150 sm:grid-cols-2 xl:grid-cols-4">
            <Figure
              label="Successful referrals"
              value={s ? formatNumber(s.referrals.count) : '—'}
              sub={s ? `${formatNumber(s.referrals.uniqueCustomers)} customers · ${formatINR(s.referrals.billAmount)} sales` : periodLabel}
              accent
            />
            <Figure
              label="Referral QR shares"
              value={s ? formatNumber(s.shares) : '—'}
              sub={outletId ? 'Not tied to an outlet' : `Taps of “Share QR”, ${periodLabel}`}
            />
            <Figure
              label="Own purchases"
              value={s ? formatINR(s.purchases.billAmount) : '—'}
              sub={s ? `${formatNumber(s.purchases.count)} bills · ${formatINR(s.purchases.discountAmount)} saved` : undefined}
            />
            <Figure
              label="Points earned / redeemed"
              value={s ? formatNumber(s.purchases.points + s.referrals.points) : '—'}
              sub={s ? `${formatNumber(s.redemptions.points)} redeemed (${formatINR(s.redemptions.rupeeValue)}) in ${formatNumber(s.redemptions.count)}` : undefined}
            />
          </Panel>

          <Panel>
            <PanelHeader
              title={kind === 'REFERRAL' ? 'Referrals' : 'Activity'}
              description={
                kind === 'REFERRAL'
                  ? 'Every bill a customer closed with this partner’s referral QR.'
                  : 'Own purchases, successful referrals, wallet redemptions and referral QR shares, newest first.'
              }
              actions={activity.data && <Tag className="tabular">{formatNumber(activity.data.meta.total)} rows</Tag>}
            />
            {activity.error ? (
              <div className="p-5">
                <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={activity.reload}>Retry</Button>}>
                  {activity.error}
                </Alert>
              </div>
            ) : rows && rows.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={filtered ? 'Nothing matches these filters' : 'No activity yet'}
                description={
                  filtered
                    ? 'Try a wider date range or clear the filters.'
                    : 'Bills, referrals, redemptions and QR shares appear here as they happen.'
                }
              />
            ) : (
              <TableScroll className={activity.loading && rows ? 'opacity-60 transition-opacity' : undefined}>
                <Table className="min-w-[820px]">
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Activity</TH>
                      <TH>Details</TH>
                      <TH>Outlet</TH>
                      <TH align="right">Bill amount</TH>
                      <TH align="right">Points</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {!rows ? (
                      <SkeletonRows cols={6} rows={6} />
                    ) : (
                      rows.map((r) => (
                        <TR key={`${r.kind}-${r.id}`}>
                          <TD className="whitespace-nowrap text-stone-500" title={formatRelative(r.createdAt)}>
                            {formatDateTime(r.createdAt)}
                          </TD>
                          <TD>
                            <Tag gold={KIND[r.kind].gold}>{KIND[r.kind].label}</Tag>
                          </TD>
                          <TD className="max-w-[260px]">
                            <ActivityDetail row={r} />
                          </TD>
                          <TD className="max-w-[160px] truncate">{r.outletName ?? <span className="text-stone-300">—</span>}</TD>
                          <TD align="right">
                            {r.billAmount === null ? (
                              <span className="text-stone-300">—</span>
                            ) : (
                              <>
                                <span className="font-medium text-stone-900">{formatINR(r.billAmount)}</span>
                                <span className="block text-[11px] text-stone-400">
                                  {formatNumber(r.discountPercentage ?? 0)}% off · {formatINR(r.finalAmount ?? 0)} paid
                                </span>
                              </>
                            )}
                          </TD>
                          <TD align="right" className={r.points < 0 ? 'font-medium text-maroon-700' : r.points > 0 ? 'font-medium text-emerald-700' : 'text-stone-300'}>
                            {r.points === 0 ? '—' : `${r.points > 0 ? '+' : '−'}${formatNumber(Math.abs(r.points))}`}
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </TableScroll>
            )}
            {activity.data && (
              <Pagination
                page={activity.data.meta.page}
                totalPages={activity.data.meta.totalPages}
                total={activity.data.meta.total}
                pageSize={PAGE_SIZE}
                onPage={setPage}
                noun="rows"
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Points ledger"
              description={`Available now: purchase ${formatNumber(p.wallet.totals.purchasePoints)} pts · referral ${formatNumber(p.wallet.totals.referralPoints)} pts. Latest 20 credits.`}
            />
            {p.wallet.entries.length === 0 ? (
              <EmptyState icon={Coins} title="No points yet" description="Points are credited automatically when bills are created." />
            ) : (
              <TableScroll>
                <Table className="min-w-[620px]">
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Source</TH>
                      <TH>Bill</TH>
                      <TH>Expires</TH>
                      <TH align="right">Points</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {p.wallet.entries.map((e) => (
                      <TR key={e.id}>
                        <TD className="h-12 whitespace-nowrap text-stone-500" title={formatDateTime(e.createdAt)}>
                          {formatRelative(e.createdAt)}
                        </TD>
                        <TD className="h-12">
                          <Tag gold={e.type === 'REFERRAL'}>{e.type === 'REFERRAL' ? 'Referral' : 'Purchase'}</Tag>
                          {e.claimedAt && <span className="ml-2 text-[11px] text-stone-400">claimed on registration</span>}
                        </TD>
                        <TD className="h-12">
                          <p className="font-mono text-[12px] text-stone-700">{e.billNumber}</p>
                          <p className="text-[11px] text-stone-500">{e.outletName}</p>
                        </TD>
                        <TD className="h-12 whitespace-nowrap">
                          {!e.expiresAt ? (
                            <span className="text-stone-400">No expiry</span>
                          ) : e.expired ? (
                            <Badge tone="neutral">Expired {formatDate(e.expiresAt)}</Badge>
                          ) : (
                            <span className="text-stone-700">{formatDate(e.expiresAt)}</span>
                          )}
                        </TD>
                        <TD className={`h-12 font-medium ${e.expired ? 'text-stone-400 line-through' : 'text-emerald-700'}`} align="right">
                          +{formatNumber(e.points)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Referral tracking"
              description="All time"
              actions={t.rewardAvailable && <Badge tone="gold" icon={false}>Reward waiting</Badge>}
            />
            <PanelBody>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="text-stone-600">Towards the next reward</span>
                <span className="tabular font-semibold text-stone-900">
                  {formatNumber(t.progress)} / {formatNumber(t.goal)}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-stone-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={t.goal}
                aria-valuenow={t.progress}
                aria-label="Successful referrals towards the next reward"
              >
                <div className="h-full rounded-full bg-maroon-700 transition-[width] duration-500" style={{ width: `${t.goal ? (t.progress / t.goal) * 100 : 0}%` }} />
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-stone-500">
                <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
                {t.rewardAvailable
                  ? `Goal reached: ${formatNumber(t.rewardDiscount)}% special discount applies to this partner's next purchase on their Personal Discount QR. The bar resets when it is used.`
                  : `Every ${formatNumber(t.goal)} successful referrals unlock a ${formatNumber(t.rewardDiscount)}% special discount on the partner's next own purchase.`}
              </p>
              <DetailList
                className="mt-4 border-t border-stone-100"
                items={[
                  { label: 'Total referrals', value: <span className="tabular">{formatNumber(t.total)}</span> },
                  { label: 'Customers referred', value: <span className="tabular">{formatNumber(t.uniqueCustomers)}</span> },
                  { label: 'Share QR taps', value: <span className="tabular">{formatNumber(t.shares)}</span> },
                  { label: 'Rewards used', value: <span className="tabular">{formatNumber(t.rewardsUsed)}</span> },
                  { label: 'Referral sales', value: <span className="tabular">{formatINR(p.referredTotals.billAmount)}</span> },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Wallet" />
            <div className="px-5 py-2">
              <DetailList
                items={[
                  { label: 'Points balance', value: <span className="tabular">{formatNumber(p.wallet.balancePoints)}</span> },
                  { label: 'Worth', value: <span className="tabular">{formatINR(p.wallet.rupeeValue)}</span> },
                  { label: 'Own purchases', value: `${formatINR(p.directTotals.billAmount)} · ${formatNumber(p.directTotals.billCount)} bills` },
                  { label: 'Saved in discounts', value: <span className="tabular">{formatINR(p.directTotals.discountAmount)}</span> },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Profile" />
            <div className="px-5 py-2">
              <DetailList
                items={[
                  { label: 'Mobile', value: <span className="tabular">{p.mobile}</span> },
                  { label: 'Email', value: p.email },
                  { label: 'City / State', value: location || '—' },
                  { label: 'Pincode', value: p.pincode ? <span className="tabular">{p.pincode}</span> : '—' },
                  { label: 'Date of birth', value: p.dateOfBirth ? formatDate(p.dateOfBirth) : 'Not provided' },
                  { label: 'Joined', value: formatDateTime(p.createdAt) },
                  { label: 'Last updated', value: formatRelative(p.updatedAt) },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="QR codes" description="Permanent codes issued at registration" />
            {p.qrCodes.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-stone-400">No QR codes issued</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {p.qrCodes.map((q) => (
                  <li key={q.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gold-200 bg-gold-50 text-gold-700">
                      <QrCode className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-stone-900">{QR_TYPE_LABEL[q.type]}</p>
                      <p className="truncate font-mono text-[11px] text-stone-500" title={q.code}>
                        {q.code}
                      </p>
                    </div>
                    <Badge tone={q.status === 'ACTIVE' ? 'success' : 'danger'}>{q.status === 'ACTIVE' ? 'Active' : 'Revoked'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <PartnerDetailView id={id} />
    </Suspense>
  );
}
