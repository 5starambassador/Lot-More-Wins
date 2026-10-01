'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { BillNotificationStatus, BillRecord, BillTransactionType } from '@lotmorewins/types';
import { BillDrawer, BillsTable } from '@/components/admin/bills';
import { DateRangeFilter, FilterBar, NO_DATES, dateQuery, lastDays, readDateRange, type DateRange } from '@/components/admin/filter-bar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Pagination } from '@/components/ui/table';
import { adminApi, useAdminQuery, useDebounced } from '@/lib/admin-client';
import { BILL_TYPE_LABEL, NOTIFICATION_STATUS } from '@/lib/admin-labels';
import { formatINR, formatNumber } from '@/lib/format';

const PAGE_SIZE = 25;
const TYPES = ['DIRECT_PARTNER', 'REFERRAL'] as const;
const NOTIFICATIONS = ['SENT', 'PENDING', 'FAILED', 'SKIPPED'] as const;
const UUID = /^[0-9a-f-]{36}$/i;

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/** Dates from the URL; older links still carry a `range` preset instead of from / to. */
function initialDates(params: URLSearchParams): DateRange {
  const preset = params.get('range');
  const fallback = preset === 'today' ? lastDays(1) : preset === '7d' ? lastDays(7) : preset === '30d' ? lastDays(30) : NO_DATES;
  return readDateRange(params, fallback);
}

function TransactionsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [dates, setDates] = useState(() => initialDates(params));
  const [outletId, setOutletId] = useState(UUID.test(params.get('outletId') ?? '') ? params.get('outletId')! : '');
  const [partnerId, setPartnerId] = useState(UUID.test(params.get('partnerId') ?? '') ? params.get('partnerId')! : '');
  const [type, setType] = useState<BillTransactionType | undefined>(pick(params.get('type'), TYPES));
  const [notification, setNotification] = useState<BillNotificationStatus | undefined>(pick(params.get('notification'), NOTIFICATIONS));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BillRecord | null>(null);
  const q = useDebounced(search.trim());

  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (dates.from) next.set('from', dates.from);
    if (dates.to) next.set('to', dates.to);
    if (outletId) next.set('outletId', outletId);
    if (partnerId) next.set('partnerId', partnerId);
    if (type) next.set('type', type);
    if (notification) next.set('notification', notification);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [q, dates, outletId, partnerId, type, notification, pathname, router]);

  const filters = {
    search: q || undefined,
    ...dateQuery(dates),
    outletId: outletId || undefined,
    partnerId: partnerId || undefined,
    type,
    notification,
  };
  const outlets = useAdminQuery(() => adminApi.listAdminOutlets().then((r) => r.data), []);
  const { data, error, loading, reload } = useAdminQuery(
    () => adminApi.listAdminTransactions({ page, limit: PAGE_SIZE, ...filters }).then((r) => r.data),
    [page, q, dates.from, dates.to, outletId, partnerId, type, notification]
  );

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const filtered = Boolean(q || dates.from || dates.to || outletId || partnerId || type || notification);
  const clearAll = () => {
    setSearch('');
    setDates(NO_DATES);
    setOutletId('');
    setPartnerId('');
    setType(undefined);
    setNotification(undefined);
    setPage(1);
  };
  const s = data?.summary;
  const partnerName =
    partnerId &&
    data?.bills
      .map((b) => (b.partner?.id === partnerId ? b.partner : b.referrerPartner?.id === partnerId ? b.referrerPartner : null))
      .find(Boolean)?.name;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every bill created by every outlet, with the discount applied, points credited and message delivery."
      />

      <FilterBar onClear={filtered && clearAll} exportCsv={{ path: '/admin/transactions', params: filters }}>
        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            placeholder="Partner / customer name, email, mobile or bill no."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search transactions"
          />
        </div>
        <DateRangeFilter value={dates} onChange={reset(setDates)} />
        <Select aria-label="Outlet" value={outletId} onChange={(e) => reset(setOutletId)(e.target.value)} className="w-44">
          <option value="">All outlets</option>
          {outlets.data?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Transaction type"
          value={type ?? ''}
          onChange={(e) => reset(setType)((e.target.value || undefined) as BillTransactionType | undefined)}
          className="w-36"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {BILL_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Message status"
          value={notification ?? ''}
          onChange={(e) => reset(setNotification)((e.target.value || undefined) as BillNotificationStatus | undefined)}
          className="w-44"
        >
          <option value="">Any message status</option>
          {NOTIFICATIONS.map((n) => (
            <option key={n} value={n}>
              Message {NOTIFICATION_STATUS[n].label.toLowerCase()}
            </option>
          ))}
        </Select>
        {partnerId && (
          <button
            type="button"
            onClick={() => reset(setPartnerId)('')}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-gold-300 bg-gold-50 px-3 text-xs font-medium text-gold-800 hover:bg-gold-100"
          >
            Partner{partnerName ? `: ${partnerName}` : ''} <X className="h-3 w-3" />
          </button>
        )}
      </FilterBar>

      {/* Totals for the current filter */}
      <Panel className="mb-6 grid grid-cols-2 gap-px overflow-hidden bg-stone-150 animate-rise-in md:grid-cols-5">
        {[
          { label: 'Bills', value: s ? formatNumber(s.billCount) : '—' },
          { label: 'Gross sales', value: s ? formatINR(s.billAmount) : '—', strong: true },
          { label: 'Discounts', value: s ? formatINR(s.discountAmount) : '—' },
          { label: 'Collected', value: s ? formatINR(s.finalAmount) : '—' },
          { label: 'Points issued', value: s ? formatNumber(s.purchasePoints + s.referralPoints) : '—' },
        ].map((m) => (
          <div key={m.label} className="bg-white px-5 py-4 last:col-span-2 md:last:col-span-1">
            <p className="text-xs text-stone-500">{m.label}</p>
            <p className={`tabular mt-1 truncate text-lg font-semibold ${m.strong ? 'text-maroon-800' : 'text-stone-900'}`}>{m.value}</p>
          </div>
        ))}
      </Panel>

      {error && (
        <Alert tone="danger" className="mb-4" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Panel>
        <div className={loading && data ? 'opacity-60 transition-opacity' : undefined}>
          <BillsTable
            bills={data?.bills ?? null}
            onSelect={setSelected}
            emptyTitle={filtered ? 'No transactions match' : 'No transactions yet'}
            emptyDescription={
              filtered ? 'Try a wider date range or clear the filters.' : 'Bills appear here as soon as an outlet completes a sale.'
            }
          />
        </div>
        {data && (
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            noun="bills"
          />
        )}
      </Panel>

      <BillDrawer bill={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsView />
    </Suspense>
  );
}
