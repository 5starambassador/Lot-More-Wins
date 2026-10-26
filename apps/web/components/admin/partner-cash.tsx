'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import type { AdminPartnerDetail, CashWallet, PartnerCategory, PartnerStatus } from '@lotmorewins/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { DetailList, Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { adminApi, errorMessage, isUnauthenticated } from '@/lib/admin-client';
import { PARTNER_STATUS } from '@/lib/admin-labels';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import { PARTNER_CATEGORY, PAYOUT_SOURCE, PAYOUT_STATUS } from './revised-labels';

const STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED'] as const satisfies readonly PartnerStatus[];
const CATEGORIES = ['NON_ACHARIYA', 'ACHARIYA'] as const satisfies readonly PartnerCategory[];

/**
 * Super Admin controls for one partner: status (activate / deactivate) and the Achariya /
 * Non-Achariya classification that decides their first-time discount and referral points.
 */
export function PartnerAccessPanel({ partner, onSaved }: { partner: AdminPartnerDetail; onSaved: (updated: AdminPartnerDetail) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<PartnerStatus>(partner.status);
  const [category, setCategory] = useState<PartnerCategory>(partner.category);
  const [saving, setSaving] = useState(false);
  const dirty = status !== partner.status || category !== partner.category;

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.updateAdminPartner(partner.id, {
        ...(status !== partner.status && { status }),
        ...(category !== partner.category && { category }),
      });
      onSaved(res.data);
      toast('success', 'Partner updated');
    } catch (err) {
      if (isUnauthenticated(err)) router.replace('/login');
      else toast('error', 'Could not update the partner', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Status & classification"
        description="Only active partners can be billed. Achariya partners get the Achariya first-time discount and referral points."
      />
      <PanelBody className="space-y-4">
        <Field label="Status" htmlFor="partner-status">
          <Select id="partner-status" value={status} onChange={(e) => setStatus(e.target.value as PartnerStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PARTNER_STATUS[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Classification" htmlFor="partner-category">
          <Select id="partner-category" value={category} onChange={(e) => setCategory(e.target.value as PartnerCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PARTNER_CATEGORY[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={save} loading={saving} disabled={!dirty} className="w-full">
          Save
        </Button>
      </PanelBody>
    </Panel>
  );
}

/** Cash reward wallet summary (sidebar column). */
export function CashWalletSummary({ cash }: { cash: CashWallet }) {
  return (
    <Panel>
      <PanelHeader title="Cash reward wallet" />
      <div className="px-5 py-2">
        <DetailList
          items={[
            {
              label: 'Balance',
              value: <span className="tabular">{formatINR(cash.balance)}</span>,
            },
            {
              label: 'In Pending payouts',
              value: <span className="tabular">{formatINR(cash.pendingPayout)}</span>,
            },
            {
              label: 'Available',
              value: <span className="tabular">{formatINR(cash.available)}</span>,
            },
            {
              label: 'Earned (purchase / referral)',
              value: `${formatINR(cash.totals.purchase)} / ${formatINR(cash.totals.referral)}`,
            },
            {
              label: 'Paid out',
              value: <span className="tabular">{formatINR(cash.totals.paidOut)}</span>,
            },
            {
              label: 'UPI ID',
              value: cash.upiId ? <span className="font-mono text-[12px]">{cash.upiId}</span> : 'Not added yet',
            },
          ]}
        />
      </div>
    </Panel>
  );
}

/** The partner's payouts, newest first. */
export function PayoutHistoryPanel({ cash }: { cash: CashWallet }) {
  return (
    <Panel>
      <PanelHeader
        title="Payouts"
        description="Cash reward payouts to the partner's UPI ID. Finance marks them Paid by uploading the payout sheet."
      />
      {cash.payouts.length === 0 ? (
        <EmptyState icon={Wallet} title="No payouts yet" description="Weekly payouts and the partner's payout requests appear here." />
      ) : (
        <TableScroll>
          <Table className="min-w-[760px]">
            <THead>
              <tr>
                <TH>Payout ID</TH>
                <TH>Requested</TH>
                <TH align="right">Amount</TH>
                <TH>UPI ID</TH>
                <TH>Status</TH>
                <TH>Paid on · Ref</TH>
              </tr>
            </THead>
            <TBody>
              {cash.payouts.map((x) => (
                <TR key={x.id}>
                  <TD className="h-12 font-mono text-[12px] text-stone-800">{x.payoutNumber}</TD>
                  <TD className="h-12 whitespace-nowrap text-stone-500">
                    {formatDateTime(x.requestedAt)}
                    <span className="block text-[11px] text-stone-400">{PAYOUT_SOURCE[x.source]}</span>
                  </TD>
                  <TD className="h-12 font-medium text-stone-900" align="right">
                    {formatINR(x.amount)}
                    {x.paidAmount !== null && x.paidAmount !== x.amount && (
                      <span className="block text-[11px] text-stone-500">Paid {formatINR(x.paidAmount)}</span>
                    )}
                  </TD>
                  <TD className="h-12 font-mono text-[12px] text-stone-600">{x.upiId}</TD>
                  <TD className="h-12">
                    <Badge tone={PAYOUT_STATUS[x.status].tone}>{PAYOUT_STATUS[x.status].label}</Badge>
                  </TD>
                  <TD className="h-12 whitespace-nowrap text-stone-600">
                    {x.paidOn ? formatDate(x.paidOn) : '—'}
                    {x.upiTxnRef && <span className="block font-mono text-[11px] text-stone-400">{x.upiTxnRef}</span>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      )}
    </Panel>
  );
}
