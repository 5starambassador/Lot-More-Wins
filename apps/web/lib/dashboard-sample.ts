import type { AdminDashboard, AdminOutletOption, AdminPartnerListItem, AdminTrendPoint, BillRecord, BillTotals } from '@lotmorewins/types';

/**
 * Sample figures for the dashboard's "Test data" option, used to demonstrate the panel
 * without real activity. Nothing here reads or writes the database. Every day's figures are
 * derived from its date alone, so the same period always shows the same numbers.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const POINTS_RATIO = { points: 10, rupees: 1 };
const PURCHASE_POINTS_PERCENT = 5;
const REFERRAL_POINTS_PERCENT = 3;

/** A stable pseudo-random number in [0, 1) for a text seed. */
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dateOf = (time: number) => new Date(time).toISOString().slice(0, 10);
/** Today's IST calendar date. */
const todayIst = () => dateOf(Date.now() + 5.5 * 60 * 60 * 1000);

/**
 * One day of sample activity; days after today are empty. `share` is the part of the
 * programme's bills made at the chosen outlet (1 = every outlet); registrations and QR shares
 * do not belong to an outlet, so they are never scaled.
 */
function dayPoint(date: string, today: string, share: number): AdminTrendPoint {
  if (date > today) {
    return { date, billCount: 0, billAmount: 0, discountAmount: 0, referralBills: 0, referralShares: 0, newPartners: 0, pointsCredited: 0, pointsRedeemed: 0 };
  }
  const weekday = new Date(dayTime(date)).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 1.35 : 1;
  const allBills = Math.round((18 + rand(`${date}:bills`) * 14) * weekend);
  const billCount = Math.round(allBills * share);
  const billAmount = Math.round(billCount * (620 + rand(`${date}:avg`) * 360));
  const discountAmount = Math.round(billAmount * (0.11 + rand(`${date}:discount`) * 0.03));
  const referralRate = 0.22 + rand(`${date}:referrals`) * 0.12;
  const referralBills = Math.round(billCount * referralRate);
  const pointsCredited = Math.round(((billAmount - discountAmount) * PURCHASE_POINTS_PERCENT * POINTS_RATIO.points) / 100);
  return {
    date,
    billCount,
    billAmount,
    discountAmount,
    referralBills,
    referralShares: Math.round(allBills * referralRate) * 3 + Math.round(rand(`${date}:shares`) * 9),
    newPartners: Math.round((3 + rand(`${date}:partners`) * 6) * weekend),
    pointsCredited,
    pointsRedeemed: Math.round(pointsCredited * (0.25 + rand(`${date}:redeemed`) * 0.2)),
  };
}

function daysBetween(from: string, to: string, today: string, share: number): AdminTrendPoint[] {
  const out: AdminTrendPoint[] = [];
  for (let t = dayTime(from); t <= dayTime(to); t += DAY_MS) out.push(dayPoint(dateOf(t), today, share));
  return out;
}

const sum = (points: AdminTrendPoint[], key: Exclude<keyof AdminTrendPoint, 'date'>) => points.reduce((total, p) => total + p[key], 0);

function totals(points: AdminTrendPoint[], scale = 1): BillTotals {
  const billAmount = Math.round(sum(points, 'billAmount') * scale);
  const discountAmount = Math.round(sum(points, 'discountAmount') * scale);
  const credited = Math.round(sum(points, 'pointsCredited') * scale);
  const referralPoints = Math.round(credited * 0.18);
  return {
    billCount: Math.round(sum(points, 'billCount') * scale),
    billAmount,
    discountAmount,
    finalAmount: billAmount - discountAmount,
    purchasePoints: credited - referralPoints,
    referralPoints,
  };
}

const OUTLETS = ['Sample Café, White Town', 'Sample Bistro, Auroville', 'Sample Bakery, Lawspet', 'Sample Diner, Villianur', 'Sample Grill, Muthialpet'];
const OUTLET_SHARE = [0.31, 0.24, 0.19, 0.15, 0.11];

/** The sample outlets, for the dashboard's channel filter while test data is shown. */
export const SAMPLE_OUTLETS: AdminOutletOption[] = OUTLETS.map((name, i) => ({ id: `sample-outlet-${i + 1}`, name }));
const PEOPLE = ['Sample Partner One', 'Sample Partner Two', 'Sample Partner Three', 'Sample Partner Four', 'Sample Partner Five', 'Sample Partner Six'];
const CITIES = ['Puducherry', 'Chennai', 'Cuddalore', 'Villupuram', 'Karaikal', 'Puducherry'];

const samplePartner = (i: number) => ({
  id: `sample-partner-${i + 1}`,
  name: PEOPLE[i % PEOPLE.length]!,
  mobile: `900000000${i + 1}`,
  partnerCode: `SAMPLE${String(i + 1).padStart(3, '0')}`,
});

function sampleBill(i: number, now: number, at: AdminOutletOption | null): BillRecord {
  const referral = i % 3 === 1;
  const isFirstTime = !referral && i % 3 === 0;
  const billAmount = 480 + i * 265;
  const discountPercentage = isFirstTime ? 20 : 10;
  const discountAmount = Math.round((billAmount * discountPercentage) / 100);
  const finalAmount = billAmount - discountAmount;
  const createdAt = new Date(now - (i * 47 + 12) * 60 * 1000).toISOString();
  const partner = samplePartner(i);
  const failed = i === 4;
  return {
    id: `sample-bill-${i + 1}`,
    billNumber: `SAMPLE-${String(1042 - i).padStart(5, '0')}`,
    qrType: referral ? 'REFERRAL' : 'DEFAULT_DISCOUNT',
    createdAt,
    transactionType: referral ? 'REFERRAL' : 'DIRECT_PARTNER',
    isFirstTime,
    billAmount,
    discountPercentage,
    birthdayBonusPercentage: 0,
    referralRewardPercentage: 0,
    discountAmount,
    finalAmount,
    pointsBasis: 'PAYABLE_AMOUNT',
    pointsBaseAmount: finalAmount,
    pointsRatio: POINTS_RATIO,
    purchasePointsPercentage: PURCHASE_POINTS_PERCENT,
    purchasePoints: Math.round((finalAmount * PURCHASE_POINTS_PERCENT * POINTS_RATIO.points) / 100),
    purchasePointsRecipient: referral ? 'CUSTOMER_PENDING' : 'PARTNER',
    referralPointsPercentage: referral ? REFERRAL_POINTS_PERCENT : 0,
    referralPoints: referral ? Math.round((finalAmount * REFERRAL_POINTS_PERCENT * POINTS_RATIO.points) / 100) : 0,
    settingsVersion: null,
    outlet: at ?? SAMPLE_OUTLETS[i % SAMPLE_OUTLETS.length]!,
    partner: referral ? null : partner,
    referrerPartner: referral ? partner : null,
    customer: referral ? { id: `sample-customer-${i + 1}`, name: `Sample Customer ${i + 1}`, mobile: `910000000${i + 1}`, email: null } : null,
    notification: {
      status: failed ? 'FAILED' : 'SENT',
      channel: 'email',
      recipient: `sample${i + 1}@example.com`,
      error: failed ? 'Sample delivery failure' : null,
      attempts: failed ? 3 : 1,
      sentAt: failed ? null : createdAt,
    },
  };
}

/**
 * `buckets` are the empty chart buckets of the period (days, or months for a long period);
 * each is filled from the sample days that fall inside it. `outletId` (one of SAMPLE_OUTLETS)
 * narrows the bill-based figures to that outlet's share; any other id shows every outlet.
 */
export function sampleDashboard(range: AdminDashboard['range'], buckets: AdminTrendPoint[], outletId?: string): AdminDashboard {
  const now = Date.now();
  const today = todayIst();
  const outletIndex = SAMPLE_OUTLETS.findIndex((o) => o.id === outletId);
  const outlet = outletIndex >= 0 ? SAMPLE_OUTLETS[outletIndex]! : null;
  const share = outlet ? OUTLET_SHARE[outletIndex]! : 1;
  const days = daysBetween(range.from, range.to, today, share);
  const keys = ['billCount', 'billAmount', 'discountAmount', 'referralBills', 'referralShares', 'newPartners', 'pointsCredited', 'pointsRedeemed'] as const;
  const trend = buckets.map((bucket) => {
    const inBucket = days.filter((d) => d.date.startsWith(bucket.date));
    const filled = { ...bucket };
    for (const key of keys) filled[key] = sum(inBucket, key);
    return filled;
  });

  const period = totals(days);
  const last30 = daysBetween(dateOf(dayTime(today) - 29 * DAY_MS), today, today, share);
  const last30Days = totals(last30);
  const allTimeBase: BillTotals = { billCount: 18420, billAmount: 14_652_300, discountAmount: 1_815_900, finalAmount: 12_836_400, purchasePoints: 5_263_000, referralPoints: 1_155_300 };
  const allTime = Object.fromEntries(
    Object.entries(allTimeBase).map(([k, v]) => [k, Math.round(v * share) + period[k as keyof BillTotals]])
  ) as unknown as BillTotals;

  const referralBills = sum(days, 'referralBills');
  const referralAmount = period.billCount ? Math.round((period.billAmount * referralBills) / period.billCount) : 0;
  const redeemed = sum(days, 'pointsRedeemed');
  const newInPeriod = sum(days, 'newPartners');
  const failedMessages = Math.round(period.billCount * 0.01);
  const skippedMessages = Math.round(period.billCount * 0.03);
  const pendingMessages = Math.round(period.billCount * 0.02);

  const recentPartners: AdminPartnerListItem[] = Array.from({ length: 5 }, (_, i) => ({
    ...samplePartner(i),
    email: `sample${i + 1}@example.com`,
    city: CITIES[i]!,
    status: i === 3 ? 'PENDING' : 'ACTIVE',
    pointsBalance: 420 - i * 60,
    directBillCount: 4 - Math.min(i, 3),
    referredBillCount: i % 2,
    referralShareCount: 6 - i,
    referredBy: null,
    createdAt: new Date(now - (i * 5 + 2) * 60 * 60 * 1000).toISOString(),
  }));

  return {
    source: 'test',
    outlet,
    generatedAt: new Date(now).toISOString(),
    range,
    programMetrics: {
      appRegistrations: newInPeriod,
      offerRedemptions: Math.round(period.billCount * 0.22),
      offerRedemptionRate: 34.5,
      successfulReferrals: referralBills,
      referralBonus: Math.round((period.referralPoints * POINTS_RATIO.rupees) / POINTS_RATIO.points + referralAmount * 0.01),
      socialFollowersAdded: range.days * 38,
      billingCount: period.billCount,
      attributedSales: period.finalAmount,
    },
    period,
    previousPeriod: totals(days, 0.87),
    trend,
    periodByType: {
      DIRECT_PARTNER: { billCount: period.billCount - referralBills, billAmount: period.billAmount - referralAmount },
      REFERRAL: { billCount: referralBills, billAmount: referralAmount },
    },
    topReferrers: referralBills
      ? OUTLET_SHARE.map((share, i) => {
          const billAmount = Math.round(referralAmount * share * 0.4);
          return {
            ...samplePartner(i),
            referralCount: Math.max(1, Math.round(referralBills * share * 0.4)),
            billAmount,
            referralPoints: Math.round((billAmount * REFERRAL_POINTS_PERCENT * POINTS_RATIO.points) / 100),
          };
        })
      : [],
    referrals: {
      shares: sum(days, 'referralShares'),
      successful: referralBills,
      uniqueCustomers: Math.round(referralBills * 0.82),
      rewardsUsed: Math.floor(referralBills / 25),
    },
    pointsFlow: {
      credited: period.purchasePoints + period.referralPoints,
      redeemed,
      redemptionCount: Math.round(period.billCount * 0.12),
      redeemedRupees: Math.round((redeemed * POINTS_RATIO.rupees) / POINTS_RATIO.points),
    },
    partners: {
      total: 1284,
      byStatus: { ACTIVE: 1196, PENDING: 52, SUSPENDED: 28, REJECTED: 8 },
      newLast30Days: sum(last30, 'newPartners'),
      newInPeriod,
    },
    outlets: { total: 12, active: 11, inactive: 1 },
    transactions: {
      allTime,
      today: totals([dayPoint(today, today, share)]),
      last30Days,
      previous30Days: totals(last30, 0.87),
      byType: { DIRECT_PARTNER: Math.round(allTime.billCount * 0.72), REFERRAL: Math.round(allTime.billCount * 0.28) },
      daily: last30.map((d) => ({ date: d.date, billCount: d.billCount, billAmount: d.billAmount })),
    },
    points: { creditedPoints: 486_250, pendingPoints: 38_400, pointsRatio: POINTS_RATIO },
    notifications: {
      PENDING: pendingMessages,
      SENT: period.billCount - failedMessages - skippedMessages - pendingMessages,
      FAILED: failedMessages,
      SKIPPED: skippedMessages,
    },
    topOutlets: !period.billCount
      ? []
      : outlet
        ? [{ ...outlet, status: 'ACTIVE' as const, billCount: period.billCount, billAmount: period.billAmount }]
        : SAMPLE_OUTLETS.map((o, i) => ({
            ...o,
            status: 'ACTIVE' as const,
            billCount: Math.round(period.billCount * OUTLET_SHARE[i]!),
            billAmount: Math.round(period.billAmount * OUTLET_SHARE[i]!),
          })),
    recentBills: period.billCount ? Array.from({ length: 6 }, (_, i) => sampleBill(i, now, outlet)) : [],
    recentPartners,
    system: { database: 'connected', settingsConfigured: true, settingsUpdatedAt: new Date(now - 3 * DAY_MS).toISOString(), messagingMode: 'email' },
  };
}
