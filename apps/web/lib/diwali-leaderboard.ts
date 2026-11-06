import type { Prisma } from '@prisma/client';
import type { DiwaliLeaderboard } from '@lotmorewins/types';
import prisma from './prisma';
import { createdAtRange } from './admin-insights';
import { countUniqueGuests, guestIdentitySelect } from './partner-transactions';

/** The contest terms published on the /diwali-launch landing page. */
const LAST_DATE = '2026-11-30';
const MINIMUM_REFERRALS = 10;

/**
 * Partners with at least one referral bill by the last date, ranked by the total value of those
 * bills; on equal value, by the number of bills. There are few enough partners with referrals to
 * rank them in memory, which also gives the summary and each row's rank whatever the page.
 */
export async function getDiwaliLeaderboard(page: number, limit: number): Promise<DiwaliLeaderboard> {
  const where = {
    referrerPartnerId: { not: null },
    transactionType: 'REFERRAL',
    createdAt: createdAtRange({ to: LAST_DATE }),
  } satisfies Prisma.BillWhereInput;

  const groups = await prisma.bill.groupBy({ by: ['referrerPartnerId'], where, _count: { _all: true }, _sum: { billAmount: true } });
  const ranked = groups
    .map((g) => ({ partnerId: g.referrerPartnerId!, bills: g._count._all, value: g._sum.billAmount?.toNumber() ?? 0 }))
    .sort((a, b) => b.value - a.value || b.bills - a.bills || a.partnerId.localeCompare(b.partnerId));

  const start = (page - 1) * limit;
  const onPage = ranked.slice(start, start + limit);
  const ids = onPage.map((r) => r.partnerId);
  const [partners, guestBills] = await Promise.all([
    prisma.partner.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, partnerCode: true, mobile: true, email: true } }),
    prisma.bill.findMany({
      where: { ...where, referrerPartnerId: { in: ids } },
      distinct: ['referrerPartnerId', 'customerId'],
      select: { referrerPartnerId: true, customer: { select: guestIdentitySelect } },
    }),
  ]);
  const partnerById = new Map(partners.map((p) => [p.id, p]));

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    rows: onPage.map((r, index) => {
      const partner = partnerById.get(r.partnerId)!;
      return {
        rank: start + index + 1,
        partnerId: r.partnerId,
        name: partner.name,
        partnerCode: partner.partnerCode,
        mobile: partner.mobile,
        email: partner.email,
        successfulReferrals: r.bills,
        uniqueGuests: countUniqueGuests(guestBills.flatMap((b) => (b.referrerPartnerId === r.partnerId && b.customer ? [b.customer] : []))),
        totalBillValue: r.value,
        qualified: r.bills >= MINIMUM_REFERRALS,
      };
    }),
    meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    summary: {
      partners: total,
      qualified: ranked.filter((r) => r.bills >= MINIMUM_REFERRALS).length,
      referralBills: ranked.reduce((sum, r) => sum + r.bills, 0),
      totalBillValue: ranked.reduce((sum, r) => sum + r.value, 0),
    },
    minimumReferrals: MINIMUM_REFERRALS,
    lastDate: LAST_DATE,
  };
}
