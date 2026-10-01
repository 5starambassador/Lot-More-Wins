import { Prisma } from '@prisma/client';
import type { PartnerWallet } from '@lotmorewins/types';
import prisma from './prisma';
import { getProgramSettings } from './settings';

/**
 * Points wallet. The ledger (PointsEntry) is the only record of points; a partner's balance
 * is the sum of (points - redeemedPoints) over their unexpired entries. Points earned as a
 * referred customer are held against the customer's mobile (partnerId null) and claimed when
 * a partner registers with that mobile. Entries past their expiresAt stay in the ledger as
 * history but count towards no balance.
 */

type Db = Prisma.TransactionClient | typeof prisma;

/** Filter for entries that still count towards a balance. */
export function unexpiredPoints(now = new Date()): Prisma.PointsEntryWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/** Points the partner can still spend: unexpired and not yet redeemed. */
export async function availablePoints(db: Db, partnerId: string, now = new Date()): Promise<Prisma.Decimal> {
  const sums = await db.pointsEntry.aggregate({
    where: { partnerId, ...unexpiredPoints(now) },
    _sum: { points: true, redeemedPoints: true },
  });
  return (sums._sum.points ?? new Prisma.Decimal(0)).minus(sums._sum.redeemedPoints ?? 0);
}

/** Rupee worth of a points amount at the given ratio, rounded down to the paisa. */
export function rupeeValueOf(points: Prisma.Decimal, ratio: { points: number; rupees: number }): Prisma.Decimal {
  return points.mul(ratio.rupees).div(ratio.points).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
}

/**
 * Links the customer with this mobile to the new partner and claims their pending points.
 * Must run inside the registration transaction. Takes the same per-mobile lock as billing,
 * so a referral bill for this mobile either commits before (and is claimed here) or waits
 * and then sees the partner and credits them directly.
 */
export async function claimPendingPoints(tx: Prisma.TransactionClient, partnerId: string, mobile: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bill:cust:${mobile}`}))`;
  const customer = await tx.customer.findUnique({ where: { mobile }, select: { id: true } });
  if (!customer) return { claimedPoints: 0, claimedEntries: 0 };

  await tx.customer.update({ where: { id: customer.id }, data: { partnerId } });
  const pending = await tx.pointsEntry.aggregate({
    where: { customerId: customer.id, partnerId: null, ...unexpiredPoints() },
    _sum: { points: true },
  });
  const claimed = await tx.pointsEntry.updateMany({
    where: { customerId: customer.id, partnerId: null },
    data: { partnerId, claimedAt: new Date() },
  });
  return { claimedPoints: pending._sum.points?.toNumber() ?? 0, claimedEntries: claimed.count };
}

export async function getPartnerWallet(partnerId: string, limit = 50): Promise<PartnerWallet> {
  const now = new Date();
  const [settings, byType, entries, redemptions] = await Promise.all([
    getProgramSettings(),
    prisma.pointsEntry.groupBy({
      by: ['type'],
      where: { partnerId, ...unexpiredPoints(now) },
      _sum: { points: true, redeemedPoints: true },
    }),
    prisma.pointsEntry.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { bill: { select: { billNumber: true, outlet: { select: { name: true } } } } },
    }),
    prisma.pointsRedemption.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { outlet: { select: { name: true } } },
    }),
  ]);

  const sumOf = (type: 'PURCHASE' | 'REFERRAL') => {
    const sums = byType.find((g) => g.type === type)?._sum;
    return (sums?.points ?? new Prisma.Decimal(0)).minus(sums?.redeemedPoints ?? 0);
  };
  const balance = sumOf('PURCHASE').plus(sumOf('REFERRAL'));
  const ratio = { ...settings.pointsToRupees };

  return {
    balancePoints: balance.toNumber(),
    rupeeValue: rupeeValueOf(balance, ratio).toNumber(),
    pointsRatio: ratio,
    totals: { purchasePoints: sumOf('PURCHASE').toNumber(), referralPoints: sumOf('REFERRAL').toNumber() },
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      points: e.points.toNumber(),
      billNumber: e.bill.billNumber,
      outletName: e.bill.outlet.name,
      claimedAt: e.claimedAt?.toISOString() ?? null,
      expiresAt: e.expiresAt?.toISOString() ?? null,
      expired: e.expiresAt !== null && e.expiresAt <= now,
      createdAt: e.createdAt.toISOString(),
    })),
    redemptions: redemptions.map((r) => ({
      id: r.id,
      points: r.points.toNumber(),
      rupeeValue: r.rupeeValue.toNumber(),
      outletName: r.outlet.name,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
