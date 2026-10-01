'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import type { AdminPartnerSort, PartnerStatus } from '@lotmorewins/types';
import { DateRangeFilter, FilterBar, NO_DATES, dateQuery, readDateRange } from '@/components/admin/filter-bar';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Pagination, SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { adminApi, useAdminQuery, useDebounced } from '@/lib/admin-client';
import { PARTNER_STATUS } from '@/lib/admin-labels';
import { formatDate, formatNumber, initials } from '@/lib/format';

const PAGE_SIZE = 20;
const STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED'] as const;
const REFERRALS = ['with', 'without'] as const;
type ReferralFilter = (typeof REFERRALS)[number];

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function PartnersView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<PartnerStatus | undefined>(pick(params.get('status'), STATUSES));
  const [referrals, setReferrals] = useState<ReferralFilter | undefined>(pick(params.get('referrals'), REFERRALS));
  const [dates, setDates] = useState(() => readDateRange(params));
  const [sort, setSort] = useState<AdminPartnerSort>(pick(params.get('sort'), ['newest', 'oldest', 'name'] as const) ?? 'newest');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const q = useDebounced(search.trim());

  // Keep filters in the URL so views can be shared and survive back/forward.
  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (referrals) next.set('referrals', referrals);
    if (dates.from) next.set('from', dates.from);
    if (dates.to) next.set('to', dates.to);
    if (sort !== 'newest') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [q, status, referrals, dates, sort, page, pathname, router]);

  const filters = { search: q || undefined, status, referrals, sort, ...dateQuery(dates) };
  const { data, error, loading, reload } = useAdminQuery(
    () => adminApi.listAdminPartners({ page, limit: PAGE_SIZE, ...filters }),
    [page, q, status, referrals, dates.from, dates.to, sort]
  );
  const partners = data?.data ?? null;
  const filtered = Boolean(q || status || referrals || dates.from || dates.to);
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const clearAll = () => {
    setSearch('');
    setStatus(undefined);
    setReferrals(undefined);
    setDates(NO_DATES);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Partners"
        description="Everyone registered in the Partner App — their location, status, activity, referrals and points balance. Select a partner for their full tracking."
        meta={data && <Tag className="tabular">{formatNumber(data.meta.total)} {filtered ? 'matching' : 'total'}</Tag>}
      />

      <FilterBar onClear={filtered && clearAll} exportCsv={{ path: '/admin/partners', params: filters }}>
        <div className="w-full sm:w-64">
          <Input
            icon={Search}
            placeholder="Name, mobile, email, ID, code or city"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search partners"
          />
        </div>
        <DateRangeFilter label="Joined" value={dates} onChange={resetPage(setDates)} />
        <Select
          aria-label="Status"
          value={status ?? ''}
          onChange={(e) => resetPage(setStatus)((e.target.value || undefined) as PartnerStatus | undefined)}
          className="w-36"
        >
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {PARTNER_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Referrals"
          value={referrals ?? ''}
          onChange={(e) => resetPage(setReferrals)((e.target.value || undefined) as ReferralFilter | undefined)}
          className="w-52"
        >
          <option value="">All partners</option>
          <option value="with">With successful referrals</option>
          <option value="without">No successful referrals yet</option>
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => resetPage(setSort)(e.target.value as AdminPartnerSort)} className="w-36">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </Select>
      </FilterBar>

      {error && (
        <Alert tone="danger" className="mb-4" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Panel className="animate-rise-in">
        {partners && partners.length === 0 && !loading ? (
          <EmptyState
            icon={Users}
            title={filtered ? 'No partners match these filters' : 'No partners yet'}
            description={
              filtered ? 'Try a different search or clear the filters.' : 'Partners appear here once they register in the Partner App.'
            }
            action={filtered && <Button variant="secondary" onClick={clearAll}>Clear filters</Button>}
          />
        ) : (
          <TableScroll>
            <Table className="min-w-[960px]">
              <THead>
                <tr>
                  <TH>Partner</TH>
                  <TH>Contact</TH>
                  <TH>City</TH>
                  <TH align="right">Own bills</TH>
                  <TH align="right">Referrals</TH>
                  <TH align="right">Points</TH>
                  <TH>Status</TH>
                  <TH>Joined</TH>
                </tr>
              </THead>
              <TBody className={loading && partners ? 'opacity-60 transition-opacity' : undefined}>
                {!partners ? (
                  <SkeletonRows cols={8} rows={8} />
                ) : (
                  partners.map((p) => (
                    <TR
                      key={p.id}
                      interactive
                      tabIndex={0}
                      onClick={() => router.push(`/partners/${p.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && router.push(`/partners/${p.id}`)}
                    >
                      <TD>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-[11px] font-semibold text-maroon-700">
                            {initials(p.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-stone-900">{p.name}</p>
                            <p className="font-mono text-[11px] text-stone-500">{p.partnerCode}</p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <p className="tabular text-stone-800">{p.mobile}</p>
                        <p className="max-w-[220px] truncate text-xs text-stone-500">{p.email}</p>
                      </TD>
                      <TD className="text-stone-700">{p.city ?? <span className="text-stone-300">—</span>}</TD>
                      <TD align="right" className="text-stone-900">
                        {formatNumber(p.directBillCount)}
                      </TD>
                      <TD align="right">
                        <span className="text-stone-900">{formatNumber(p.referredBillCount)}</span>
                        {p.referralShareCount > 0 && (
                          <span className="block text-[11px] text-stone-400">{formatNumber(p.referralShareCount)} QR shares</span>
                        )}
                      </TD>
                      <TD align="right" className="font-medium text-stone-900">
                        {formatNumber(p.pointsBalance)}
                      </TD>
                      <TD>
                        <Badge tone={PARTNER_STATUS[p.status].tone}>{PARTNER_STATUS[p.status].label}</Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-stone-500">{formatDate(p.createdAt)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroll>
        )}
        {data && (
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            noun="partners"
          />
        )}
      </Panel>
    </>
  );
}

export default function PartnersPage() {
  return (
    <Suspense>
      <PartnersView />
    </Suspense>
  );
}
