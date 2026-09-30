'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MoreHorizontal, Plus, Power, Search, Store, X } from 'lucide-react';
import type { AdminOutlet, OutletStatus } from '@lotmorewins/types';
import { Badge, Tag } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { PageHeader, Segmented } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Pagination, SkeletonRows, SortTH, TBody, TD, TH, THead, TR, Table, TableScroll, TableToolbar } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, isUnauthenticated, useAdminQuery } from '@/lib/admin-client';
import { OUTLET_STATUS } from '@/lib/admin-labels';
import { OutletLogo } from '@/components/admin/outlet-form';
import { formatDate, formatNumber } from '@/lib/format';

const PAGE_SIZE = 15;
type SortKey = 'name' | 'billCount' | 'createdAt';

function OutletsView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { data: outlets, error, reload, setData } = useAdminQuery(() => adminApi.listAdminOutlets().then((r) => r.data), []);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | OutletStatus>(
    params.get('status') === 'INACTIVE' ? 'INACTIVE' : params.get('status') === 'ACTIVE' ? 'ACTIVE' : 'ALL'
  );
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<AdminOutlet | null>(null);
  const [toggling, setToggling] = useState(false);

  const counts = useMemo(
    () => ({
      ALL: outlets?.length ?? 0,
      ACTIVE: outlets?.filter((o) => o.status === 'ACTIVE').length ?? 0,
      INACTIVE: outlets?.filter((o) => o.status === 'INACTIVE').length ?? 0,
    }),
    [outlets]
  );

  const rows = useMemo(() => {
    if (!outlets) return null;
    const term = search.trim().toLowerCase();
    const list = outlets.filter(
      (o) =>
        (status === 'ALL' || o.status === status) &&
        (!term || [o.name, o.email, o.mobile, o.adminEmail ?? ''].some((v) => v.toLowerCase().includes(term)))
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
      if (sort.key === 'billCount') return (a.billCount - b.billCount) * dir;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
  }, [outlets, search, status, sort]);

  const totalPages = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = rows?.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) ?? null;
  const onSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const toggle = async () => {
    if (!confirming) return;
    const next = confirming.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setToggling(true);
    try {
      const res = await adminApi.updateAdminOutlet(confirming.id, { status: next });
      setData((list) => list?.map((o) => (o.id === res.data.id ? res.data : o)) ?? null);
      toast('success', next === 'ACTIVE' ? `${res.data.name} activated` : `${res.data.name} deactivated`);
      setConfirming(null);
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else toast('error', 'Could not change outlet status', errorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  const filtered = Boolean(search.trim() || status !== 'ALL');

  return (
    <>
      <PageHeader
        title="Outlets"
        description="Participating stores. Active outlets are listed in the Partner App and can scan and bill; inactive outlets cannot transact."
        actions={
          <Link href="/outlets/new" className={buttonClass('primary')}>
            <Plus className="h-4 w-4" /> New outlet
          </Link>
        }
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
              placeholder="Name, email, mobile or admin login"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search outlets"
            />
          </div>
          <Segmented<'ALL' | OutletStatus>
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All', count: counts.ALL },
              { value: 'ACTIVE', label: 'Active', count: counts.ACTIVE },
              { value: 'INACTIVE', label: 'Inactive', count: counts.INACTIVE },
            ]}
            className="lg:ml-auto"
          />
        </TableToolbar>

        {rows && rows.length === 0 ? (
          outlets?.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No outlets yet"
              description="Create the first outlet and its admin login to start accepting partner QR codes."
              action={
                <Link href="/outlets/new" className={buttonClass('primary')}>
                  <Plus className="h-4 w-4" /> New outlet
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="No outlets match"
              description="Try another search term or status."
              action={
                filtered && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setStatus('ALL');
                    }}
                  >
                    <X className="h-4 w-4" /> Clear filters
                  </Button>
                )
              }
            />
          )
        ) : (
          <TableScroll>
            <Table className="min-w-[820px]">
              <THead>
                <tr>
                  <SortTH column="name" sort={sort} onSort={onSort}>
                    Outlet
                  </SortTH>
                  <TH>Contact</TH>
                  <TH>Admin login</TH>
                  <SortTH column="billCount" sort={sort} onSort={onSort} align="right">
                    Bills
                  </SortTH>
                  <TH>Status</TH>
                  <SortTH column="createdAt" sort={sort} onSort={onSort}>
                    Created
                  </SortTH>
                  <TH className="w-24">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {!pageRows ? (
                  <SkeletonRows cols={7} rows={6} />
                ) : (
                  pageRows.map((o) => (
                    <TR key={o.id} interactive tabIndex={0} onClick={() => router.push(`/outlets/${o.id}`)} onKeyDown={(e) => e.key === 'Enter' && router.push(`/outlets/${o.id}`)}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <OutletLogo outlet={o} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-stone-900">{o.name}</p>
                            {o.images.length > 0 && <p className="text-[11px] text-stone-400">{o.images.length} photos</p>}
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <p className="max-w-[200px] truncate text-stone-800">{o.email}</p>
                        <p className="tabular text-xs text-stone-500">{o.mobile}</p>
                      </TD>
                      <TD className="max-w-[200px] truncate text-stone-600">{o.adminEmail ?? <Tag>None</Tag>}</TD>
                      <TD align="right" className="font-medium text-stone-900">
                        {formatNumber(o.billCount)}
                      </TD>
                      <TD>
                        <Badge tone={OUTLET_STATUS[o.status].tone}>{OUTLET_STATUS[o.status].label}</Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-stone-500">{formatDate(o.createdAt)}</TD>
                      <TD align="right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setConfirming(o)}
                            title={o.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            aria-label={`${o.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${o.name}`}
                            className={`rounded-md p-2 transition-colors ${
                              o.status === 'ACTIVE' ? 'text-stone-400 hover:bg-red-50 hover:text-red-700' : 'text-stone-400 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/outlets/${o.id}`}
                            aria-label={`Open ${o.name}`}
                            className="rounded-md p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-900"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Link>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroll>
        )}
        {rows && (
          <Pagination page={current} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} noun="outlets" />
        )}
      </Panel>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={toggle}
        busy={toggling}
        tone={confirming?.status === 'ACTIVE' ? 'danger' : 'primary'}
        title={confirming?.status === 'ACTIVE' ? `Deactivate ${confirming?.name}?` : `Activate ${confirming?.name}?`}
        confirmLabel={confirming?.status === 'ACTIVE' ? 'Deactivate outlet' : 'Activate outlet'}
        description={
          confirming?.status === 'ACTIVE'
            ? 'The outlet disappears from the Partner App and its staff can no longer scan QR codes or create bills. Existing bills are kept.'
            : 'The outlet will be listed in the Partner App and its staff can scan QR codes and bill again.'
        }
      />
    </>
  );
}

export default function OutletsPage() {
  return (
    <Suspense>
      <OutletsView />
    </Suspense>
  );
}
