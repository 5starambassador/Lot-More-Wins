'use client';

import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Pagination, SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { adminApi, useAdminQuery } from '@/lib/admin-client';
import { formatDateTime, formatINR, formatNumber } from '@/lib/format';

const PAGE_SIZE = 25;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="tabular mt-2 text-2xl font-semibold tracking-[-0.01em] text-maroon-800">{value}</p>
    </div>
  );
}

/** The partner's referral history, as in the Partner App, with guest contacts in full. Not affected by the page's filters. */
export function PartnerReferralHistory({ partnerId }: { partnerId: string }) {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery(
    () => adminApi.getAdminPartnerReferralHistory(partnerId, page, PAGE_SIZE).then((r) => r.data),
    [partnerId, page]
  );
  const bills = data?.bills ?? null;
  const summary = data?.summary;

  return (
    <Panel>
      <PanelHeader
        title="Referral history"
        description="All time. Every bill completed at an outlet with this partner’s referral QR. A person is counted once by mobile and email."
        actions={data && <Tag className="tabular">{formatNumber(data.meta.total)} bills</Tag>}
      />
      <div className="grid gap-px border-b border-stone-150 bg-stone-150 sm:grid-cols-3">
        <Metric label="Referral bills completed" value={summary ? formatNumber(summary.completedBills) : '—'} />
        <Metric label="Total bill value" value={summary ? formatINR(summary.totalBillValue) : '—'} />
        <Metric label="Unique persons referred" value={summary ? formatNumber(summary.uniqueGuests) : '—'} />
      </div>
      {error ? (
        <div className="p-5">
          <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
            {error}
          </Alert>
        </div>
      ) : bills && bills.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No referral bills yet" description="Bills appear here when a guest shops with this partner’s referral QR." />
      ) : (
        <TableScroll className={loading && bills ? 'opacity-60 transition-opacity' : undefined}>
          <Table className="min-w-[1040px]">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Bill</TH>
                <TH>Guest</TH>
                <TH>Outlet</TH>
                <TH align="right">Bill amount</TH>
                <TH align="right">Discount</TH>
                <TH align="right">Service + GST</TH>
                <TH align="right">Guest paid</TH>
                <TH align="right">Partner reward</TH>
              </tr>
            </THead>
            <TBody>
              {!bills ? (
                <SkeletonRows cols={9} rows={5} />
              ) : (
                bills.map(({ id, bill, rewards, guestMobile, guestEmail }) => {
                  const reward = rewards.reduce((sum, r) => sum + r.points, 0);
                  return (
                    <TR key={id}>
                      <TD className="whitespace-nowrap text-stone-500">{formatDateTime(bill.createdAt)}</TD>
                      <TD>
                        <p className="font-mono text-[12px] text-stone-700">{bill.billNumber}</p>
                        {bill.isFirstTime && <p className="text-[11px] text-gold-700">First purchase at this outlet</p>}
                      </TD>
                      <TD className="max-w-[220px]">
                        <p className="truncate font-medium text-stone-900">{bill.buyerName ?? 'Guest'}</p>
                        <p className="tabular text-xs text-stone-600">{guestMobile ?? '—'}</p>
                        {guestEmail && <p className="truncate text-xs text-stone-500">{guestEmail}</p>}
                      </TD>
                      <TD className="max-w-[160px] truncate">{bill.outletName}</TD>
                      <TD align="right" className="font-medium text-stone-900">{formatINR(bill.billAmount)}</TD>
                      <TD align="right">
                        {formatINR(bill.discountAmount)}
                        <span className="block text-[11px] text-stone-400">{formatNumber(bill.discountPercentage)}%</span>
                      </TD>
                      <TD align="right">{formatINR(bill.serviceChargeAmount + bill.gstAmount)}</TD>
                      <TD align="right" className="font-medium text-stone-900">{formatINR(bill.finalAmount)}</TD>
                      <TD align="right" className={reward > 0 ? 'font-medium text-emerald-700' : 'text-stone-300'}>
                        {reward > 0 ? `+${formatNumber(reward)} pts` : '—'}
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableScroll>
      )}
      {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={PAGE_SIZE} onPage={setPage} noun="bills" />}
    </Panel>
  );
}
