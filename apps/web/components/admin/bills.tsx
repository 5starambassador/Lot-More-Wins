'use client';

import Link from 'next/link';
import type { BillRecord } from '@lotmorewins/types';
import { ArrowUpRight, Mail, MessageCircle, Receipt, Trash2 } from 'lucide-react';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { DetailList } from '@/components/ui/panel';
import { SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { BILL_TYPE_LABEL, NOTIFICATION_STATUS } from '@/lib/admin-labels';
import { formatDateTime, formatINR, formatNumber, formatRelative } from '@/lib/format';

/** Who paid, and through whom — the one line that explains a bill. */
export function BillParty({ bill }: { bill: BillRecord }) {
  if (bill.transactionType === 'DIRECT_PARTNER') {
    return (
      <div className="min-w-0">
        <p className="truncate font-medium text-stone-900">{bill.partner?.name ?? 'Partner'}</p>
        <p className="truncate text-xs text-stone-500">{bill.partner?.partnerCode ?? '—'}</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-stone-900">{bill.customer?.name ?? 'Customer'}</p>
      <p className="truncate text-xs text-stone-500">via {bill.referrerPartner?.name ?? 'partner'}</p>
    </div>
  );
}

export function BillsTable({
  bills,
  loading,
  onSelect,
  hideOutlet,
  emptyTitle = 'No transactions yet',
  emptyDescription = 'Bills appear here as soon as an outlet completes a sale.',
}: {
  bills: BillRecord[] | null;
  loading?: boolean;
  onSelect: (bill: BillRecord) => void;
  hideOutlet?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const cols = hideOutlet ? 6 : 7;
  if (!loading && bills && bills.length === 0) {
    return <EmptyState icon={Receipt} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <TableScroll>
      <Table className="min-w-[760px]">
        <THead>
          <tr>
            <TH>Bill</TH>
            <TH>Customer / partner</TH>
            {!hideOutlet && <TH>Outlet</TH>}
            <TH>Type</TH>
            <TH align="right">Bill amount</TH>
            <TH align="right">Discount</TH>
            <TH>Message</TH>
          </tr>
        </THead>
        <TBody>
          {loading || !bills ? (
            <SkeletonRows cols={cols} rows={6} />
          ) : (
            bills.map((bill) => {
              const n = NOTIFICATION_STATUS[bill.notification.status];
              return (
                <TR
                  key={bill.id}
                  interactive
                  onClick={() => onSelect(bill)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(bill))}
                  tabIndex={0}
                  aria-label={`Open bill ${bill.billNumber}`}
                >
                  <TD>
                    <p className="font-mono text-[12px] font-medium text-stone-800">{bill.billNumber}</p>
                    <p className="text-xs text-stone-500" title={formatDateTime(bill.createdAt)}>
                      {formatRelative(bill.createdAt)}
                    </p>
                  </TD>
                  <TD className="max-w-[220px]">
                    <BillParty bill={bill} />
                  </TD>
                  {!hideOutlet && <TD className="max-w-[180px] truncate">{bill.outlet.name}</TD>}
                  <TD>
                    <div className="flex flex-wrap items-center gap-1">
                      <Tag gold={bill.transactionType === 'REFERRAL'}>{BILL_TYPE_LABEL[bill.transactionType]}</Tag>
                      {bill.isFirstTime && <Tag>First bill</Tag>}
                      {bill.referralRewardPercentage > 0 && <Tag gold>Referral reward</Tag>}
                    </div>
                  </TD>
                  <TD align="right" className="font-medium text-stone-900">
                    {formatINR(bill.billAmount)}
                  </TD>
                  <TD align="right">
                    <span className="text-stone-700">{formatINR(bill.discountAmount)}</span>
                    <span className="block text-[11px] text-stone-400">{formatNumber(bill.discountPercentage)}%</span>
                  </TD>
                  <TD>
                    <Badge tone={n.tone}>{n.label}</Badge>
                  </TD>
                </TR>
              );
            })
          )}
        </TBody>
      </Table>
    </TableScroll>
  );
}

const RECIPIENT_LABEL = {
  PARTNER: 'Partner (direct purchase)',
  CUSTOMER_PARTNER: 'Customer — registered partner',
  CUSTOMER_PENDING: 'Customer — held until they register',
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-5">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">{title}</h3>
      {children}
    </section>
  );
}

/** `onDelete`: shows a "Delete transaction" button (pass it only to admins allowed to delete). */
export function BillDrawer({ bill, onClose, onDelete }: { bill: BillRecord | null; onClose: () => void; onDelete?: (bill: BillRecord) => void }) {
  if (!bill) return null;
  const n = NOTIFICATION_STATUS[bill.notification.status];
  const ChannelIcon = bill.notification.channel === 'whatsapp' ? MessageCircle : Mail;
  const person = bill.partner ?? bill.referrerPartner;

  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="font-mono">{bill.billNumber}</span>}
      subtitle={`${formatDateTime(bill.createdAt)} · ${bill.outlet.name}`}
      footer={
        onDelete && (
          <div className="flex justify-end">
            <Button variant="danger-outline" onClick={() => onDelete(bill)}>
              <Trash2 className="h-4 w-4" /> Delete transaction
            </Button>
          </div>
        )
      }
    >
      {/* Amount summary */}
      <div className="border-b border-stone-150 bg-stone-25 px-6 py-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag gold={bill.transactionType === 'REFERRAL'}>{BILL_TYPE_LABEL[bill.transactionType]}</Tag>
          {bill.isFirstTime && <Tag>First bill</Tag>}
          {bill.birthdayBonusPercentage > 0 && <Tag gold>Birthday bonus +{formatNumber(bill.birthdayBonusPercentage)}%</Tag>}
          {bill.referralRewardPercentage > 0 && <Tag gold>Referral reward {formatNumber(bill.referralRewardPercentage)}%</Tag>}
        </div>
        <p className="mt-4 text-xs text-stone-500">Amount paid</p>
        <p className="tabular text-3xl font-semibold tracking-[-0.01em] text-stone-900">{formatINR(bill.finalAmount)}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-150 pt-4 text-[13px]">
          <div>
            <p className="text-xs text-stone-500">Bill amount</p>
            <p className="tabular font-medium text-stone-900">{formatINR(bill.billAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Discount ({formatNumber(bill.discountPercentage)}%)</p>
            <p className="tabular font-medium text-maroon-700">− {formatINR(bill.discountAmount)}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-stone-150">
        <Section title="People">
          <DetailList
            items={[
              ...(bill.transactionType === 'REFERRAL'
                ? [
                    { label: 'Customer', value: bill.customer ? `${bill.customer.name} · ${bill.customer.mobile}` : '—' },
                    { label: 'Referred by', value: bill.referrerPartner?.name ?? '—' },
                  ]
                : [{ label: 'Partner', value: bill.partner ? `${bill.partner.name} · ${bill.partner.mobile}` : '—' }]),
              {
                label: 'Partner code',
                // Sample bills (dashboard test data) have no partner page to open.
                value: person?.id.startsWith('sample-') ? (
                  person.partnerCode
                ) : person ? (
                  <Link href={`/partners/${person.id}`} className="inline-flex items-center gap-1 text-maroon-700 hover:underline">
                    {person.partnerCode}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  '—'
                ),
              },
            ]}
          />
        </Section>

        <Section title="Points">
          <DetailList
            items={[
              {
                label: 'Points calculated on',
                value: `${formatINR(bill.pointsBaseAmount)} (${bill.pointsBasis === 'BILL_AMOUNT' ? 'bill amount' : 'payable amount'})`,
              },
              { label: 'Purchase points', value: `${formatNumber(bill.purchasePoints)} pts · ${formatNumber(bill.purchasePointsPercentage)}%` },
              { label: 'Credited to', value: RECIPIENT_LABEL[bill.purchasePointsRecipient] },
              ...(bill.transactionType === 'REFERRAL'
                ? [{ label: 'Referral points', value: `${formatNumber(bill.referralPoints)} pts · ${formatNumber(bill.referralPointsPercentage)}%` }]
                : []),
              { label: 'Ratio at billing', value: `${formatNumber(bill.pointsRatio.points)} pts = ₹${formatNumber(bill.pointsRatio.rupees)}` },
            ]}
          />
        </Section>

        <Section title="Bill message">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[13px] text-stone-700">
              {bill.notification.channel && <ChannelIcon className="h-4 w-4 shrink-0 text-stone-400" />}
              <span className="truncate">{bill.notification.recipient ?? 'No recipient'}</span>
            </div>
            <Badge tone={n.tone}>{n.label}</Badge>
          </div>
          {bill.notification.error && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{bill.notification.error}</p>
          )}
          <p className="mt-2 text-xs text-stone-500">
            {bill.notification.attempts} attempt{bill.notification.attempts === 1 ? '' : 's'}
            {bill.notification.sentAt && ` · sent ${formatDateTime(bill.notification.sentAt)}`}
          </p>
        </Section>

        <Section title="Audit">
          <DetailList
            items={[
              { label: 'Settings version', value: bill.settingsVersion ? formatDateTime(bill.settingsVersion) : 'Before snapshots' },
              { label: 'QR scanned', value: bill.qrType === 'REFERRAL' ? 'Referral QR' : 'Discount QR' },
            ]}
          />
        </Section>
      </div>
    </Drawer>
  );
}
