'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Users, X } from 'lucide-react';
import type { AdminPartnerSort, PartnerRole, PartnerStatus } from '@lotmorewins/types';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Segmented } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Pagination, SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll, TableToolbar } from '@/components/ui/table';
import { adminApi, useAdminQuery, useDebounced } from '@/lib/admin-client';
import { PARTNER_ROLE_LABEL, PARTNER_STATUS } from '@/lib/admin-labels';
import { formatDate, formatNumber, initials } from '@/lib/format';

const PAGE_SIZE = 20;
const STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED'] as const;
const ROLES = ['NON_ACHARIYA', 'STAFF', 'TEACHER', 'PARENT'] as const;

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function PartnersView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<PartnerStatus | undefined>(pick(params.get('status'), STATUSES));
  const [role, setRole] = useState<PartnerRole | undefined>(pick(params.get('role'), ROLES));
  const [sort, setSort] = useState<AdminPartnerSort>(pick(params.get('sort'), ['newest', 'oldest', 'name'] as const) ?? 'newest');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const q = useDebounced(search.trim());

  // Keep filters in the URL so views can be shared and survive back/forward.
  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (role) next.set('role', role);
    if (sort !== 'newest') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [q, status, role, sort, page, pathname, router]);

  const { data, error, loading, reload } = useAdminQuery(
    () => adminApi.listAdminPartners({ page, limit: PAGE_SIZE, search: q || undefined, status, role, sort }),
    [page, q, status, role, sort]
  );
  const partners = data?.data ?? null;
  const filtered = Boolean(q || status || role);
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Partners"
        description="Everyone registered in the Partner App — their affiliation, status, activity and points balance."
        meta={data && <Tag className="tabular">{formatNumber(data.meta.total)} {filtered ? 'matching' : 'total'}</Tag>}
      />

      {error && (
        <Alert tone="danger" className="mb-4" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Panel className="animate-rise-in">
        <TableToolbar>
          <div className="w-full lg:max-w-xs">
            <Input
              icon={Search}
              placeholder="Name, mobile, email or code"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search partners"
            />
          </div>
          <Segmented<'ALL' | PartnerStatus>
            label="Status"
            value={status ?? 'ALL'}
            onChange={(v) => resetPage(setStatus)(v === 'ALL' ? undefined : v)}
            options={[{ value: 'ALL', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: PARTNER_STATUS[s].label }))]}
            className="max-w-full overflow-x-auto"
          />
          <div className="flex gap-2 lg:ml-auto">
            <Select
              aria-label="Affiliation"
              value={role ?? ''}
              onChange={(e) => resetPage(setRole)((e.target.value || undefined) as PartnerRole | undefined)}
              className="w-44"
            >
              <option value="">All affiliations</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {PARTNER_ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            <Select aria-label="Sort" value={sort} onChange={(e) => resetPage(setSort)(e.target.value as AdminPartnerSort)} className="w-36">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </Select>
          </div>
        </TableToolbar>

        {partners && partners.length === 0 && !loading ? (
          <EmptyState
            icon={Users}
            title={filtered ? 'No partners match these filters' : 'No partners yet'}
            description={
              filtered ? 'Try a different search or clear the filters.' : 'Partners appear here once they register in the Partner App.'
            }
            action={
              filtered && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setStatus(undefined);
                    setRole(undefined);
                    setPage(1);
                  }}
                >
                  <X className="h-4 w-4" /> Clear filters
                </Button>
              )
            }
          />
        ) : (
          <TableScroll>
            <Table className="min-w-[860px]">
              <THead>
                <tr>
                  <TH>Partner</TH>
                  <TH>Contact</TH>
                  <TH>Affiliation</TH>
                  <TH align="right">Bills</TH>
                  <TH align="right">Points</TH>
                  <TH>Status</TH>
                  <TH>Joined</TH>
                </tr>
              </THead>
              <TBody className={loading && partners ? 'opacity-60 transition-opacity' : undefined}>
                {!partners ? (
                  <SkeletonRows cols={7} rows={8} />
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
                      <TD>
                        <Tag gold={p.isAchariyaAssociated}>{PARTNER_ROLE_LABEL[p.role]}</Tag>
                      </TD>
                      <TD align="right">
                        <span className="text-stone-900">{formatNumber(p.directBillCount)}</span>
                        {p.referredBillCount > 0 && (
                          <span className="block text-[11px] text-stone-400">+{formatNumber(p.referredBillCount)} referred</span>
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
