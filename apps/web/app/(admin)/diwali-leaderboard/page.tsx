'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, UserPlus } from 'lucide-react';
import { Badge, Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { PageHeader, Segmented } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Pagination, SkeletonRows, TBody, TD, TH, THead, TR, Table, TableScroll } from '@/components/ui/table';
import { adminApi, useAdminQuery } from '@/lib/admin-client';
import { formatDate, formatINR, formatNumber, initials } from '@/lib/format';

const PAGE_SIZE = 25;

type Board = 'BILL_VALUE' | 'PARTNERS_REFERRED';

export default function DiwaliLeaderboardPage() {
  const [board, setBoard] = useState<Board>('BILL_VALUE');
  const filter = (
    <Segmented<Board>
      label="Rank partners by"
      value={board}
      onChange={setBoard}
      options={[
        { value: 'BILL_VALUE', label: 'Total bill value' },
        { value: 'PARTNERS_REFERRED', label: 'Partners referred' },
      ]}
      className="mb-4 max-w-full overflow-x-auto"
    />
  );
  return board === 'BILL_VALUE' ? <BillValueBoard filter={filter} /> : <PartnersReferredBoard filter={filter} />;
}

function PartnerCell({ name, partnerCode }: { name: string; partnerCode: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-[11px] font-semibold text-maroon-700">
        {initials(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-stone-900">{name}</p>
        <p className="font-mono text-[11px] text-stone-500">{partnerCode}</p>
      </div>
    </div>
  );
}

function ContactCell({ mobile, email }: { mobile: string; email: string }) {
  return (
    <>
      <p className="tabular text-stone-800">{mobile}</p>
      <p className="max-w-[260px] truncate text-xs text-stone-500">{email}</p>
    </>
  );
}

function BillValueBoard({ filter }: { filter: ReactNode }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery(() => adminApi.getAdminDiwaliLeaderboard(page, PAGE_SIZE).then((r) => r.data), [page]);
  const rows = data?.rows ?? null;
  const open = (partnerId: string) => router.push(`/partners/${partnerId}`);

  return (
    <>
      <PageHeader
        title="Diwali launch leaderboard"
        description={
          data
            ? `Partners ranked by the total value of bills closed with their referral QR, up to ${formatDate(data.lastDate)}. A partner needs ${formatNumber(data.minimumReferrals)} successful referrals to qualify. Select a partner for their full referral history.`
            : 'Partners ranked by the total value of bills closed with their referral QR.'
        }
        meta={
          data && (
            <>
              <Tag className="tabular">{formatNumber(data.summary.partners)} partners</Tag>
              <Tag gold className="tabular">{formatNumber(data.summary.qualified)} qualified</Tag>
              <Tag className="tabular">{formatINR(data.summary.totalBillValue)} from {formatNumber(data.summary.referralBills)} bills</Tag>
            </>
          )
        }
      />
      {filter}

      {error && (
        <Alert tone="danger" className="mb-4" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Panel className="animate-rise-in">
        {rows && rows.length === 0 && !loading ? (
          <EmptyState icon={Trophy} title="No referrals yet" description="Partners appear here once a guest completes a bill with their referral QR." />
        ) : (
          <TableScroll>
            <Table className="min-w-[960px]">
              <THead>
                <tr>
                  <TH align="right">Rank</TH>
                  <TH>Partner</TH>
                  <TH>Contact</TH>
                  <TH align="right">Successful referrals</TH>
                  <TH align="right">Total referral bill value</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody className={loading && rows ? 'opacity-60 transition-opacity' : undefined}>
                {!rows ? (
                  <SkeletonRows cols={6} rows={8} />
                ) : (
                  rows.map((r) => (
                    <TR key={r.partnerId} interactive tabIndex={0} onClick={() => open(r.partnerId)} onKeyDown={(e) => e.key === 'Enter' && open(r.partnerId)}>
                      <TD align="right" className="tabular font-semibold text-stone-900">
                        {formatNumber(r.rank)}
                      </TD>
                      <TD>
                        <PartnerCell name={r.name} partnerCode={r.partnerCode} />
                      </TD>
                      <TD>
                        <ContactCell mobile={r.mobile} email={r.email} />
                      </TD>
                      <TD align="right">
                        <span className="text-stone-900">{formatNumber(r.successfulReferrals)}</span>
                        <span className="block text-[11px] text-stone-400">{formatNumber(r.uniqueGuests)} unique guests</span>
                      </TD>
                      <TD align="right" className="font-semibold text-maroon-800">
                        {formatINR(r.totalBillValue)}
                      </TD>
                      <TD>
                        {r.qualified ? (
                          <Badge tone="success">Qualified</Badge>
                        ) : (
                          <span className="whitespace-nowrap text-xs text-stone-500">{formatNumber(data!.minimumReferrals - r.successfulReferrals)} more to qualify</span>
                        )}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroll>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={PAGE_SIZE} onPage={setPage} noun="partners" />}
      </Panel>
    </>
  );
}

function PartnersReferredBoard({ filter }: { filter: ReactNode }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminQuery(() => adminApi.getAdminDiwaliRegistrationLeaderboard(page, PAGE_SIZE).then((r) => r.data), [page]);
  const rows = data?.rows ?? null;
  const open = (partnerId: string) => router.push(`/partners/${partnerId}`);

  return (
    <>
      <PageHeader
        title="Diwali launch leaderboard"
        description={
          data
            ? `Partners ranked by how many partners registered with their code as "Referred by", up to ${formatDate(data.lastDate)}. On equal counts, whoever got there first ranks higher.`
            : 'Partners ranked by how many partners registered with their code as "Referred by".'
        }
        meta={
          data && (
            <>
              <Tag className="tabular">{formatNumber(data.summary.partners)} partners</Tag>
              <Tag gold className="tabular">{formatNumber(data.summary.partnersReferred)} registrations referred</Tag>
              {data.summary.unmatchedAnswers > 0 && <Tag className="tabular">{formatNumber(data.summary.unmatchedAnswers)} answers match no partner</Tag>}
            </>
          )
        }
      />
      {filter}

      {error && (
        <Alert tone="danger" className="mb-4" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Panel className="animate-rise-in">
        {rows && rows.length === 0 && !loading ? (
          <EmptyState icon={UserPlus} title="No referred registrations yet" description="Partners appear here once someone registers with their code as Referred by." />
        ) : (
          <TableScroll>
            <Table className="min-w-[860px]">
              <THead>
                <tr>
                  <TH align="right">Rank</TH>
                  <TH>Partner</TH>
                  <TH>Contact</TH>
                  <TH align="right">Partners referred</TH>
                  <TH>Latest referred registration</TH>
                </tr>
              </THead>
              <TBody className={loading && rows ? 'opacity-60 transition-opacity' : undefined}>
                {!rows ? (
                  <SkeletonRows cols={5} rows={8} />
                ) : (
                  rows.map((r) => (
                    <TR key={r.partnerId} interactive tabIndex={0} onClick={() => open(r.partnerId)} onKeyDown={(e) => e.key === 'Enter' && open(r.partnerId)}>
                      <TD align="right" className="tabular font-semibold text-stone-900">
                        {formatNumber(r.rank)}
                      </TD>
                      <TD>
                        <PartnerCell name={r.name} partnerCode={r.partnerCode} />
                      </TD>
                      <TD>
                        <ContactCell mobile={r.mobile} email={r.email} />
                      </TD>
                      <TD align="right" className="font-semibold text-maroon-800">
                        {formatNumber(r.partnersReferred)}
                      </TD>
                      <TD className="whitespace-nowrap text-stone-600">{formatDate(r.lastReferredAt)}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </TableScroll>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} pageSize={PAGE_SIZE} onPage={setPage} noun="partners" />}
      </Panel>
    </>
  );
}
