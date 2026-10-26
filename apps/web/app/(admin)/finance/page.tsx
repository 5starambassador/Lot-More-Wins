'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Download, FileSpreadsheet, Search, Upload, Wallet, XCircle } from 'lucide-react';
import type { PayoutSheetAction, PayoutStatus, PayoutUploadResult } from '@lotmorewins/types';
import { DateRangeFilter, FilterBar, NO_DATES, dateQuery, readDateRange } from '@/components/admin/filter-bar';
import { PAYOUT_SOURCE, PAYOUT_STATUS, PARTNER_CATEGORY } from '@/components/admin/revised-labels';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Pagination, SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { adminApi, downloadFile, errorMessage, fileToBase64, isUnauthenticated, useAdminQuery, useDebounced } from '@/lib/admin-client';
import { formatDate, formatDateTime, formatINR, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;
const STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as const satisfies readonly PayoutStatus[];

const ACTION: Record<PayoutSheetAction, { label: string; tone: 'success' | 'danger' | 'neutral' | 'warning' }> = {
  PAID: { label: 'Mark Paid', tone: 'success' },
  FAILED: { label: 'Mark Failed', tone: 'warning' },
  UNCHANGED: { label: 'No change', tone: 'neutral' },
  ERROR: { label: 'Error', tone: 'danger' },
};

/**
 * Finance: cash reward wallets and payouts. The team exports the Pending payouts, pays them by UPI
 * outside the system, fills in upi_txn_ref / paid_on / status, and uploads the sheet. The server
 * validates every row first (preview), then applies the whole file in one transaction.
 */
function FinanceView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<PayoutStatus | undefined>(
    STATUSES.includes(params.get('status') as PayoutStatus) ? (params.get('status') as PayoutStatus) : undefined
  );
  const [dates, setDates] = useState(() => readDateRange(params));
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (dates.from) next.set('from', dates.from);
    if (dates.to) next.set('to', dates.to);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [q, status, dates, pathname, router]);

  const filters = { search: q || undefined, status, ...dateQuery(dates) };
  const report = useAdminQuery(
    () => adminApi.getFinanceReport({ ...filters, page, limit: PAGE_SIZE }).then((r) => r.data),
    [q, status, dates.from, dates.to, page]
  );
  const uploads = useAdminQuery(() => adminApi.listPayoutUploads().then((r) => r.data), []);
  const filtered = Boolean(q || status || dates.from || dates.to);
  const t = report.data?.totals;

  const [exporting, setExporting] = useState(false);
  const exportSheet = async () => {
    setExporting(true);
    try {
      // The payout sheet for the current filter; with no status chosen, Finance usually wants Pending.
      await downloadFile('/admin/finance/payouts', { ...filters }, 'xlsx');
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else toast('error', 'Could not export', errorMessage(err, 'The payout sheet could not be created.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Finance"
        description="Partner cash reward wallets and payouts. Export the payout sheet, pay by UPI, then upload the filled-in sheet to mark payouts Paid."
        actions={
          <Button variant="secondary" onClick={exportSheet} loading={exporting}>
            {!exporting && <Download className="h-4 w-4" />} Export Excel
          </Button>
        }
      />

      <Panel className="mb-6 grid grid-cols-2 gap-px overflow-hidden bg-stone-150 animate-rise-in md:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: 'Wallet balances',
            value: t ? formatINR(t.balance) : '—',
            strong: true,
          },
          {
            label: 'In Pending payouts',
            value: t ? `${formatINR(t.pending)} · ${formatNumber(t.pendingCount)}` : '—',
          },
          { label: 'Available', value: t ? formatINR(t.available) : '—' },
          {
            label: 'Partners with balance',
            value: t ? formatNumber(t.partnersWithBalance) : '—',
          },
          {
            label: dates.from || dates.to ? 'Earned in dates' : 'Earned (all time)',
            value: t ? formatINR(t.earned) : '—',
          },
          {
            label: dates.from || dates.to ? 'Paid in dates' : 'Paid (all time)',
            value: t ? formatINR(t.paid) : '—',
          },
        ].map((m) => (
          <div key={m.label} className="bg-white px-5 py-4">
            <p className="text-xs text-stone-500">{m.label}</p>
            <p className={cn('tabular mt-1 truncate text-lg font-semibold', m.strong ? 'text-maroon-800' : 'text-stone-900')}>{m.value}</p>
          </div>
        ))}
      </Panel>

      <FilterBar
        onClear={
          filtered &&
          (() => {
            setSearch('');
            setStatus(undefined);
            setDates(NO_DATES);
            setPage(1);
          })
        }
      >
        <div className="w-full sm:w-64">
          <Input
            aria-label="Search partners"
            placeholder="Partner name, code, mobile or UPI ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            icon={Search}
          />
        </div>
        <DateRangeFilter
          value={dates}
          onChange={(v) => {
            setDates(v);
            setPage(1);
          }}
        />
        <Select
          aria-label="Payout status"
          value={status ?? ''}
          onChange={(e) => {
            setStatus((e.target.value || undefined) as PayoutStatus | undefined);
            setPage(1);
          }}
          className="w-40"
        >
          <option value="">All payouts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYOUT_STATUS[s].label}
            </option>
          ))}
        </Select>
      </FilterBar>

      {report.error && (
        <Alert
          tone="danger"
          className="mb-4"
          action={
            <Button size="sm" variant="secondary" onClick={report.reload}>
              Retry
            </Button>
          }
        >
          {report.error}
        </Alert>
      )}

      <UploadPanel
        onApplied={() => {
          report.reload();
          uploads.reload();
        }}
      />

      <Panel className="mb-6">
        <PanelHeader title="Payouts" description="Requested in the selected dates (all time without dates), newest first." />
        {report.data && report.data.payouts.length === 0 ? (
          <EmptyState icon={Wallet} title="No payouts" description="Weekly payouts and partner requests appear here as Pending." />
        ) : (
          <TableScroll>
            <Table className="min-w-[1080px]">
              <THead>
                <tr>
                  <TH>Payout ID</TH>
                  <TH>Partner</TH>
                  <TH>UPI ID</TH>
                  <TH align="right">Amount</TH>
                  <TH>Requested</TH>
                  <TH>Paid on</TH>
                  <TH>Status</TH>
                  <TH>UPI txn ref</TH>
                </tr>
              </THead>
              <TBody>
                {!report.data ? (
                  <SkeletonRows cols={8} rows={6} />
                ) : (
                  report.data.payouts.map((x) => (
                    <TR key={x.id}>
                      <TD className="font-mono text-[12px] text-stone-800">{x.payoutNumber}</TD>
                      <TD>
                        <Link href={`/partners/${x.partner.id}`} className="font-medium text-stone-900 hover:text-maroon-700">
                          {x.partner.name}
                        </Link>
                        <p className="font-mono text-[11px] text-stone-500">
                          {x.partner.partnerCode} · {x.partner.mobile}
                        </p>
                      </TD>
                      <TD className="font-mono text-[12px] text-stone-600">{x.upiId}</TD>
                      <TD align="right" className="font-medium text-stone-900">
                        {formatINR(x.amount)}
                        {x.paidAmount !== null && x.paidAmount !== x.amount && (
                          <span className="block text-[11px] text-stone-500">Paid {formatINR(x.paidAmount)}</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-stone-500">
                        {formatDateTime(x.requestedAt)}
                        <span className="block text-[11px] text-stone-400">{PAYOUT_SOURCE[x.source]}</span>
                      </TD>
                      <TD className="whitespace-nowrap text-stone-600">{x.paidOn ? formatDate(x.paidOn) : '—'}</TD>
                      <TD>
                        <Badge tone={PAYOUT_STATUS[x.status].tone}>{PAYOUT_STATUS[x.status].label}</Badge>
                        {x.failureNote && <p className="mt-1 max-w-[180px] truncate text-[11px] text-stone-500">{x.failureNote}</p>}
                      </TD>
                      <TD className="font-mono text-[11px] text-stone-600">{x.upiTxnRef ?? '—'}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroll>
        )}
        {report.data && (
          <Pagination
            page={report.data.meta.page}
            totalPages={report.data.meta.totalPages}
            total={report.data.meta.total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            noun="payouts"
          />
        )}
      </Panel>

      <Panel className="mb-6">
        <PanelHeader title="Partner wallets" description="Current balances; earned and paid follow the date filter." />
        {report.data && report.data.balances.length === 0 ? (
          <EmptyState icon={Wallet} title="No wallets yet" description="Partners appear here once a cash-reward outlet credits them." />
        ) : (
          <TableScroll>
            <Table className="min-w-[960px]">
              <THead>
                <tr>
                  <TH>Partner</TH>
                  <TH>UPI ID</TH>
                  <TH align="right">Earned</TH>
                  <TH align="right">Paid</TH>
                  <TH align="right">Balance</TH>
                  <TH align="right">Pending</TH>
                  <TH align="right">Available</TH>
                </tr>
              </THead>
              <TBody>
                {!report.data ? (
                  <SkeletonRows cols={7} rows={5} />
                ) : (
                  report.data.balances.map((b) => (
                    <TR key={b.partner.id}>
                      <TD>
                        <Link href={`/partners/${b.partner.id}`} className="font-medium text-stone-900 hover:text-maroon-700">
                          {b.partner.name}
                        </Link>
                        <p className="font-mono text-[11px] text-stone-500">
                          {b.partner.partnerCode} · {PARTNER_CATEGORY[b.partner.category]}
                        </p>
                      </TD>
                      <TD className="font-mono text-[12px] text-stone-600">{b.partner.upiId ?? <Tag>No UPI ID</Tag>}</TD>
                      <TD align="right" className="text-stone-700">
                        {formatINR(b.earned)}
                      </TD>
                      <TD align="right" className="text-stone-700">
                        {formatINR(b.paid)}
                      </TD>
                      <TD align="right" className="font-medium text-stone-900">
                        {formatINR(b.balance)}
                      </TD>
                      <TD align="right" className="text-stone-700">
                        {formatINR(b.pending)}
                      </TD>
                      <TD align="right" className="font-medium text-maroon-800">
                        {formatINR(b.available)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Upload history"
          description="Every payout sheet that was applied: who uploaded which file and what it changed."
        />
        {uploads.error ? (
          <div className="p-5">
            <Alert tone="danger">{uploads.error}</Alert>
          </div>
        ) : uploads.data && uploads.data.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No sheets uploaded yet" description="Applied payout sheets are listed here." />
        ) : (
          <TableScroll>
            <Table className="min-w-[860px]">
              <THead>
                <tr>
                  <TH>Uploaded</TH>
                  <TH>File</TH>
                  <TH>By</TH>
                  <TH align="right">Rows</TH>
                  <TH align="right">Paid</TH>
                  <TH align="right">Failed</TH>
                  <TH align="right">Unchanged</TH>
                  <TH align="right">Amount paid</TH>
                </tr>
              </THead>
              <TBody>
                {!uploads.data ? (
                  <SkeletonRows cols={8} rows={3} />
                ) : (
                  uploads.data.map((u) => (
                    <TR key={u.id}>
                      <TD className="whitespace-nowrap text-stone-500">{formatDateTime(u.createdAt)}</TD>
                      <TD className="max-w-[220px] truncate text-stone-800">{u.fileName}</TD>
                      <TD className="max-w-[200px] truncate text-stone-600">{u.uploadedByEmail}</TD>
                      <TD align="right">{formatNumber(u.rowCount)}</TD>
                      <TD align="right">{formatNumber(u.paidCount)}</TD>
                      <TD align="right">{formatNumber(u.failedCount)}</TD>
                      <TD align="right">{formatNumber(u.unchangedCount)}</TD>
                      <TD align="right" className="font-medium text-stone-900">
                        {formatINR(u.paidAmount)}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroll>
        )}
      </Panel>
    </>
  );
}

/** Choose a sheet → preview (server validation, nothing changed) → apply (one transaction). */
function UploadPanel({ onApplied }: { onApplied: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<PayoutUploadResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (input.current) input.current.value = '';
  };

  const send = async (chosen: { name: string; base64: string }, apply: boolean) => {
    setBusy(apply ? 'apply' : 'preview');
    setError(null);
    try {
      const res = await adminApi.uploadPayoutSheet({
        fileName: chosen.name,
        base64: chosen.base64,
        apply,
      });
      if (apply) {
        const r = res.data;
        toast(
          'success',
          'Payout sheet applied',
          `${r.paidCount} paid (${formatINR(r.paidAmount)}), ${r.failedCount} failed, ${r.unchangedCount} unchanged.`
        );
        reset();
        onApplied();
      } else {
        setPreview(res.data);
      }
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else setError(errorMessage(err, 'The sheet could not be checked.'));
    } finally {
      setBusy(null);
    }
  };

  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    setPreview(null);
    const chosen = { name: picked.name, base64: await fileToBase64(picked) };
    setFile(chosen);
    await send(chosen, false);
  };

  const hasErrors = (preview?.errorCount ?? 0) > 0;
  const changes = preview ? preview.paidCount + preview.failedCount : 0;

  return (
    <Panel className="mb-6">
      <PanelHeader
        title="Upload payout sheet"
        description="The exported sheet with upi_txn_ref, paid_on (YYYY-MM-DD) and status (PAID, FAILED or PENDING) filled in. Every row is checked first; one bad row rejects the whole file. Uploading the same sheet again changes nothing."
        actions={
          <>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => choose(e.target.files?.[0])}
            />
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={busy === 'preview'}>
              {busy !== 'preview' && <Upload className="h-3.5 w-3.5" />} Choose file
            </Button>
          </>
        }
      />
      {(error || preview) && (
        <PanelBody className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {preview && (
            <>
              {hasErrors ? (
                <Alert
                  tone="danger"
                  title={`${preview.errorCount} row${preview.errorCount === 1 ? '' : 's'} with errors: nothing was applied`}
                >
                  Fix the rows below in the sheet and upload it again.
                </Alert>
              ) : (
                <Alert tone={changes > 0 ? 'success' : 'info'} title={`${file?.name ?? preview.fileName} is valid`}>
                  {changes > 0
                    ? `Applying will mark ${preview.paidCount} payout${preview.paidCount === 1 ? '' : 's'} Paid (${formatINR(preview.paidAmount)}) and ${preview.failedCount} Failed. ${preview.unchangedCount} row${preview.unchangedCount === 1 ? '' : 's'} change nothing.`
                    : 'Every row is still Pending or was already applied, so applying changes nothing.'}
                </Alert>
              )}
              <TableScroll>
                <Table className="min-w-[760px]">
                  <THead>
                    <tr>
                      <TH>Row</TH>
                      <TH>Payout ID</TH>
                      <TH>Partner</TH>
                      <TH align="right">Amount</TH>
                      <TH>Result</TH>
                      <TH>Details</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {preview.rows.map((row) => (
                      <TR key={row.row} className={row.action === 'ERROR' ? 'bg-red-50/40' : undefined}>
                        <TD className="tabular text-stone-500">{row.row}</TD>
                        <TD className="font-mono text-[12px] text-stone-800">{row.payoutNumber ?? '—'}</TD>
                        <TD className="text-stone-700">{row.partnerName ?? '—'}</TD>
                        <TD align="right" className="text-stone-900">
                          {row.amount !== null ? formatINR(row.amount) : '—'}
                        </TD>
                        <TD>
                          <Badge tone={ACTION[row.action].tone}>{ACTION[row.action].label}</Badge>
                        </TD>
                        <TD className="text-xs">
                          {row.errors.length > 0 ? (
                            <ul className="space-y-0.5 text-red-700">
                              {row.errors.map((e) => (
                                <li key={e} className="flex items-start gap-1">
                                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-stone-500">{row.note ?? ''}</span>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={reset} disabled={busy !== null}>
                  Cancel
                </Button>
                {!hasErrors && changes > 0 && file && (
                  <Button onClick={() => send(file, true)} loading={busy === 'apply'}>
                    {busy !== 'apply' && <CheckCircle2 className="h-4 w-4" />} Apply {changes} change{changes === 1 ? '' : 's'}
                  </Button>
                )}
              </div>
            </>
          )}
        </PanelBody>
      )}
    </Panel>
  );
}

export default function FinancePage() {
  return (
    <Suspense>
      <FinanceView />
    </Suspense>
  );
}
