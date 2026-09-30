'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { ArrowRight, Coins, QrCode } from 'lucide-react';
import type { BillRecord } from '@lotmorewins/types';
import { BillDrawer, BillsTable } from '@/components/admin/bills';
import { Badge, Tag } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { DetailList, Panel, PanelHeader } from '@/components/ui/panel';
import { TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { adminApi, useAdminQuery } from '@/lib/admin-client';
import { PARTNER_ROLE_LABEL, PARTNER_STATUS, QR_TYPE_LABEL } from '@/lib/admin-labels';
import { formatDate, formatDateTime, formatINR, formatNumber, formatRelative } from '@/lib/format';

function Figure({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white p-5">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-[-0.01em] ${accent ? 'text-maroon-800' : 'text-stone-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-stone-500">{sub}</p>}
    </div>
  );
}

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: p, error, reload } = useAdminQuery(() => adminApi.getAdminPartner(id).then((r) => r.data), [id]);
  const [selected, setSelected] = useState<BillRecord | null>(null);

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
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-lg lg:col-span-2" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  const status = PARTNER_STATUS[p.status];
  const affiliationId = p.employeeId ?? p.admissionNumber;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partners', href: '/partners' }, { label: p.name }]}
        title={p.name}
        meta={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Tag gold={p.isAchariyaAssociated}>{PARTNER_ROLE_LABEL[p.role]}</Tag>
          </>
        }
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

      <div className="grid gap-6 animate-rise-in lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Wallet + activity */}
          <Panel className="grid gap-px overflow-hidden bg-stone-150 sm:grid-cols-3">
            <Figure
              label="Points balance"
              value={formatNumber(p.wallet.balancePoints)}
              sub={`Worth ${formatINR(p.wallet.rupeeValue)}`}
              accent
            />
            <Figure
              label="Own purchases"
              value={formatINR(p.directTotals.billAmount)}
              sub={`${formatNumber(p.directTotals.billCount)} bills · ${formatINR(p.directTotals.discountAmount)} saved`}
            />
            <Figure
              label="Referral sales"
              value={formatINR(p.referredTotals.billAmount)}
              sub={`${formatNumber(p.referredTotals.billCount)} bills brought in`}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Recent transactions" description="Bills this partner paid for, and bills from customers they referred." />
            <BillsTable
              bills={p.recentBills}
              onSelect={setSelected}
              emptyTitle="No transactions yet"
              emptyDescription="Bills appear once this partner or someone they referred shops at an outlet."
            />
          </Panel>

          <Panel>
            <PanelHeader
              title="Points ledger"
              description={`Purchase ${formatNumber(p.wallet.totals.purchasePoints)} pts · Referral ${formatNumber(p.wallet.totals.referralPoints)} pts`}
            />
            {p.wallet.entries.length === 0 ? (
              <EmptyState icon={Coins} title="No points yet" description="Points are credited automatically when bills are created." />
            ) : (
              <TableScroll>
                <Table className="min-w-[560px]">
                  <THead>
                    <tr>
                      <TH>Date</TH>
                      <TH>Source</TH>
                      <TH>Bill</TH>
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
                        <TD className="h-12 font-medium text-emerald-700" align="right">
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
            <PanelHeader title="Profile" />
            <div className="px-5 py-2">
              <DetailList
                items={[
                  { label: 'Mobile', value: <span className="tabular">{p.mobile}</span> },
                  { label: 'Email', value: p.email },
                  { label: 'Affiliation', value: PARTNER_ROLE_LABEL[p.role] },
                  ...(affiliationId
                    ? [{ label: p.employeeId ? 'Employee ID' : 'Admission no.', value: <span className="font-mono">{affiliationId}</span> }]
                    : []),
                  ...(p.achariyaRecord
                    ? [
                        {
                          label: p.employeeId ? 'Achariya record' : 'Student',
                          value: (
                            <>
                              {p.achariyaRecord.name}
                              {p.achariyaRecord.detail && <span className="block text-xs font-normal text-stone-500">{p.achariyaRecord.detail}</span>}
                            </>
                          ),
                        },
                      ]
                    : []),
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

      <BillDrawer bill={selected} onClose={() => setSelected(null)} />
    </>
  );
}
