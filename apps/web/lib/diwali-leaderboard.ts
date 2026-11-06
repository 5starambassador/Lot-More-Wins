import type { Prisma } from '@prisma/client';
import type { DiwaliLeaderboard, DiwaliRegistrationLeaderboard } from '@lotmorewins/types';
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

/**
 * Partners ranked by how many active partners registered naming them as "Referred by", up to the
 * last date; on equal counts, whoever reached that count first ranks higher.
 *
 * Registration only links an exact partner ID or mobile, but people mostly type the referral code
 * the app shows them (LMW-REF-…), often with different spacing, or a label before the code. So an
 * unlinked answer is matched here on letters and digits alone. Names are never matched: they
 * aren't unique. The database does the matching so that only the result crosses the network.
 */
export async function getDiwaliRegistrationLeaderboard(page: number, limit: number): Promise<DiwaliRegistrationLeaderboard> {
  const lastMoment = createdAtRange({ to: LAST_DATE })!.lt as Date;
  // One row per referrer, plus one with a null referrer counting the answers that match nobody.
  const credits = await prisma.$queryRaw<{ partnerId: string | null; count: number; lastAt: Date }[]>`
    WITH answers AS (
      SELECT id, referred_by_type::text AS type, created_at, referred_by_partner_id AS linked,
             lower(regexp_replace(coalesce(referred_by_text, ''), '[^a-zA-Z0-9]', '', 'g')) AS entered
      FROM partners
      WHERE status = 'ACTIVE' AND created_at < ${lastMoment}
        AND (referred_by_partner_id IS NOT NULL OR (referred_by_type IN ('PARTNER', 'OTHER') AND referred_by_text IS NOT NULL))
    ), codes AS (
      SELECT DISTINCT ON (code) code, partner_id FROM (
        SELECT lower(regexp_replace(code, '[^a-zA-Z0-9]', '', 'g')) AS code, partner_id FROM qr_codes
        UNION ALL
        SELECT lower(regexp_replace(partner_code, '[^a-zA-Z0-9]', '', 'g')), id FROM partners
        UNION ALL
        SELECT regexp_replace(lower(regexp_replace(partner_code, '[^a-zA-Z0-9]', '', 'g')), '^lmwp', ''), id FROM partners
      ) every_code
    ), mobiles AS (
      SELECT DISTINCT ON (right(mobile, 10)) right(mobile, 10) AS mobile, id FROM partners
    ), resolved AS (
      SELECT a.id, a.type, a.created_at, coalesce(a.linked, m.id, whole.partner_id, labelled.partner_id) AS referrer
      FROM answers a
      LEFT JOIN mobiles m ON m.mobile = right(a.entered, 10) AND a.entered ~ '^(0|91)?[0-9]{10}$'
      LEFT JOIN codes whole ON whole.code = a.entered AND a.entered !~ '^(0|91)?[0-9]{10}$'
      LEFT JOIN codes labelled ON labelled.code = substring(a.entered from '.*(lmwp.*)$') AND a.entered !~ '^(0|91)?[0-9]{10}$'
    )
    SELECT CASE WHEN referrer <> id THEN referrer END AS "partnerId",
           (count(*) FILTER (WHERE referrer <> id OR type = 'PARTNER'))::int AS "count",
           max(created_at) AS "lastAt"
    FROM resolved
    GROUP BY 1`;

  const unmatchedAnswers = credits.find((c) => c.partnerId === null)?.count ?? 0;
  const ranked = credits
    .flatMap((c) => (c.partnerId ? [{ partnerId: c.partnerId, count: c.count, lastAt: c.lastAt }] : []))
    .sort((a, b) => b.count - a.count || a.lastAt.getTime() - b.lastAt.getTime() || a.partnerId.localeCompare(b.partnerId));

  const start = (page - 1) * limit;
  const onPage = ranked.slice(start, start + limit);
  const details = await prisma.partner.findMany({
    where: { id: { in: onPage.map((r) => r.partnerId) } },
    select: { id: true, name: true, partnerCode: true, mobile: true, email: true },
  });
  const partnerById = new Map(details.map((p) => [p.id, p]));

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
        partnersReferred: r.count,
        lastReferredAt: r.lastAt.toISOString(),
      };
    }),
    meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    summary: { partners: total, partnersReferred: ranked.reduce((sum, r) => sum + r.count, 0), unmatchedAnswers },
    lastDate: LAST_DATE,
  };
}
