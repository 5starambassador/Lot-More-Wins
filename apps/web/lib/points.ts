import { Prisma } from '@prisma/client';
import type { PartnerWallet } from '@lotmorewins/types';
import prisma from './prisma';
import { getProgramSettings } from './settings';

/**
 * Points wallet. The ledger (PointsEntry) is the only record of points; a partner's balance
 * is the sum of their entries. Points earned as a referred customer are held against the
 * customer's mobile (partnerId null) and claimed when a partner registers with that mobile.
 * Entries past their expiresAt stay in the ledger as history but count towards no balance.
 */

/** Filter for entries that still count towards a balance. */
export function unexpiredPoints(now = new Date()): Prisma.PointsEntryWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
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
  const [settings, byType, entries] = await Promise.all([
    getProgramSettings(),
    prisma.pointsEntry.groupBy({ by: ['type'], where: { partnerId, ...unexpiredPoints(now) }, _sum: { points: true } }),
    prisma.pointsEntry.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { bill: { select: { billNumber: true, outlet: { select: { name: true } } } } },
    }),
  ]);

  const sumOf = (type: 'PURCHASE' | 'REFERRAL') =>
    byType.find((g) => g.type === type)?._sum.points ?? new Prisma.Decimal(0);
  const balance = sumOf('PURCHASE').plus(sumOf('REFERRAL'));
  const { points, rupees } = settings.pointsToRupees;

  return {
    balancePoints: balance.toNumber(),
    rupeeValue: balance.mul(rupees).div(points).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN).toNumber(),
    pointsRatio: { points, rupees },
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
  };
}
