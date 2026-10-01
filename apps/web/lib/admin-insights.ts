import { Prisma } from '@prisma/client';
import type {
  AdminDashboard,
  AdminPartnerDetail,
  AdminPartnerListItem,
  AdminPartnerSort,
  AdminTransactionRange,
  BillNotificationStatus,
  BillTotals,
  BillTransactionType,
  DailySalesPoint,
  PartnerRole,
  PartnerStatus,
} from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';
import { billInclude, serializeBill, startOfTodayIst } from './billing';
import { getPartnerWallet, unexpiredPoints } from './points';
import { getProgramSettings } from './settings';

/**
 * Read-only aggregates for the Super Admin panel. Nothing here writes; every figure is
 * derived from the same tables the billing and points flows already maintain.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
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
const PARTNER_ROLES = ['NON_ACHARIYA', 'STAFF', 'TEACHER', 'PARENT'] as const satisfies readonly PartnerRole[];

// ============================================================================
// Partners
// ============================================================================

const partnerListSelect = {
  id: true,
  partnerCode: true,
  name: true,
  mobile: true,
  email: true,
  role: true,
  isAchariyaAssociated: true,
  status: true,
  createdAt: true,
  _count: { select: { directBills: true, referredBills: true } },
} satisfies Prisma.PartnerSelect;

type PartnerListRow = Prisma.PartnerGetPayload<{ select: typeof partnerListSelect }>;

async function pointBalances(partnerIds: string[]): Promise<Map<string, number>> {
  if (partnerIds.length === 0) return new Map();
  const sums = await prisma.pointsEntry.groupBy({
    by: ['partnerId'],
    where: { partnerId: { in: partnerIds }, ...unexpiredPoints() },
    _sum: { points: true },
  });
  return new Map(sums.map((s) => [s.partnerId as string, n(s._sum.points)]));
}

function toListItem(p: PartnerListRow, balance: number): AdminPartnerListItem {
  return {
    id: p.id,
    partnerCode: p.partnerCode,
    name: p.name,
    mobile: p.mobile,
    email: p.email,
    role: p.role,
    isAchariyaAssociated: p.isAchariyaAssociated,
    status: p.status,
    pointsBalance: balance,
    directBillCount: p._count.directBills,
    referredBillCount: p._count.referredBills,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listPartners(query: {
  page: number;
  limit: number;
  search?: string;
  status?: PartnerStatus;
  role?: PartnerRole;
  sort: AdminPartnerSort;
}) {
  const search = query.search?.trim();
  const where: Prisma.PartnerWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search } },
            { partnerCode: { contains: search, mode: 'insensitive' } },
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
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  const balances = await pointBalances(rows.map((r) => r.id));
  return { total, partners: rows.map((r) => toListItem(r, balances.get(r.id) ?? 0)) };
}

export async function getPartnerDetail(id: string): Promise<AdminPartnerDetail> {
  const partner = await prisma.partner.findUnique({
    where: { id },
    select: {
      ...partnerListSelect,
      employeeId: true,
      admissionNumber: true,
      updatedAt: true,
      achariyaEmployee: { select: { name: true, department: true, role: true } },
      achariyaStudent: { select: { studentName: true, grade: true } },
      qrCodes: { select: { id: true, code: true, type: true, status: true, createdAt: true }, orderBy: { type: 'asc' } },
    },
  });
  if (!partner) throw new HttpError(404, 'Partner not found', 'PARTNER_NOT_FOUND');

  const [wallet, directTotals, referredTotals, recentBills] = await Promise.all([
    getPartnerWallet(id, 20),
    billTotals({ partnerId: id }),
    billTotals({ referrerPartnerId: id }),
    prisma.bill.findMany({
      where: { OR: [{ partnerId: id }, { referrerPartnerId: id }] },
      include: billInclude,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const achariyaRecord = partner.achariyaEmployee
    ? { name: partner.achariyaEmployee.name, detail: partner.achariyaEmployee.department }
    : partner.achariyaStudent
      ? { name: partner.achariyaStudent.studentName, detail: partner.achariyaStudent.grade }
      : null;

  return {
    ...toListItem(partner, wallet.balancePoints),
    employeeId: partner.employeeId,
    admissionNumber: partner.admissionNumber,
    achariyaRecord,
    qrCodes: partner.qrCodes.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() })),
    wallet,
    directTotals,
    referredTotals,
    recentBills: recentBills.map(serializeBill),
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

export async function listTransactions(query: {
  page: number;
  limit: number;
  search?: string;
  outletId?: string;
  partnerId?: string;
  type?: BillTransactionType;
  notification?: BillNotificationStatus;
  range: AdminTransactionRange;
}) {
  const search = query.search?.trim();
  const since = rangeStart(query.range);
  const personMatch = (s: string): Prisma.PartnerWhereInput => ({
    OR: [
      { name: { contains: s, mode: 'insensitive' } },
      { mobile: { contains: s } },
      { partnerCode: { contains: s, mode: 'insensitive' } },
    ],
  });
  const and: Prisma.BillWhereInput[] = [];
  if (since) and.push({ createdAt: { gte: since } });
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
        { customer: { OR: [{ name: { contains: search, mode: 'insensitive' } }, { mobile: { contains: search } }] } },
      ],
    });
  }
  const where: Prisma.BillWhereInput = and.length ? { AND: and } : {};

  const [bills, summary] = await Promise.all([
    prisma.bill.findMany({
      where,
      include: billInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    billTotals(where),
  ]);
  return { total: summary.billCount, bills: bills.map(serializeBill), summary };
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

export async function getDashboard(): Promise<AdminDashboard> {
  const today = startOfTodayIst();
  const last30 = new Date(today.getTime() - 29 * DAY_MS);
  const prev30 = new Date(last30.getTime() - 30 * DAY_MS);

  // Two stages rather than one wide Promise.all: each parallel query can open its own pool
  // connection, and a burst of new TLS connections to a remote database can time out.
  const [partnerRows, outletsByStatus, settings, points, bills] = await Promise.all([
    prisma.$queryRaw<{ status: PartnerStatus; role: PartnerRole; total: bigint; recent: bigint }[]>`
      SELECT status, role, COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at >= ${last30}) AS recent
      FROM partners GROUP BY status, role`,
    prisma.outlet.groupBy({ by: ['status'], _count: { _all: true } }),
    getProgramSettings(),
    prisma.$queryRaw<{ credited: Num; pending: Num }[]>`
      SELECT SUM(points) FILTER (WHERE partner_id IS NOT NULL) AS credited,
             SUM(points) FILTER (WHERE partner_id IS NULL) AS pending
      FROM points_entries
      WHERE expires_at IS NULL OR expires_at > NOW()`,
    billSummary(today, last30, prev30),
  ]);
  const [daily, topOutlets, recentBills, recentPartners] = await Promise.all([
    dailySales(30),
    prisma.$queryRaw<{ id: string; name: string; status: 'ACTIVE' | 'INACTIVE'; bill_count: bigint; bill_amount: Num }[]>`
      SELECT o.id, o.name, o.status, COUNT(b.id) AS bill_count, SUM(b.bill_amount) AS bill_amount
      FROM bills b JOIN outlets o ON o.id = b.outlet_id
      GROUP BY o.id, o.name, o.status
      ORDER BY SUM(b.bill_amount) DESC
      LIMIT 5`,
    prisma.bill.findMany({ include: billInclude, orderBy: { createdAt: 'desc' }, take: 6 }),
    listPartners({ page: 1, limit: 5, sort: 'newest' }),
  ]);

  const activeOutlets = outletsByStatus.find((o) => o.status === 'ACTIVE')?._count._all ?? 0;
  const inactiveOutlets = outletsByStatus.find((o) => o.status === 'INACTIVE')?._count._all ?? 0;
  const tally = <K extends string>(keys: readonly K[], key: (r: (typeof partnerRows)[number]) => K) => {
    const out = countBy(keys, []);
    for (const r of partnerRows) out[key(r)] += Number(r.total);
    return out;
  };

  return {
    generatedAt: new Date().toISOString(),
    partners: {
      total: partnerRows.reduce((sum, r) => sum + Number(r.total), 0),
      byStatus: tally(PARTNER_STATUSES, (r) => r.status),
      byRole: tally(PARTNER_ROLES, (r) => r.role),
      newLast30Days: partnerRows.reduce((sum, r) => sum + Number(r.recent), 0),
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
    notifications: bills.notifications,
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
