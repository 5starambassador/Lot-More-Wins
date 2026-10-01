import { Prisma } from '@prisma/client';
import type {
  AdminDashboard,
  AdminSearchResult,
  AdminDateRangeQuery,
  AdminOutlet,
  AdminOutletRedemption,
  AdminPartnerActivityKind,
  AdminPartnerActivityRow,
  AdminPartnerActivitySummary,
  AdminPartnerDetail,
  AdminPartnerListItem,
  AdminPartnerSort,
  AdminTransactionRange,
  AdminTrendPoint,
  BillNotificationStatus,
  BillRecord,
  BillTotals,
  BillTransactionType,
  DailySalesPoint,
  OutletStatus,
  PartnerStatus,
} from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';
import { billInclude, serializeBill, startOfTodayIst } from './billing';
import { getPartnerWallet, unexpiredPoints } from './points';
import { getProgramSettings } from './settings';
import { toDateOnly } from './partners';
import { referralProgress } from './referral-rewards';
import { adminOutletInclude, serializeAdminOutlet } from './outlets';
import { CSV_MAX_ROWS, csvDateTime, toCsv, type CsvColumn } from './admin-csv';

/**
 * Read-only aggregates for the Super Admin panel. Nothing here writes; every figure is
 * derived from the same tables the billing and points flows already maintain.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The instant an IST calendar day (YYYY-MM-DD) starts. */
function istDayStart(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

/** createdAt filter for an inclusive from–to range of IST days; undefined when neither end is set. */
function createdAtRange(range: AdminDateRangeQuery): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: istDayStart(range.from) } : {}),
    ...(range.to ? { lt: new Date(istDayStart(range.to).getTime() + DAY_MS) } : {}),
  };
}

type Paging = { page: number; limit: number };
/** CSV exports take the whole filtered result, up to the export cap. */
const pageOf = (query: Paging, all: boolean) => (all ? { skip: 0, take: CSV_MAX_ROWS } : { skip: (query.page - 1) * query.limit, take: query.limit });
const n = (d: Prisma.Decimal | null | undefined) => d?.toNumber() ?? 0;

const totalsSelect = {
  _count: { _all: true },
  _sum: { billAmount: true, discountAmount: true, finalAmount: true, purchasePoints: true, referralPoints: true },
} as const;

async function billTotals(where: Prisma.BillWhereInput): Promise<BillTotals> {
  const agg = await prisma.bill.aggregate({ where, ...totalsSelect });
  return {
    billCount: agg._count._all,
    billAmount: n(agg._sum.billAmount),
    discountAmount: n(agg._sum.discountAmount),
    finalAmount: n(agg._sum.finalAmount),
    purchasePoints: n(agg._sum.purchasePoints),
    referralPoints: n(agg._sum.referralPoints),
  };
}

/** IST calendar date (YYYY-MM-DD) of an instant. */
function istDate(d: Date): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function dailySales(days: number): Promise<DailySalesPoint[]> {
  const since = new Date(startOfTodayIst().getTime() - (days - 1) * DAY_MS);
  const rows = await prisma.$queryRaw<{ day: string; bill_count: bigint; bill_amount: Prisma.Decimal | null }[]>`
    SELECT to_char((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
           COUNT(*) AS bill_count,
           SUM(bill_amount) AS bill_amount
    FROM bills
    WHERE created_at >= ${since}
    GROUP BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = istDate(new Date(since.getTime() + i * DAY_MS));
    const row = byDay.get(date);
    return { date, billCount: row ? Number(row.bill_count) : 0, billAmount: n(row?.bill_amount) };
  });
}

function countBy<K extends string>(keys: readonly K[], rows: { key: K; count: number }[]): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const r of rows) out[r.key] = r.count;
  return out;
}

const PARTNER_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED'] as const satisfies readonly PartnerStatus[];

// ============================================================================
// Partners
// ============================================================================

const partnerListSelect = {
  id: true,
  partnerCode: true,
  name: true,
  mobile: true,
  email: true,
  city: true,
  status: true,
  createdAt: true,
  _count: { select: { directBills: true, referredBills: true } },
} satisfies Prisma.PartnerSelect;

type PartnerListRow = Prisma.PartnerGetPayload<{ select: typeof partnerListSelect }>;

/** Available points per partner: unexpired and not yet redeemed. */
async function pointBalances(partnerIds: string[]): Promise<Map<string, number>> {
  if (partnerIds.length === 0) return new Map();
  const sums = await prisma.pointsEntry.groupBy({
    by: ['partnerId'],
    where: { partnerId: { in: partnerIds }, ...unexpiredPoints() },
    _sum: { points: true, redeemedPoints: true },
  });
  return new Map(
    sums.map((s) => [
      s.partnerId as string,
      (s._sum.points ?? new Prisma.Decimal(0)).minus(s._sum.redeemedPoints ?? 0).toNumber(),
    ])
  );
}

async function shareCounts(partnerIds: string[]): Promise<Map<string, number>> {
  if (partnerIds.length === 0) return new Map();
  const rows = await prisma.referralShare.groupBy({ by: ['partnerId'], where: { partnerId: { in: partnerIds } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.partnerId, r._count._all]));
}

function toListItem(p: PartnerListRow, balance: number, shares: number): AdminPartnerListItem {
  return {
    id: p.id,
    partnerCode: p.partnerCode,
    name: p.name,
    mobile: p.mobile,
    email: p.email,
    city: p.city,
    status: p.status,
    pointsBalance: balance,
    directBillCount: p._count.directBills,
    referredBillCount: p._count.referredBills,
    referralShareCount: shares,
    createdAt: p.createdAt.toISOString(),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listPartners(
  query: Paging &
    AdminDateRangeQuery & {
      search?: string;
      status?: PartnerStatus;
      referrals?: 'with' | 'without';
      sort: AdminPartnerSort;
    },
  all = false
) {
  const search = query.search?.trim();
  const joined = createdAtRange(query);
  const where: Prisma.PartnerWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(joined ? { createdAt: joined } : {}),
    ...(query.referrals === 'with' ? { referredBills: { some: {} } } : {}),
    ...(query.referrals === 'without' ? { referredBills: { none: {} } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search } },
            { partnerCode: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            // The partner's id, pasted in full.
            ...(UUID_PATTERN.test(search) ? [{ id: search.toLowerCase() }] : []),
          ],
        }
      : {}),
  };
  const orderBy: Prisma.PartnerOrderByWithRelationInput =
    query.sort === 'name' ? { name: 'asc' } : { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' };

  const [total, rows] = await Promise.all([
    prisma.partner.count({ where }),
    prisma.partner.findMany({
      where,
      select: partnerListSelect,
      orderBy,
      ...pageOf(query, all),
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const [balances, shares] = await Promise.all([pointBalances(ids), shareCounts(ids)]);
  return { total, partners: rows.map((r) => toListItem(r, balances.get(r.id) ?? 0, shares.get(r.id) ?? 0)) };
}

const PARTNER_CSV: CsvColumn<AdminPartnerListItem>[] = [
  { header: 'Partner code', value: (p) => p.partnerCode },
  { header: 'Name', value: (p) => p.name },
  { header: 'Mobile', value: (p) => p.mobile },
  { header: 'Email', value: (p) => p.email },
  { header: 'City', value: (p) => p.city },
  { header: 'Status', value: (p) => p.status },
  { header: 'Joined (IST)', value: (p) => csvDateTime(p.createdAt) },
  { header: 'Points balance', value: (p) => p.pointsBalance },
  { header: 'Own bills', value: (p) => p.directBillCount },
  { header: 'Successful referrals', value: (p) => p.referredBillCount },
  { header: 'Referral QR shares', value: (p) => p.referralShareCount },
];

export async function partnersCsv(query: Parameters<typeof listPartners>[0]): Promise<string> {
  return toCsv(PARTNER_CSV, (await listPartners(query, true)).partners);
}

export async function getPartnerDetail(id: string): Promise<AdminPartnerDetail> {
  const partner = await prisma.partner.findUnique({
    where: { id },
    select: {
      ...partnerListSelect,
      state: true,
      pincode: true,
      dateOfBirth: true,
      photoUrl: true,
      updatedAt: true,
      qrCodes: { select: { id: true, code: true, type: true, status: true, createdAt: true }, orderBy: { type: 'asc' } },
    },
  });
  if (!partner) throw new HttpError(404, 'Partner not found', 'PARTNER_NOT_FOUND');

  const [wallet, directTotals, referredTotals, settings, shares, rewardsUsed, customers, recentBills] = await Promise.all([
    getPartnerWallet(id, 20),
    billTotals({ partnerId: id }),
    billTotals({ referrerPartnerId: id }),
    getProgramSettings(),
    prisma.referralShare.count({ where: { partnerId: id } }),
    prisma.bill.count({ where: { partnerId: id, referralRewardReferrals: { gt: 0 } } }),
    prisma.bill.groupBy({ by: ['customerId'], where: { referrerPartnerId: id, transactionType: 'REFERRAL' } }),
    prisma.bill.findMany({
      where: { OR: [{ partnerId: id }, { referrerPartnerId: id }] },
      include: billInclude,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const progress = await referralProgress(prisma, id, settings.referralRewardGoal);

  return {
    ...toListItem(partner, wallet.balancePoints, shares),
    state: partner.state,
    pincode: partner.pincode,
    dateOfBirth: toDateOnly(partner.dateOfBirth),
    photoUrl: partner.photoUrl,
    qrCodes: partner.qrCodes.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() })),
    wallet,
    directTotals,
    referredTotals,
    recentBills: recentBills.map(serializeBill),
    referralTracking: {
      total: progress.total,
      uniqueCustomers: customers.length,
      progress: Math.min(progress.successful, settings.referralRewardGoal),
      goal: settings.referralRewardGoal,
      rewardAvailable: progress.rewardAvailable,
      rewardDiscount: settings.referralRewardDiscount,
      rewardsUsed,
      shares,
    },
    updatedAt: partner.updatedAt.toISOString(),
  };
}

// ============================================================================
// Transactions
// ============================================================================

function rangeStart(range: AdminTransactionRange): Date | null {
  if (range === 'all') return null;
  const today = startOfTodayIst();
  if (range === 'today') return today;
  return new Date(today.getTime() - (range === '7d' ? 6 : 29) * DAY_MS);
}

export async function listTransactions(
  query: Paging &
    AdminDateRangeQuery & {
      search?: string;
      outletId?: string;
      partnerId?: string;
      type?: BillTransactionType;
      notification?: BillNotificationStatus;
      range: AdminTransactionRange;
    },
  all = false
) {
  const search = query.search?.trim();
  const since = rangeStart(query.range);
  const personMatch = (s: string): Prisma.PartnerWhereInput => ({
    OR: [
      { name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { mobile: { contains: s } },
      { partnerCode: { contains: s, mode: 'insensitive' } },
    ],
  });
  const and: Prisma.BillWhereInput[] = [];
  if (since) and.push({ createdAt: { gte: since } });
  const dates = createdAtRange(query);
  if (dates) and.push({ createdAt: dates });
  if (query.outletId) and.push({ outletId: query.outletId });
  if (query.partnerId) and.push({ OR: [{ partnerId: query.partnerId }, { referrerPartnerId: query.partnerId }] });
  if (query.type) and.push({ transactionType: query.type });
  if (query.notification) and.push({ notificationStatus: query.notification });
  if (search) {
    and.push({
      OR: [
        { billNumber: { contains: search, mode: 'insensitive' } },
        { partner: personMatch(search) },
        { referrerPartner: personMatch(search) },
        {
          customer: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { mobile: { contains: search } },
            ],
          },
        },
      ],
    });
  }
  const where: Prisma.BillWhereInput = and.length ? { AND: and } : {};

  const [bills, summary] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: billInclude,
      orderBy: { createdAt: 'desc' },
      ...pageOf(query, all),
    }),
    billTotals(where),
  ]);
  return { total: summary.billCount, bills: bills.map(serializeBill), summary };
}

const BILL_CSV: CsvColumn<BillRecord>[] = [
  { header: 'Bill number', value: (b) => b.billNumber },
  { header: 'Date (IST)', value: (b) => csvDateTime(b.createdAt) },
  { header: 'Outlet', value: (b) => b.outlet.name },
  { header: 'Type', value: (b) => (b.transactionType === 'REFERRAL' ? 'Referral' : 'Direct partner') },
  { header: 'Partner', value: (b) => (b.partner ?? b.referrerPartner)?.name },
  { header: 'Partner code', value: (b) => (b.partner ?? b.referrerPartner)?.partnerCode },
  { header: 'Partner mobile', value: (b) => (b.partner ?? b.referrerPartner)?.mobile },
  { header: 'Customer', value: (b) => b.customer?.name },
  { header: 'Customer mobile', value: (b) => b.customer?.mobile },
  { header: 'First bill', value: (b) => (b.isFirstTime ? 'Yes' : 'No') },
  { header: 'Bill amount', value: (b) => b.billAmount },
  { header: 'Discount %', value: (b) => b.discountPercentage },
  { header: 'Birthday bonus %', value: (b) => b.birthdayBonusPercentage },
  { header: 'Referral reward %', value: (b) => b.referralRewardPercentage },
  { header: 'Discount amount', value: (b) => b.discountAmount },
  { header: 'Amount paid', value: (b) => b.finalAmount },
  { header: 'Purchase points', value: (b) => b.purchasePoints },
  { header: 'Referral points', value: (b) => b.referralPoints },
  { header: 'Message status', value: (b) => b.notification.status },
  { header: 'Message channel', value: (b) => b.notification.channel },
];

export async function transactionsCsv(query: Parameters<typeof listTransactions>[0]): Promise<string> {
  return toCsv(BILL_CSV, (await listTransactions(query, true)).bills);
}

// ============================================================================
// Single partner: activity log
// ============================================================================

const ACTIVITY_SOURCE_CAP = 2_000;

type ActivityQuery = Paging & AdminDateRangeQuery & { outletId?: string; kind?: AdminPartnerActivityKind };

/**
 * Everything one partner did, newest first: own purchases, successful referrals (bills closed
 * with their referral QR), wallet redemptions and taps of "Share QR". QR shares have no outlet,
 * so an outlet filter leaves them out. The summary ignores the kind filter so the figures
 * above the table stay put while the table is narrowed.
 */
export async function partnerActivity(id: string, query: ActivityQuery, all = false) {
  const partner = await prisma.partner.findUnique({ where: { id }, select: { id: true, name: true, partnerCode: true } });
  if (!partner) throw new HttpError(404, 'Partner not found', 'PARTNER_NOT_FOUND');

  const createdAt = createdAtRange(query);
  const scope = { ...(createdAt ? { createdAt } : {}), ...(query.outletId ? { outletId: query.outletId } : {}) };
  const purchaseWhere: Prisma.BillWhereInput = { partnerId: id, ...scope };
  const referralWhere: Prisma.BillWhereInput = { referrerPartnerId: id, transactionType: 'REFERRAL', ...scope };
  const redemptionWhere: Prisma.PointsRedemptionWhereInput = { partnerId: id, ...scope };
  const shareWhere: Prisma.ReferralShareWhereInput = { partnerId: id, ...(createdAt ? { createdAt } : {}) };

  const take = all ? CSV_MAX_ROWS : ACTIVITY_SOURCE_CAP;
  const wants = (kind: AdminPartnerActivityKind) => !query.kind || query.kind === kind;
  const billSelect = {
    id: true,
    billNumber: true,
    createdAt: true,
    isFirstTime: true,
    billAmount: true,
    discountPercentage: true,
    birthdayBonusPercentage: true,
    referralRewardPercentage: true,
    discountAmount: true,
    finalAmount: true,
    purchasePoints: true,
    referralPoints: true,
    outlet: { select: { name: true } },
    customer: { select: { name: true, mobile: true } },
  } satisfies Prisma.BillSelect;
  const newestFirst = { orderBy: { createdAt: 'desc' as const }, take };

  const [purchases, referrals, redemptions, shares] = await Promise.all([
    wants('PURCHASE') ? prisma.bill.findMany({ where: purchaseWhere, select: billSelect, ...newestFirst }) : [],
    wants('REFERRAL') ? prisma.bill.findMany({ where: referralWhere, select: billSelect, ...newestFirst }) : [],
    wants('REDEMPTION')
      ? prisma.pointsRedemption.findMany({ where: redemptionWhere, include: { outlet: { select: { name: true } } }, ...newestFirst })
      : [],
    wants('SHARE') && !query.outletId ? prisma.referralShare.findMany({ where: shareWhere, ...newestFirst }) : [],
  ]);
  const [purchaseTotals, referralTotals, referralCustomers, redemptionTotals, shareCount] = await Promise.all([
    billTotals(purchaseWhere),
    billTotals(referralWhere),
    prisma.bill.groupBy({ by: ['customerId'], where: referralWhere }),
    prisma.pointsRedemption.aggregate({ where: redemptionWhere, _count: { _all: true }, _sum: { points: true, rupeeValue: true } }),
    query.outletId ? 0 : prisma.referralShare.count({ where: shareWhere }),
  ]);

  const billRow = (kind: 'PURCHASE' | 'REFERRAL') => (b: (typeof purchases)[number]): AdminPartnerActivityRow => {
    const notes = [
      b.isFirstTime ? 'First bill' : null,
      n(b.birthdayBonusPercentage) > 0 ? `Birthday bonus +${n(b.birthdayBonusPercentage)}%` : null,
      n(b.referralRewardPercentage) > 0 ? `Referral reward ${n(b.referralRewardPercentage)}%` : null,
    ].filter(Boolean);
    return {
      id: b.id,
      kind,
      createdAt: b.createdAt.toISOString(),
      billNumber: b.billNumber,
      outletName: b.outlet.name,
      customerName: kind === 'REFERRAL' ? (b.customer?.name ?? null) : null,
      customerMobile: kind === 'REFERRAL' ? (b.customer?.mobile ?? null) : null,
      billAmount: n(b.billAmount),
      discountPercentage: n(b.discountPercentage),
      discountAmount: n(b.discountAmount),
      finalAmount: n(b.finalAmount),
      // What this partner earned: purchase points on their own bill, referral points on a referred one.
      points: kind === 'PURCHASE' ? n(b.purchasePoints) : n(b.referralPoints),
      rupeeValue: null,
      note: notes.length ? notes.join(' · ') : null,
    };
  };
  const blank = { billNumber: null, customerName: null, customerMobile: null, billAmount: null, discountPercentage: null, discountAmount: null, finalAmount: null };

  const rows: AdminPartnerActivityRow[] = [
    ...purchases.map(billRow('PURCHASE')),
    ...referrals.map(billRow('REFERRAL')),
    ...redemptions.map((r) => ({
      ...blank,
      id: r.id,
      kind: 'REDEMPTION' as const,
      createdAt: r.createdAt.toISOString(),
      outletName: r.outlet.name,
      points: -n(r.points),
      rupeeValue: n(r.rupeeValue),
      note: null,
    })),
    ...shares.map((sh) => ({
      ...blank,
      id: sh.id,
      kind: 'SHARE' as const,
      createdAt: sh.createdAt.toISOString(),
      outletName: null,
      points: 0,
      rupeeValue: null,
      note: 'Tapped Share QR on the referral QR page',
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const summary: AdminPartnerActivitySummary = {
    purchases: {
      count: purchaseTotals.billCount,
      billAmount: purchaseTotals.billAmount,
      discountAmount: purchaseTotals.discountAmount,
      points: purchaseTotals.purchasePoints,
    },
    referrals: {
      count: referralTotals.billCount,
      uniqueCustomers: referralCustomers.length,
      billAmount: referralTotals.billAmount,
      points: referralTotals.referralPoints,
    },
    redemptions: {
      count: redemptionTotals._count._all,
      points: n(redemptionTotals._sum.points),
      rupeeValue: n(redemptionTotals._sum.rupeeValue),
    },
    shares: shareCount,
  };

  const total = rows.length;
  return {
    partner,
    total,
    rows: all ? rows.slice(0, CSV_MAX_ROWS) : rows.slice((query.page - 1) * query.limit, query.page * query.limit),
    summary,
  };
}

const ACTIVITY_LABEL: Record<AdminPartnerActivityKind, string> = {
  PURCHASE: 'Own purchase',
  REFERRAL: 'Successful referral',
  REDEMPTION: 'Points redeemed',
  SHARE: 'Referral QR shared',
};

const ACTIVITY_CSV: CsvColumn<AdminPartnerActivityRow>[] = [
  { header: 'Date (IST)', value: (r) => csvDateTime(r.createdAt) },
  { header: 'Activity', value: (r) => ACTIVITY_LABEL[r.kind] },
  { header: 'Bill number', value: (r) => r.billNumber },
  { header: 'Outlet', value: (r) => r.outletName },
  { header: 'Referred customer', value: (r) => r.customerName },
  { header: 'Customer mobile', value: (r) => r.customerMobile },
  { header: 'Bill amount', value: (r) => r.billAmount },
  { header: 'Discount %', value: (r) => r.discountPercentage },
  { header: 'Discount amount', value: (r) => r.discountAmount },
  { header: 'Amount paid', value: (r) => r.finalAmount },
  { header: 'Points', value: (r) => r.points },
  { header: 'Redeemed value', value: (r) => r.rupeeValue },
  { header: 'Note', value: (r) => r.note },
];

export async function partnerActivityCsv(id: string, query: ActivityQuery) {
  const { partner, rows } = await partnerActivity(id, query, true);
  return { name: `partner-${partner.partnerCode}-activity`, csv: toCsv(ACTIVITY_CSV, rows) };
}

// ============================================================================
// Outlets
// ============================================================================

export async function listOutlets(query: AdminDateRangeQuery & { search?: string; status?: OutletStatus }): Promise<AdminOutlet[]> {
  const search = query.search?.trim();
  const createdAt = createdAtRange(query);
  const outlets = await prisma.outlet.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { mobile: { contains: search } },
              { address: { contains: search, mode: 'insensitive' } },
              { admins: { some: { email: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    include: adminOutletInclude,
    orderBy: { createdAt: 'desc' },
  });
  return outlets.map(serializeAdminOutlet);
}

const OUTLET_CSV: CsvColumn<AdminOutlet>[] = [
  { header: 'Outlet', value: (o) => o.name },
  { header: 'Status', value: (o) => o.status },
  { header: 'Contact email', value: (o) => o.email },
  { header: 'Mobile', value: (o) => o.mobile },
  { header: 'Address', value: (o) => o.address },
  { header: 'Map link', value: (o) => o.mapUrl },
  { header: 'Description', value: (o) => o.description },
  { header: 'Admin login', value: (o) => o.adminEmail },
  { header: 'Photos', value: (o) => o.images.length },
  { header: 'Bills', value: (o) => o.billCount },
  { header: 'Created (IST)', value: (o) => csvDateTime(o.createdAt) },
];

export async function outletsCsv(query: Parameters<typeof listOutlets>[0]): Promise<string> {
  return toCsv(OUTLET_CSV, await listOutlets(query));
}

/** Wallet redemptions made at one outlet, with totals for the date filter. */
export async function outletRedemptions(outletId: string, query: Paging & AdminDateRangeQuery, all = false) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { name: true } });
  if (!outlet) throw new HttpError(404, 'Outlet not found', 'NOT_FOUND');

  const createdAt = createdAtRange(query);
  const where: Prisma.PointsRedemptionWhereInput = { outletId, ...(createdAt ? { createdAt } : {}) };
  const [rows, totals] = await Promise.all([
    prisma.pointsRedemption.findMany({
      where,
      include: { partner: { select: { id: true, name: true, partnerCode: true, mobile: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageOf(query, all),
    }),
    prisma.pointsRedemption.aggregate({ where, _count: { _all: true }, _sum: { points: true, rupeeValue: true } }),
  ]);
  const redemptions: AdminOutletRedemption[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    partner: r.partner,
    points: n(r.points),
    rupeeValue: n(r.rupeeValue),
  }));
  return {
    outletName: outlet.name,
    total: totals._count._all,
    redemptions,
    summary: { count: totals._count._all, points: n(totals._sum.points), rupeeValue: n(totals._sum.rupeeValue) },
  };
}

const REDEMPTION_CSV: CsvColumn<AdminOutletRedemption>[] = [
  { header: 'Date (IST)', value: (r) => csvDateTime(r.createdAt) },
  { header: 'Partner', value: (r) => r.partner.name },
  { header: 'Partner code', value: (r) => r.partner.partnerCode },
  { header: 'Partner mobile', value: (r) => r.partner.mobile },
  { header: 'Points redeemed', value: (r) => r.points },
  { header: 'Value', value: (r) => r.rupeeValue },
];

export async function outletRedemptionsCsv(outletId: string, query: Paging & AdminDateRangeQuery) {
  const { outletName, redemptions } = await outletRedemptions(outletId, query, true);
  return { name: `outlet-${outletName}-redemptions`, csv: toCsv(REDEMPTION_CSV, redemptions) };
}


// ============================================================================
// Dashboard
// ============================================================================

type Num = Prisma.Decimal | bigint | number | null;
const num = (v: Num) => (v === null ? 0 : typeof v === 'object' ? v.toNumber() : Number(v));

/**
 * All bill aggregates the dashboard needs, in one scan with FILTER clauses. Each round trip
 * to a remote database costs hundreds of milliseconds, so this replaces six separate queries.
 */
async function billSummary(today: Date, last30: Date, prev30: Date) {
  const periods = {
    all: Prisma.sql`TRUE`,
    today: Prisma.sql`created_at >= ${today}`,
    last30: Prisma.sql`created_at >= ${last30}`,
    prev30: Prisma.sql`created_at >= ${prev30} AND created_at < ${last30}`,
  };
  const cols = Object.entries(periods).map(
    ([p, cond]) => Prisma.sql`
      COUNT(*) FILTER (WHERE ${cond}) AS ${Prisma.raw(`${p}_count`)},
      SUM(bill_amount) FILTER (WHERE ${cond}) AS ${Prisma.raw(`${p}_bill`)},
      SUM(discount_amount) FILTER (WHERE ${cond}) AS ${Prisma.raw(`${p}_discount`)},
      SUM(final_amount) FILTER (WHERE ${cond}) AS ${Prisma.raw(`${p}_final`)},
      SUM(purchase_points) FILTER (WHERE ${cond}) AS ${Prisma.raw(`${p}_purchase`)},
      SUM(referral_points) FILTER (WHERE ${cond}) AS ${Prisma.raw(`${p}_referral`)}`
  );
  const [row] = await prisma.$queryRaw<Record<string, Num>[]>`
    SELECT ${Prisma.join(cols)},
      COUNT(*) FILTER (WHERE transaction_type = 'DIRECT_PARTNER') AS type_direct,
      COUNT(*) FILTER (WHERE transaction_type = 'REFERRAL') AS type_referral,
      COUNT(*) FILTER (WHERE notification_status = 'PENDING') AS notif_pending,
      COUNT(*) FILTER (WHERE notification_status = 'SENT') AS notif_sent,
      COUNT(*) FILTER (WHERE notification_status = 'FAILED') AS notif_failed,
      COUNT(*) FILTER (WHERE notification_status = 'SKIPPED') AS notif_skipped
    FROM bills`;
  const r = row ?? {};
  const totals = (p: keyof typeof periods): BillTotals => ({
    billCount: num(r[`${p}_count`] ?? 0),
    billAmount: num(r[`${p}_bill`] ?? null),
    discountAmount: num(r[`${p}_discount`] ?? null),
    finalAmount: num(r[`${p}_final`] ?? null),
    purchasePoints: num(r[`${p}_purchase`] ?? null),
    referralPoints: num(r[`${p}_referral`] ?? null),
  });
  return {
    allTime: totals('all'),
    today: totals('today'),
    last30Days: totals('last30'),
    previous30Days: totals('prev30'),
    byType: { DIRECT_PARTNER: num(r.type_direct ?? 0), REFERRAL: num(r.type_referral ?? 0) } as Record<BillTransactionType, number>,
    notifications: {
      PENDING: num(r.notif_pending ?? 0),
      SENT: num(r.notif_sent ?? 0),
      FAILED: num(r.notif_failed ?? 0),
      SKIPPED: num(r.notif_skipped ?? 0),
    } as Record<BillNotificationStatus, number>,
  };
}

/** Longest dashboard period charted day by day; longer periods are charted by month. */
const DAILY_TREND_MAX_DAYS = 92;
const DEFAULT_DASHBOARD_DAYS = 30;

const emptyTrendPoint = (date: string): AdminTrendPoint => ({
  date,
  billCount: 0,
  billAmount: 0,
  discountAmount: 0,
  referralBills: 0,
  referralShares: 0,
  newPartners: 0,
  pointsCredited: 0,
  pointsRedeemed: 0,
});

/** Every bucket of the period, so days / months with no activity still appear on the charts. */
function trendBuckets(from: string, to: string, monthly: boolean): AdminTrendPoint[] {
  const out: AdminTrendPoint[] = [];
  if (monthly) {
    let [y, m] = from.split('-').map(Number);
    const [endY, endM] = to.split('-').map(Number);
    while (y < endY || (y === endY && m <= endM)) {
      out.push(emptyTrendPoint(`${y}-${String(m).padStart(2, '0')}`));
      m += 1;
      if (m > 12) [y, m] = [y + 1, 1];
    }
    return out;
  }
  for (let t = istDayStart(from).getTime(); t <= istDayStart(to).getTime(); t += DAY_MS) out.push(emptyTrendPoint(istDate(new Date(t))));
  return out;
}

/** One round trip for every per-bucket series of the dashboard. */
async function dashboardTrend(start: Date, end: Date, from: string, to: string, monthly: boolean): Promise<AdminTrendPoint[]> {
  const bucket = (column: string) =>
    Prisma.raw(`to_char((${column} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), '${monthly ? 'YYYY-MM' : 'YYYY-MM-DD'}')`);
  const rows = await prisma.$queryRaw<{ src: string; bucket: string; a: Num; b: Num; c: Num; d: Num }[]>`
    SELECT 'bills' AS src, ${bucket('created_at')} AS bucket, COUNT(*)::numeric AS a, SUM(bill_amount) AS b, SUM(discount_amount) AS c,
           SUM(purchase_points + referral_points) AS d
    FROM bills WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 2
    UNION ALL
    SELECT 'referrals', ${bucket('created_at')}, COUNT(*)::numeric, NULL, NULL, NULL
    FROM bills WHERE transaction_type = 'REFERRAL' AND created_at >= ${start} AND created_at < ${end} GROUP BY 2
    UNION ALL
    SELECT 'shares', ${bucket('created_at')}, COUNT(*)::numeric, NULL, NULL, NULL
    FROM referral_shares WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 2
    UNION ALL
    SELECT 'partners', ${bucket('created_at')}, COUNT(*)::numeric, NULL, NULL, NULL
    FROM partners WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 2
    UNION ALL
    SELECT 'redemptions', ${bucket('created_at')}, SUM(points), NULL, NULL, NULL
    FROM points_redemptions WHERE created_at >= ${start} AND created_at < ${end} GROUP BY 2`;

  const points = trendBuckets(from, to, monthly);
  const byDate = new Map(points.map((p) => [p.date, p]));
  for (const r of rows) {
    const p = byDate.get(r.bucket);
    if (!p) continue;
    if (r.src === 'bills') {
      p.billCount = num(r.a);
      p.billAmount = num(r.b);
      p.discountAmount = num(r.c);
      p.pointsCredited = num(r.d);
    } else if (r.src === 'referrals') p.referralBills = num(r.a);
    else if (r.src === 'shares') p.referralShares = num(r.a);
    else if (r.src === 'partners') p.newPartners = num(r.a);
    else if (r.src === 'redemptions') p.pointsRedeemed = num(r.a);
  }
  return points;
}

/**
 * Programme overview. `query.from` / `query.to` (IST days, inclusive) set the period that
 * the totals, trend, breakdowns and rankings cover; it defaults to the last 30 days. Network
 * size, wallet balances and system status are always current.
 */
export async function getDashboard(query: AdminDateRangeQuery = {}): Promise<AdminDashboard> {
  const today = startOfTodayIst();
  const last30 = new Date(today.getTime() - 29 * DAY_MS);
  const prev30 = new Date(last30.getTime() - 30 * DAY_MS);

  const to = query.to ?? istDate(new Date());
  const from = query.from ?? istDate(new Date(istDayStart(to).getTime() - (DEFAULT_DASHBOARD_DAYS - 1) * DAY_MS));
  const start = istDayStart(from);
  const end = new Date(istDayStart(to).getTime() + DAY_MS);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const previousStart = new Date(start.getTime() - days * DAY_MS);
  const monthly = days > DAILY_TREND_MAX_DAYS;
  const inPeriod = { createdAt: { gte: start, lt: end } };

  // Stages rather than one wide Promise.all: each parallel query can open its own pool
  // connection, and a burst of new TLS connections to a remote database can time out.
  const [partnerRows, outletsByStatus, settings, points, bills] = await Promise.all([
    prisma.$queryRaw<{ status: PartnerStatus; total: bigint; recent: bigint; in_period: bigint }[]>`
      SELECT status, COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at >= ${last30}) AS recent,
             COUNT(*) FILTER (WHERE created_at >= ${start} AND created_at < ${end}) AS in_period
      FROM partners GROUP BY status`,
    prisma.outlet.groupBy({ by: ['status'], _count: { _all: true } }),
    getProgramSettings(),
    prisma.$queryRaw<{ credited: Num; pending: Num }[]>`
      SELECT SUM(points - redeemed_points) FILTER (WHERE partner_id IS NOT NULL) AS credited,
             SUM(points) FILTER (WHERE partner_id IS NULL) AS pending
      FROM points_entries
      WHERE expires_at IS NULL OR expires_at > NOW()`,
    billSummary(today, last30, prev30),
  ]);
  const [period, previousPeriod, periodRows, trend, daily] = await Promise.all([
    billTotals(inPeriod),
    billTotals({ createdAt: { gte: previousStart, lt: start } }),
    prisma.$queryRaw<Record<string, Num>[]>`
      SELECT
        COUNT(*) FILTER (WHERE transaction_type = 'DIRECT_PARTNER') AS direct_count,
        SUM(bill_amount) FILTER (WHERE transaction_type = 'DIRECT_PARTNER') AS direct_amount,
        COUNT(*) FILTER (WHERE transaction_type = 'REFERRAL') AS referral_count,
        SUM(bill_amount) FILTER (WHERE transaction_type = 'REFERRAL') AS referral_amount,
        COUNT(DISTINCT customer_id) FILTER (WHERE transaction_type = 'REFERRAL') AS referral_customers,
        COUNT(*) FILTER (WHERE referral_reward_referrals > 0) AS rewards_used,
        COUNT(*) FILTER (WHERE (transaction_type = 'DIRECT_PARTNER' AND is_first_time)
                            OR referral_reward_percentage > 0 OR birthday_bonus_percentage > 0) AS offer_redemptions,
        COUNT(DISTINCT partner_id) FILTER (WHERE (transaction_type = 'DIRECT_PARTNER' AND is_first_time)
                            OR referral_reward_percentage > 0 OR birthday_bonus_percentage > 0) AS offer_partners,
        SUM(CASE WHEN points_ratio_points > 0 THEN referral_points * points_ratio_rupees / points_ratio_points ELSE 0 END) AS referral_points_value,
        SUM(bill_amount * referral_reward_percentage / 100) AS referral_reward_discount,
        COUNT(*) FILTER (WHERE notification_status = 'PENDING') AS notif_pending,
        COUNT(*) FILTER (WHERE notification_status = 'SENT') AS notif_sent,
        COUNT(*) FILTER (WHERE notification_status = 'FAILED') AS notif_failed,
        COUNT(*) FILTER (WHERE notification_status = 'SKIPPED') AS notif_skipped
      FROM bills WHERE created_at >= ${start} AND created_at < ${end}`,
    dashboardTrend(start, end, from, to, monthly),
    dailySales(30),
  ]);
  const [topOutlets, topReferrers, redeemed, shares, recentBills, recentPartners] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; status: 'ACTIVE' | 'INACTIVE'; bill_count: bigint; bill_amount: Num }[]>`
      SELECT o.id, o.name, o.status, COUNT(b.id) AS bill_count, SUM(b.bill_amount) AS bill_amount
      FROM bills b JOIN outlets o ON o.id = b.outlet_id
      WHERE b.created_at >= ${start} AND b.created_at < ${end}
      GROUP BY o.id, o.name, o.status
      ORDER BY SUM(b.bill_amount) DESC
      LIMIT 5`,
    prisma.$queryRaw<{ id: string; name: string; partner_code: string; referral_count: bigint; bill_amount: Num; referral_points: Num }[]>`
      SELECT p.id, p.name, p.partner_code, COUNT(b.id) AS referral_count, SUM(b.bill_amount) AS bill_amount,
             SUM(b.referral_points) AS referral_points
      FROM bills b JOIN partners p ON p.id = b.referrer_partner_id
      WHERE b.transaction_type = 'REFERRAL' AND b.created_at >= ${start} AND b.created_at < ${end}
      GROUP BY p.id, p.name, p.partner_code
      ORDER BY COUNT(b.id) DESC, SUM(b.bill_amount) DESC
      LIMIT 5`,
    prisma.pointsRedemption.aggregate({ where: inPeriod, _count: { _all: true }, _sum: { points: true, rupeeValue: true } }),
    prisma.referralShare.count({ where: inPeriod }),
    prisma.bill.findMany({ where: inPeriod, include: billInclude, orderBy: { createdAt: 'desc' }, take: 6 }),
    listPartners({ page: 1, limit: 5, sort: 'newest' }),
  ]);

  const activeOutlets = outletsByStatus.find((o) => o.status === 'ACTIVE')?._count._all ?? 0;
  const inactiveOutlets = outletsByStatus.find((o) => o.status === 'INACTIVE')?._count._all ?? 0;
  const tally = <K extends string>(keys: readonly K[], key: (r: (typeof partnerRows)[number]) => K) => {
    const out = countBy(keys, []);
    for (const r of partnerRows) out[key(r)] += Number(r.total);
    return out;
  };
  const pr = periodRows[0] ?? {};
  const totalPartners = partnerRows.reduce((sum, r) => sum + Number(r.total), 0);

  return {
    generatedAt: new Date().toISOString(),
    range: { from, to, days, granularity: monthly ? 'month' : 'day' },
    programMetrics: {
      appRegistrations: partnerRows.reduce((sum, r) => sum + Number(r.in_period), 0),
      offerRedemptions: num(pr.offer_redemptions ?? 0),
      offerRedemptionRate: totalPartners > 0 ? Math.round((num(pr.offer_partners ?? 0) / totalPartners) * 1000) / 10 : 0,
      successfulReferrals: num(pr.referral_count ?? 0),
      referralBonus: Math.round((num(pr.referral_points_value ?? null) + num(pr.referral_reward_discount ?? null)) * 100) / 100,
      // No table records social follower counts, so there is nothing real to report yet.
      socialFollowersAdded: null,
      billingCount: period.billCount,
      attributedSales: period.finalAmount,
    },
    period,
    previousPeriod,
    trend,
    periodByType: {
      DIRECT_PARTNER: { billCount: num(pr.direct_count ?? 0), billAmount: num(pr.direct_amount ?? null) },
      REFERRAL: { billCount: num(pr.referral_count ?? 0), billAmount: num(pr.referral_amount ?? null) },
    },
    topReferrers: topReferrers.map((r) => ({
      id: r.id,
      name: r.name,
      partnerCode: r.partner_code,
      referralCount: Number(r.referral_count),
      billAmount: num(r.bill_amount),
      referralPoints: num(r.referral_points),
    })),
    referrals: {
      shares,
      successful: num(pr.referral_count ?? 0),
      uniqueCustomers: num(pr.referral_customers ?? 0),
      rewardsUsed: num(pr.rewards_used ?? 0),
    },
    pointsFlow: {
      credited: period.purchasePoints + period.referralPoints,
      redeemed: n(redeemed._sum.points),
      redemptionCount: redeemed._count._all,
      redeemedRupees: n(redeemed._sum.rupeeValue),
    },
    partners: {
      total: partnerRows.reduce((sum, r) => sum + Number(r.total), 0),
      byStatus: tally(PARTNER_STATUSES, (r) => r.status),
      newLast30Days: partnerRows.reduce((sum, r) => sum + Number(r.recent), 0),
      newInPeriod: partnerRows.reduce((sum, r) => sum + Number(r.in_period), 0),
    },
    outlets: { total: activeOutlets + inactiveOutlets, active: activeOutlets, inactive: inactiveOutlets },
    transactions: {
      allTime: bills.allTime,
      today: bills.today,
      last30Days: bills.last30Days,
      previous30Days: bills.previous30Days,
      byType: bills.byType,
      daily,
    },
    points: {
      creditedPoints: num(points[0]?.credited ?? null),
      pendingPoints: num(points[0]?.pending ?? null),
      pointsRatio: settings.pointsToRupees,
    },
    // Bill message delivery within the period.
    notifications: {
      PENDING: num(pr.notif_pending ?? 0),
      SENT: num(pr.notif_sent ?? 0),
      FAILED: num(pr.notif_failed ?? 0),
      SKIPPED: num(pr.notif_skipped ?? 0),
    },
    topOutlets: topOutlets.map((o) => ({
      id: o.id,
      name: o.name,
      status: o.status,
      billCount: Number(o.bill_count),
      billAmount: num(o.bill_amount),
    })),
    recentBills: recentBills.map(serializeBill),
    recentPartners: recentPartners.partners,
    system: {
      // Every query above succeeded, so the database answered; a failure surfaces as an error response.
      database: 'connected',
      settingsConfigured: settings.isPersisted,
      settingsUpdatedAt: settings.updatedAt ?? null,
      messagingMode: settings.messagingMode,
    },
  };
}

/** Dashboard export: the headline figures for the period, then the trend table behind the charts. */
export async function dashboardCsv(query: AdminDateRangeQuery = {}): Promise<string> {
  const d = await getDashboard(query);
  const m = d.programMetrics;
  const summary: { metric: string; value: string | number }[] = [
    { metric: 'Period from', value: d.range.from },
    { metric: 'Period to', value: d.range.to },
    { metric: 'App registrations', value: m.appRegistrations },
    { metric: 'Offer redemptions', value: m.offerRedemptions },
    { metric: 'Offer redemption rate (% of registered partners)', value: m.offerRedemptionRate },
    { metric: 'Successful referrals', value: m.successfulReferrals },
    { metric: 'Referral bonus (INR)', value: m.referralBonus },
    { metric: 'Social followers added', value: m.socialFollowersAdded ?? 'Not tracked' },
    { metric: 'Billing count', value: m.billingCount },
    { metric: 'Attributed sales (INR)', value: m.attributedSales },
    { metric: 'Gross sales (INR)', value: d.period.billAmount },
    { metric: 'Discounts given (INR)', value: d.period.discountAmount },
    { metric: 'Referral QR shares', value: d.referrals.shares },
    { metric: 'Referral rewards used', value: d.referrals.rewardsUsed },
    { metric: 'Points credited', value: d.pointsFlow.credited },
    { metric: 'Points redeemed', value: d.pointsFlow.redeemed },
    { metric: 'Total partners', value: d.partners.total },
    { metric: 'Total outlets', value: d.outlets.total },
  ];
  const head = toCsv<(typeof summary)[number]>(
    [
      { header: 'Metric', value: (r) => r.metric },
      { header: 'Value', value: (r) => r.value },
    ],
    summary
  );
  const trend = toCsv<AdminTrendPoint>(
    [
      { header: d.range.granularity === 'month' ? 'Month' : 'Date', value: (p) => p.date },
      { header: 'Bills', value: (p) => p.billCount },
      { header: 'Gross sales (INR)', value: (p) => p.billAmount },
      { header: 'Discounts (INR)', value: (p) => p.discountAmount },
      { header: 'Successful referrals', value: (p) => p.referralBills },
      { header: 'Referral QR shares', value: (p) => p.referralShares },
      { header: 'New partners', value: (p) => p.newPartners },
      { header: 'Points credited', value: (p) => p.pointsCredited },
      { header: 'Points redeemed', value: (p) => p.pointsRedeemed },
    ],
    d.trend
  );
  // One file, two tables separated by a blank line; only the first keeps the UTF-8 BOM.
  return `${head}\r\n${trend.replace(/^\uFEFF/, '')}`;
}

const SEARCH_RESULTS_PER_KIND = 6;

/** Dashboard search: the best few partners and outlets matching one query. */
export async function adminSearch(q: string): Promise<AdminSearchResult> {
  const [partners, outlets] = await Promise.all([
    listPartners({ page: 1, limit: SEARCH_RESULTS_PER_KIND, search: q, sort: 'newest' }),
    listOutlets({ search: q }),
  ]);
  return { partners: partners.partners, outlets: outlets.slice(0, SEARCH_RESULTS_PER_KIND) };
}
