'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Coins,
  Database,
  Mail,
  MessageCircle,
  RefreshCw,
  Settings2,
  Store,
  Users,
} from 'lucide-react';
import type { AdminDashboard, BillRecord } from '@lotmorewins/types';
import { BarList, SalesChart, SplitMeter } from '@/components/admin/charts';
import { BillDrawer, BillsTable } from '@/components/admin/bills';
import { Badge, Tag } from '@/components/ui/badge';
import { buttonClass, Button } from '@/components/ui/button';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { adminApi, useAdminQuery } from '@/lib/admin-client';
import { PARTNER_ROLE_LABEL, PARTNER_STATUS } from '@/lib/admin-labels';
import { cn } from '@/lib/utils';
import {
  formatCompactINR,
  formatDateTime,
  formatINR,
  formatINRWhole,
  formatNumber,
  formatRelative,
  formatTime,
  initials,
  percentChange,
} from '@/lib/format';

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (current === 0 && previous === 0) return <span className="text-xs text-stone-500">No sales in the last 60 days</span>;
  const pct = percentChange(current, previous);
  if (pct === null) return <span className="text-xs text-stone-500">No sales in the {label} before</span>;
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
      vs previous 30 days
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

type Attention = { tone: 'danger' | 'warning' | 'info'; title: string; body: string; href?: string; cta?: string };

function attentionItems(d: AdminDashboard): Attention[] {
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
      body: 'Customers did not receive their bill summary.',
      href: '/transactions?notification=FAILED',
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
      <Skeleton className="h-[340px] w-full rounded-lg" />
      <Skeleton className="h-[150px] w-full rounded-lg" />
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-[380px] rounded-lg xl:col-span-2" />
        <Skeleton className="h-[380px] rounded-lg" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: d, error, loading, reload } = useAdminQuery(() => adminApi.getAdminDashboard().then((r) => r.data), []);
  const [selected, setSelected] = useState<BillRecord | null>(null);

  const last30 = d?.transactions.last30Days;
  const avgBill = last30 && last30.billCount ? last30.billAmount / last30.billCount : 0;
  const pointsValue = d ? (d.points.creditedPoints * d.points.pointsRatio.rupees) / (d.points.pointsRatio.points || 1) : 0;
  const attention = d ? attentionItems(d) : [];

  return (
    <>
      <PageHeader
        title="Programme overview"
        description="Sales, network health and anything that needs your attention, across every outlet."
        actions={
          <Button variant="secondary" onClick={reload} loading={loading && !!d}>
            {!(loading && d) && <RefreshCw className="h-4 w-4" />}
            {d ? `Updated ${formatTime(d.generatedAt)}` : 'Refresh'}
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-6" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {!d ? (
        !error && <DashboardSkeleton />
      ) : (
        <div className="space-y-6 animate-rise-in">
          {/* Hero: 30-day sales */}
          <Panel className="overflow-hidden">
            <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-stone-150 bg-gradient-to-b from-maroon-50/60 to-transparent p-6 lg:border-b-0 lg:border-r">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-600">Gross sales · last 30 days</p>
                <p className="mt-3 text-[44px] font-semibold leading-none tracking-[-0.02em] text-stone-900">
                  {formatINRWhole(last30!.billAmount)}
                </p>
                <div className="mt-3">
                  <Delta current={last30!.billAmount} previous={d.transactions.previous30Days.billAmount} label="30 days" />
                </div>
                <dl className="mt-8 space-y-3 border-t border-stone-150 pt-5 text-[13px]">
                  {[
                    ['Bills', formatNumber(last30!.billCount)],
                    ['Average bill', formatINR(avgBill)],
                    ['Discounts given', formatINR(last30!.discountAmount)],
                    ['Collected by outlets', formatINR(last30!.finalAmount)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4">
                      <dt className="text-stone-500">{k}</dt>
                      <dd className="tabular font-medium text-stone-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="min-w-0 p-6">
                <SalesChart data={d.transactions.daily} />
              </div>
            </div>
          </Panel>

          {/* KPI strip: one panel, four divided cells */}
          <Panel className="grid gap-px overflow-hidden bg-stone-150 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} label="Partners" value={formatNumber(d.partners.total)} href="/partners">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
                {(['ACTIVE', 'PENDING', 'SUSPENDED'] as const).map((s) => (
                  <span key={s}>
                    {PARTNER_STATUS[s].label} <span className="tabular font-medium text-stone-800">{formatNumber(d.partners.byStatus[s])}</span>
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-stone-500">
                <span className="font-medium text-gold-700">+{formatNumber(d.partners.newLast30Days)}</span> joined in 30 days
              </p>
            </Kpi>
            <Kpi icon={Store} label="Outlets" value={formatNumber(d.outlets.total)} href="/outlets">
              <SplitMeter a={d.outlets.active} b={d.outlets.inactive} aLabel="Active" bLabel="Inactive" />
            </Kpi>
            <Kpi icon={CalendarDays} label="Today" value={formatINRWhole(d.transactions.today.billAmount)} href="/transactions?range=today">
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

          {/* Activity + attention */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel className="min-w-0 xl:col-span-2">
              <PanelHeader
                title="Recent transactions"
                description="Latest bills across all outlets. Select a row for the full breakdown."
                actions={
                  <Link href="/transactions" className={buttonClass('ghost', 'sm')}>
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <BillsTable bills={d.recentBills} onSelect={setSelected} />
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
                  <li className="px-5 py-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
                      <span>Bill messages delivered</span>
                      <span className="tabular">
                        {formatNumber(d.notifications.SENT)} / {formatNumber(Object.values(d.notifications).reduce((a, b) => a + b, 0))}
                      </span>
                    </div>
                    <SplitMeter
                      a={d.notifications.SENT}
                      b={d.notifications.FAILED + d.notifications.PENDING + d.notifications.SKIPPED}
                      aLabel="Sent"
                      bLabel="Not sent"
                    />
                  </li>
                </ul>
              </Panel>
            </div>
          </div>

          {/* Breakdowns */}
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Panel>
              <PanelHeader title="Top outlets" description="By gross sales, all time" />
              <PanelBody>
                <BarList
                  format={formatCompactINR}
                  emptyLabel="No sales recorded yet"
                  items={d.topOutlets.map((o) => ({
                    key: o.id,
                    label: (
                      <Link href={`/outlets/${o.id}`} className="hover:text-maroon-700">
                        {o.name}
                        {o.status === 'INACTIVE' && <span className="ml-1.5 text-[11px] text-stone-400">(inactive)</span>}
                      </Link>
                    ),
                    value: o.billAmount,
                    hint: `${formatNumber(o.billCount)} bills · ${formatINR(o.billAmount)}`,
                  }))}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title="Partner mix" description="Registered partners by affiliation" />
              <PanelBody>
                <BarList
                  emptyLabel="No partners yet"
                  items={(['NON_ACHARIYA', 'STAFF', 'TEACHER', 'PARENT'] as const).map((r) => ({
                    key: r,
                    label: (
                      <Link href={`/partners?role=${r}`} className="hover:text-maroon-700">
                        {PARTNER_ROLE_LABEL[r]}
                      </Link>
                    ),
                    value: d.partners.byRole[r],
                  }))}
                />
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-150 pt-4 text-xs text-stone-500">
                  <div>
                    Direct bills <p className="tabular text-sm font-semibold text-stone-900">{formatNumber(d.transactions.byType.DIRECT_PARTNER)}</p>
                  </div>
                  <div>
                    Referral bills <p className="tabular text-sm font-semibold text-stone-900">{formatNumber(d.transactions.byType.REFERRAL)}</p>
                  </div>
                </div>
              </PanelBody>
            </Panel>

            <Panel className="lg:col-span-2 xl:col-span-1">
              <PanelHeader
                title="Newest partners"
                actions={
                  <Link href="/partners" className={buttonClass('ghost', 'sm')}>
                    All <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              {d.recentPartners.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-stone-400">No partners have registered yet</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {d.recentPartners.map((p) => (
                    <li key={p.id}>
                      <Link href={`/partners/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-25">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-[11px] font-semibold text-maroon-700">
                          {initials(p.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-stone-900">{p.name}</p>
                          <p className="truncate text-xs text-stone-500">{PARTNER_ROLE_LABEL[p.role]}</p>
                        </div>
                        <span className="shrink-0 text-xs text-stone-400">{formatRelative(p.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      <BillDrawer bill={selected} onClose={() => setSelected(null)} />
    </>
  );
}
