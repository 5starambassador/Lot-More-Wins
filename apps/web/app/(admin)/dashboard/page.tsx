'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  CalendarDays,
  CheckCircle2,
  Coins,
  Gift,
  IndianRupee,
  Receipt,
  Share2,
  ThumbsUp,
  TrendingUp,
  UserPlus,
  Database,
  Mail,
  MessageCircle,
  RefreshCw,
  Settings2,
  Store,
  Users,
} from 'lucide-react';
import type { AdminDashboard, AdminDataSource, BillRecord } from '@lotmorewins/types';
import { BarList, SplitMeter, TrendChart } from '@/components/admin/charts';
import { BillDrawer, BillsTable } from '@/components/admin/bills';
import { DateRangeFilter, FilterBar, dateQuery, lastDays, readDateRange } from '@/components/admin/filter-bar';
import { GlobalSearch } from '@/components/admin/global-search';
import { ResetDataButton } from '@/components/admin/reset-data';
import { Badge, Tag } from '@/components/ui/badge';
import { buttonClass, Button } from '@/components/ui/button';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { adminApi, useAdminQuery } from '@/lib/admin-client';
import { BILL_TYPE_LABEL, PARTNER_STATUS } from '@/lib/admin-labels';
import { SAMPLE_OUTLETS } from '@/lib/dashboard-sample';
import { cn } from '@/lib/utils';
import {
  formatCompact,
  formatCompactINR,
  formatDate,
  formatDateTime,
  formatINR,
  formatINRWhole,
  formatNumber,
  formatRelative,
  formatTime,
  initials,
  percentChange,
} from '@/lib/format';

function Delta({ current, previous, days }: { current: number; previous: number; days: number }) {
  const before = `the ${formatNumber(days)} day${days === 1 ? '' : 's'} before`;
  if (current === 0 && previous === 0) return <span className="text-xs text-stone-500">No sales in this period or {before}</span>;
  const pct = percentChange(current, previous);
  if (pct === null) return <span className="text-xs text-stone-500">No sales in {before}</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold',
          up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(pct).toFixed(1)}%
      </span>
      vs {before}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  href,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-medium text-stone-500">
          <Icon className="h-4 w-4 text-gold-600" />
          {label}
        </p>
        {href && <ArrowRight className="h-4 w-4 text-stone-300 transition-all group-hover:translate-x-0.5 group-hover:text-maroon-700" />}
      </div>
      <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.01em] text-stone-900">{value}</p>
      {children && <div className="mt-4">{children}</div>}
    </>
  );
  const cls = 'group block bg-white p-5 transition-colors';
  return href ? (
    <Link href={href} className={cn(cls, 'hover:bg-stone-25')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A row of small labelled figures under a chart. */
function Stats({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-stone-150 pt-4 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} title={i.hint}>
          <dt className="text-xs text-stone-500">{i.label}</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold text-stone-900">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Placeholder until a real comparison source exists: this one figure is NOT read from the
 * database. Every other tile is.
 */
const SAMPLE_BUSINESS_GROWTH_PERCENT = 18.7;

/** The eight headline programme figures: two rows of four, above the charts. */
function ProgramMetrics({ d }: { d: AdminDashboard }) {
  const m = d.programMetrics;
  const tiles: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; caption: string; sample?: boolean }[] = [
    { icon: UserPlus, label: 'App Registrations', value: formatNumber(m.appRegistrations), caption: 'New partners in this period' },
    {
      icon: Gift,
      label: 'Offer Redemptions',
      value: formatNumber(m.offerRedemptions),
      caption: `${m.offerRedemptionRate}% of registered`,
    },
    { icon: Share2, label: 'Successful Referrals', value: formatNumber(m.successfulReferrals), caption: 'Verified conversions' },
    { icon: BadgePercent, label: 'Referral Bonus', value: formatCompactINR(m.referralBonus), caption: 'Total reward cost' },
    {
      icon: ThumbsUp,
      label: 'Social Followers Added',
      value: m.socialFollowersAdded === null ? '—' : `+${formatCompact(m.socialFollowersAdded)}`,
      caption: m.socialFollowersAdded === null ? 'Not tracked yet' : 'Across all channels',
    },
    { icon: Receipt, label: 'Billing Count', value: formatNumber(m.billingCount), caption: 'Attributed bills' },
    { icon: IndianRupee, label: 'Attributed Sales', value: formatCompactINR(m.attributedSales), caption: 'Program-linked revenue' },
    {
      icon: TrendingUp,
      label: 'Business Growth',
      value: `+${SAMPLE_BUSINESS_GROWTH_PERCENT}%`,
      caption: 'Vs comparison period',
      sample: true,
    },
  ];
  return (
    <Panel className="overflow-hidden" aria-label="Programme metrics">
      <div className="grid grid-cols-2 gap-px bg-stone-150 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-stone-500">
              <t.icon className="h-4 w-4 text-gold-600" />
              {t.label}
              {t.sample && <Tag>Sample</Tag>}
            </p>
            <p className="tabular mt-3 text-[26px] font-semibold leading-none tracking-[-0.01em] text-stone-900">{t.value}</p>
            <p className="mt-2 text-xs text-stone-500">{t.caption}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

type Attention = { tone: 'danger' | 'warning' | 'info'; title: string; body: string; href?: string; cta?: string };

function attentionItems(d: AdminDashboard, rangeQuery: string): Attention[] {
  const items: Attention[] = [];
  if (d.system.database !== 'connected') {
    items.push({ tone: 'danger', title: 'Database unreachable', body: 'Some figures may be missing or out of date.' });
  }
  if (!d.system.settingsConfigured) {
    items.push({
      tone: 'danger',
      title: 'Programme settings not saved',
      body: 'Outlets cannot create bills until discounts and points are saved.',
      href: '/settings',
      cta: 'Configure',
    });
  }
  if (d.notifications.FAILED > 0) {
    items.push({
      tone: 'danger',
      title: `${formatNumber(d.notifications.FAILED)} bill message${d.notifications.FAILED === 1 ? '' : 's'} failed`,
      body: 'Customers did not receive their bill summary in this period.',
      href: `/transactions?notification=FAILED&${rangeQuery}`,
      cta: 'Review',
    });
  }
  if (d.partners.byStatus.PENDING > 0) {
    items.push({
      tone: 'warning',
      title: `${formatNumber(d.partners.byStatus.PENDING)} partner${d.partners.byStatus.PENDING === 1 ? '' : 's'} pending`,
      body: 'Registrations waiting on a status decision.',
      href: '/partners?status=PENDING',
      cta: 'View',
    });
  }
  if (d.outlets.inactive > 0) {
    items.push({
      tone: 'info',
      title: `${formatNumber(d.outlets.inactive)} inactive outlet${d.outlets.inactive === 1 ? '' : 's'}`,
      body: 'Hidden from the Partner App and unable to bill.',
      href: '/outlets?status=INACTIVE',
      cta: 'View',
    });
  }
  if (d.points.pendingPoints > 0) {
    items.push({
      tone: 'info',
      title: `${formatNumber(d.points.pendingPoints)} points held`,
      body: 'Earned by referred customers who have not registered as partners yet.',
    });
  }
  return items;
}

const dotTone = { danger: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-stone-400' } as const;

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[230px] w-full rounded-lg" />
      <Skeleton className="h-[340px] w-full rounded-lg" />
      <Skeleton className="h-[150px] w-full rounded-lg" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[380px] rounded-lg" />
        <Skeleton className="h-[380px] rounded-lg" />
      </div>
    </div>
  );
}

const DEFAULT_RANGE_DAYS = 30;

/** A link to a record's page. Sample records have no page, so test data shows the text only. */
function RecordLink({ live, href, className, children }: { live: boolean; href: string; className?: string; children: React.ReactNode }) {
  return live ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className?.replace(/\bhover:\S+/g, '')}>{children}</span>
  );
}

function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // The dashboard always has a period: the last 30 days unless the URL names another.
  const [dates, setDates] = useState(() => readDateRange(params, lastDays(DEFAULT_RANGE_DAYS)));
  const complete = Boolean(dates.from && dates.to);
  const isDefault = dates.from === lastDays(DEFAULT_RANGE_DAYS).from && dates.to === lastDays(DEFAULT_RANGE_DAYS).to;
  // "Test data" fills the page with sample figures to demonstrate it; "Live data" reads the database.
  const [source, setSource] = useState<AdminDataSource>(() => (params.get('data') === 'test' ? 'test' : 'live'));
  // "Channel": one outlet, or every outlet when empty.
  const [outletId, setOutletId] = useState(() => params.get('outlet') ?? '');
  // Live and test data have different outlets, so changing the data also clears the channel.
  const pickSource = (next: AdminDataSource) => {
    setSource(next);
    setOutletId('');
  };
  const outletOptions = useAdminQuery(() => adminApi.listAdminOutletOptions().then((r) => r.data), []);
  const channels = source === 'test' ? SAMPLE_OUTLETS : (outletOptions.data ?? []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (source === 'test') next.set('data', 'test');
    if (outletId) next.set('outlet', outletId);
    if (!isDefault && dates.from) next.set('from', dates.from);
    if (!isDefault && dates.to) next.set('to', dates.to);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [dates, isDefault, source, outletId, pathname, router]);

  // While a custom range is half-typed, keep showing the last complete period.
  const query = { ...dateQuery(complete ? dates : lastDays(DEFAULT_RANGE_DAYS)), source, outletId: outletId || undefined };
  const { data: d, error, loading, reload } = useAdminQuery(
    () => adminApi.getAdminDashboard(query).then((r) => r.data),
    [complete ? `${dates.from}:${dates.to}` : 'incomplete', source, outletId]
  );
  const [selected, setSelected] = useState<BillRecord | null>(null);
  const live = d?.source !== 'test';

  const period = d?.period;
  const avgBill = period && period.billCount ? period.billAmount / period.billCount : 0;
  const pointsValue = d ? (d.points.creditedPoints * d.points.pointsRatio.rupees) / (d.points.pointsRatio.points || 1) : 0;
  const rangeQuery = d ? `from=${d.range.from}&to=${d.range.to}` : '';
  // Sample figures have no records behind them, so their attention items carry no links.
  const attention = d ? attentionItems(d, rangeQuery).map((a) => (live ? a : { ...a, href: undefined })) : [];
  const periodLabel = d
    ? d.range.from === d.range.to
      ? formatDate(d.range.from)
      : `${formatDate(d.range.from)} – ${formatDate(d.range.to)}`
    : '';
  const shareToReferral = d && d.referrals.shares > 0 ? (d.referrals.successful / d.referrals.shares) * 100 : null;
  const notificationTotal = d ? Object.values(d.notifications).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <PageHeader
        title="Programme overview"
        description="Sales, referrals, points and network health for the period you choose, across every outlet."
        actions={
          <Button variant="secondary" onClick={reload} loading={loading && !!d}>
            {!(loading && d) && <RefreshCw className="h-4 w-4" />}
            {d ? `Updated ${formatTime(d.generatedAt)}` : 'Refresh'}
          </Button>
        }
      />

      <FilterBar
        onClear={
          (!isDefault || !!outletId) &&
          (() => {
            setDates(lastDays(DEFAULT_RANGE_DAYS));
            setOutletId('');
          })
        }
        exportCsv={{ path: '/admin/dashboard', params: { ...query } }}
      >
        <GlobalSearch />
        <Select aria-label="Channel" value={outletId} onChange={(e) => setOutletId(e.target.value)} className="w-48">
          <option value="">All channels</option>
          {channels.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Data shown" value={source} onChange={(e) => pickSource(e.target.value as AdminDataSource)} className="w-32">
          <option value="live">Live data</option>
          <option value="test">Test data</option>
        </Select>
        <DateRangeFilter label="Period" value={dates} onChange={setDates} allowAll={false} />
        {d && (
          <p className="text-xs text-stone-500">
            Showing <span className="font-medium text-stone-800">{periodLabel}</span> · {formatNumber(d.range.days)} day
            {d.range.days === 1 ? '' : 's'}
            {d.range.granularity === 'month' && ' · charts by month'}
            {d.outlet && (
              <>
                {' '}
                · <span className="font-medium text-stone-800">{d.outlet.name}</span> only
              </>
            )}
          </p>
        )}
        <ResetDataButton onDone={reload} />
      </FilterBar>

      {error && (
        <Alert tone="danger" className="mb-6" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {d && !live && (
        <Alert
          tone="warning"
          className="mb-6"
          title="Showing test data"
          action={
            <Button size="sm" variant="secondary" onClick={() => pickSource('live')}>
              Show live data
            </Button>
          }
        >
          Every figure on this page is a sample for demonstration. Nothing here comes from the database.
        </Alert>
      )}

      {d?.outlet && (
        <Alert tone="info" className="mb-6" action={<Button size="sm" variant="secondary" onClick={() => setOutletId('')}>All channels</Button>}>
          Sales, bills, referrals, points issued and redemptions below are for <span className="font-medium">{d.outlet.name}</span> only.
          Partner counts, wallet balances and QR shares are not tied to an outlet, so they stay programme-wide.
        </Alert>
      )}

      {!d ? (
        !error && <DashboardSkeleton />
      ) : (
        <div className={cn('space-y-6 animate-rise-in', loading && 'opacity-60 transition-opacity')}>
          <ProgramMetrics d={d} />

          {/* Hero: sales in the period */}
          <Panel className="overflow-hidden">
            <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-stone-150 bg-gradient-to-b from-maroon-50/60 to-transparent p-6 lg:border-b-0 lg:border-r">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-600">Gross sales · {periodLabel}</p>
                <p className="mt-3 text-[44px] font-semibold leading-none tracking-[-0.02em] text-stone-900">
                  {formatINRWhole(period!.billAmount)}
                </p>
                <div className="mt-3">
                  <Delta current={period!.billAmount} previous={d.previousPeriod.billAmount} days={d.range.days} />
                </div>
                <dl className="mt-8 space-y-3 border-t border-stone-150 pt-5 text-[13px]">
                  {[
                    ['Bills', formatNumber(period!.billCount)],
                    ['Average bill', formatINR(avgBill)],
                    ['Discounts given', formatINR(period!.discountAmount)],
                    ['Collected by outlets', formatINR(period!.finalAmount)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4">
                      <dt className="text-stone-500">{k}</dt>
                      <dd className="tabular font-medium text-stone-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="min-w-0 p-6">
                <TrendChart
                  data={d.trend}
                  emptyLabel="No sales in this period"
                  metrics={[
                    { key: 'billAmount', label: 'Gross sales', format: formatINR, tick: formatCompactINR },
                    { key: 'discountAmount', label: 'Discounts', format: formatINR, tick: formatCompactINR },
                    { key: 'billCount', label: 'Bills' },
                  ]}
                />
              </div>
            </div>
          </Panel>

          {/* KPI strip: one panel, four divided cells */}
          <Panel className="grid gap-px overflow-hidden bg-stone-150 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} label="Partners" value={formatNumber(d.partners.total)} href={live ? '/partners' : undefined}>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
                {(['ACTIVE', 'PENDING', 'SUSPENDED'] as const).map((s) => (
                  <span key={s}>
                    {PARTNER_STATUS[s].label} <span className="tabular font-medium text-stone-800">{formatNumber(d.partners.byStatus[s])}</span>
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-stone-500">
                <span className="font-medium text-gold-700">+{formatNumber(d.partners.newInPeriod)}</span> joined in this period
              </p>
            </Kpi>
            <Kpi icon={Store} label="Outlets" value={formatNumber(d.outlets.total)} href={live ? '/outlets' : undefined}>
              <SplitMeter a={d.outlets.active} b={d.outlets.inactive} aLabel="Active" bLabel="Inactive" />
            </Kpi>
            <Kpi icon={CalendarDays} label="Today" value={formatINRWhole(d.transactions.today.billAmount)} href={live ? '/transactions?range=today' : undefined}>
              <p className="text-[11px] text-stone-500">
                <span className="tabular font-medium text-stone-800">{formatNumber(d.transactions.today.billCount)}</span> bills ·{' '}
                <span className="tabular font-medium text-stone-800">{formatINR(d.transactions.today.discountAmount)}</span> discounted
              </p>
              <p className="mt-1.5 text-[11px] text-stone-500">
                All time <span className="tabular font-medium text-stone-800">{formatCompactINR(d.transactions.allTime.billAmount)}</span> ·{' '}
                {formatNumber(d.transactions.allTime.billCount)} bills
              </p>
            </Kpi>
            <Kpi icon={Coins} label="Points in wallets" value={formatNumber(d.points.creditedPoints)}>
              <p className="text-[11px] text-stone-500">
                Worth <span className="tabular font-medium text-gold-700">{formatINR(pointsValue)}</span> at{' '}
                {formatNumber(d.points.pointsRatio.points)} pts = ₹{formatNumber(d.points.pointsRatio.rupees)}
              </p>
              <p className="mt-1.5 text-[11px] text-stone-500">
                <span className="tabular font-medium text-stone-800">{formatNumber(d.points.pendingPoints)}</span> held for unregistered customers
              </p>
            </Kpi>
          </Panel>

          {/* Referrals and points over the period */}
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel className="min-w-0">
              <PanelHeader
                title="Referrals"
                description="Taps of “Share QR” in the Partner App, and the bills customers then closed with a referral QR."
              />
              <PanelBody>
                <TrendChart
                  height={190}
                  data={d.trend}
                  emptyLabel="No referral activity in this period"
                  metrics={[
                    { key: 'referralBills', label: 'Successful referrals' },
                    { key: 'referralShares', label: 'QR shares' },
                  ]}
                />
                <Stats
                  items={[
                    { label: 'QR shares', value: formatNumber(d.referrals.shares) },
                    { label: 'Successful referrals', value: formatNumber(d.referrals.successful) },
                    {
                      label: 'Referrals per 100 shares',
                      value: shareToReferral === null ? '—' : formatNumber(Math.round(shareToReferral)),
                      hint: 'Successful referrals in the period for every 100 Share QR taps in the period',
                    },
                    { label: 'Rewards used', value: formatNumber(d.referrals.rewardsUsed), hint: 'Own bills that used a referral reward discount' },
                  ]}
                />
              </PanelBody>
            </Panel>

            <Panel className="min-w-0">
              <PanelHeader title="Points" description="Points issued on bills, and points partners spent with their redeem QR." />
              <PanelBody>
                <TrendChart
                  height={190}
                  data={d.trend}
                  emptyLabel="No points movement in this period"
                  metrics={[
                    { key: 'pointsCredited', label: 'Credited' },
                    { key: 'pointsRedeemed', label: 'Redeemed' },
                  ]}
                />
                <Stats
                  items={[
                    { label: 'Credited', value: formatNumber(d.pointsFlow.credited) },
                    { label: 'Redeemed', value: formatNumber(d.pointsFlow.redeemed) },
                    { label: 'Redemptions', value: formatNumber(d.pointsFlow.redemptionCount) },
                    { label: 'Redeemed value', value: formatINR(d.pointsFlow.redeemedRupees) },
                  ]}
                />
              </PanelBody>
            </Panel>
          </div>

          {/* Rankings and mix for the period */}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Panel>
              <PanelHeader title="Top outlets" description="By gross sales in this period" />
              <PanelBody>
                <BarList
                  format={formatCompactINR}
                  emptyLabel="No sales in this period"
                  items={d.topOutlets.map((o) => ({
                    key: o.id,
                    label: (
                      <RecordLink live={live} href={`/outlets/${o.id}?${rangeQuery}`} className="hover:text-maroon-700">
                        {o.name}
                        {o.status === 'INACTIVE' && <span className="ml-1.5 text-[11px] text-stone-400">(inactive)</span>}
                      </RecordLink>
                    ),
                    value: o.billAmount,
                    hint: `${formatNumber(o.billCount)} bills · ${formatINR(o.billAmount)}`,
                  }))}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title="Top referrers" description="By successful referrals in this period" />
              <PanelBody>
                <BarList
                  emptyLabel="No referral bills in this period"
                  items={d.topReferrers.map((r) => ({
                    key: r.id,
                    label: (
                      <RecordLink live={live} href={`/partners/${r.id}?kind=REFERRAL&${rangeQuery}`} className="hover:text-maroon-700">
                        {r.name} <span className="font-mono text-[11px] text-stone-400">{r.partnerCode}</span>
                      </RecordLink>
                    ),
                    value: r.referralCount,
                    hint: `${formatINR(r.billAmount)} sales · ${formatNumber(r.referralPoints)} referral points`,
                  }))}
                />
              </PanelBody>
            </Panel>

            <Panel className="lg:col-span-2 xl:col-span-1">
              <PanelHeader title="Bills by type" description="Gross sales in this period" />
              <PanelBody>
                <BarList
                  format={formatCompactINR}
                  emptyLabel="No sales in this period"
                  items={(['DIRECT_PARTNER', 'REFERRAL'] as const).map((t) => ({
                    key: t,
                    label: (
                      <RecordLink live={live} href={`/transactions?type=${t}&${rangeQuery}`} className="hover:text-maroon-700">
                        {BILL_TYPE_LABEL[t]}{' '}
                        <span className="text-[11px] text-stone-400">{formatNumber(d.periodByType[t].billCount)} bills</span>
                      </RecordLink>
                    ),
                    value: d.periodByType[t].billAmount,
                    hint: formatINR(d.periodByType[t].billAmount),
                  }))}
                />
                <div className="mt-5 border-t border-stone-150 pt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
                    <span>Bill messages delivered</span>
                    <span className="tabular">
                      {formatNumber(d.notifications.SENT)} / {formatNumber(notificationTotal)}
                    </span>
                  </div>
                  <SplitMeter a={d.notifications.SENT} b={notificationTotal - d.notifications.SENT} aLabel="Sent" bLabel="Not sent" />
                </div>
              </PanelBody>
            </Panel>
          </div>

          {/* Network growth */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel className="min-w-0 xl:col-span-2">
              <PanelHeader title="New partners" description="Registrations in the Partner App over this period" />
              <PanelBody>
                <TrendChart
                  height={190}
                  data={d.trend}
                  emptyLabel="No registrations in this period"
                  metrics={[{ key: 'newPartners', label: 'New partners', tick: formatCompact }]}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Newest partners"
                actions={
                  live && (
                    <Link href="/partners" className={buttonClass('ghost', 'sm')}>
                      All <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )
                }
              />
              {d.recentPartners.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-stone-400">No partners have registered yet</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {d.recentPartners.map((p) => (
                    <li key={p.id}>
                      <RecordLink live={live} href={`/partners/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-25">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-[11px] font-semibold text-maroon-700">
                          {initials(p.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-stone-900">{p.name}</p>
                          <p className="truncate text-xs text-stone-500">{p.city ?? p.partnerCode}</p>
                        </div>
                        <span className="shrink-0 text-xs text-stone-400">{formatRelative(p.createdAt)}</span>
                      </RecordLink>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* Activity + attention */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel className="min-w-0 xl:col-span-2">
              <PanelHeader
                title="Latest transactions"
                description="Most recent bills in this period. Select a row for the full breakdown."
                actions={
                  live && (
                    <Link href={`/transactions?${rangeQuery}`} className={buttonClass('ghost', 'sm')}>
                      View all <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )
                }
              />
              <BillsTable bills={d.recentBills} onSelect={setSelected} emptyTitle="No transactions in this period" emptyDescription="Try a wider period." />
            </Panel>

            <div className="space-y-6">
              <Panel>
                <PanelHeader
                  title="Needs attention"
                  actions={attention.length > 0 && <Badge tone="warning" icon={false}>{attention.length}</Badge>}
                />
                {attention.length === 0 ? (
                  <PanelBody className="flex items-center gap-3 text-[13px] text-stone-600">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Nothing needs your attention right now.
                  </PanelBody>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {attention.map((a) => (
                      <li key={a.title} className="flex items-start gap-3 px-5 py-3.5">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotTone[a.tone])} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-stone-900">{a.title}</p>
                          <p className="text-xs leading-relaxed text-stone-500">{a.body}</p>
                        </div>
                        {a.href && (
                          <Link href={a.href} className="shrink-0 text-xs font-medium text-maroon-700 hover:underline">
                            {a.cta}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel>
                <PanelHeader title="System status" />
                <ul className="divide-y divide-stone-100 text-[13px]">
                  <li className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="flex items-center gap-2 text-stone-600">
                      <Database className="h-4 w-4 text-stone-400" /> Database
                    </span>
                    <Badge tone={d.system.database === 'connected' ? 'success' : 'danger'}>
                      {d.system.database === 'connected' ? 'Connected' : 'Unreachable'}
                    </Badge>
                  </li>
                  <li className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="flex items-center gap-2 text-stone-600">
                      {d.system.messagingMode === 'whatsapp' ? (
                        <MessageCircle className="h-4 w-4 text-stone-400" />
                      ) : (
                        <Mail className="h-4 w-4 text-stone-400" />
                      )}
                      Messaging
                    </span>
                    <Tag gold>{d.system.messagingMode === 'whatsapp' ? 'WhatsApp' : 'Email'}</Tag>
                  </li>
                  <li className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="flex items-center gap-2 text-stone-600">
                      <Settings2 className="h-4 w-4 text-stone-400" /> Programme settings
                    </span>
                    {d.system.settingsConfigured ? (
                      <span className="text-xs text-stone-500" title={d.system.settingsUpdatedAt ? formatDateTime(d.system.settingsUpdatedAt) : undefined}>
                        Saved {d.system.settingsUpdatedAt ? formatRelative(d.system.settingsUpdatedAt) : ''}
                      </span>
                    ) : (
                      <Badge tone="danger">Not saved</Badge>
                    )}
                  </li>
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}

      <BillDrawer bill={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
