import { Prisma } from '@prisma/client';
import type { CashWallet, PartnerWallet, WalletEntryType } from '@lotmorewins/types';
import { MAX_BILL_REDUCTION_PERCENT } from '@lotmorewins/validation';
import prisma from './prisma';
import { HttpError } from './auth';
import { getProgramSettings } from './settings';

/**
 * The partner wallet: one wallet for everything a partner earns. The ledger (PointsEntry) is the
 * only record: purchase and referral points, cash rewards (credited as points at the ratio),
 * transfers received and the cash reward balance moved in when the two wallets became one. A
 * partner's balance is the sum of (points - redeemedPoints) over their unexpired entries;
 * redemptions and transfers sent spend entries soonest-expiring first. Rewards earned as a
 * referred customer are held against the customer's mobile (partnerId null) and claimed when a
 * partner registers with that mobile. Entries past their expiresAt stay in the ledger as history
 * but count towards no balance.
 */

type Db = Prisma.TransactionClient | typeof prisma;
const Decimal = Prisma.Decimal;

/** Filter for entries that still count towards a balance. */
export function unexpiredPoints(now = new Date()): Prisma.PointsEntryWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/** Points the partner can still spend: unexpired and not yet redeemed or sent. */
export async function availablePoints(db: Db, partnerId: string, now = new Date()): Promise<Prisma.Decimal> {
  const sums = await db.pointsEntry.aggregate({
    where: { partnerId, ...unexpiredPoints(now) },
    _sum: { points: true, redeemedPoints: true },
  });
  return (sums._sum.points ?? new Decimal(0)).minus(sums._sum.redeemedPoints ?? 0);
}

/** Rupee worth of a points amount at the given ratio, rounded down to the paisa. */
export function rupeeValueOf(points: Prisma.Decimal, ratio: { points: number; rupees: number }): Prisma.Decimal {
  return points.mul(ratio.rupees).div(ratio.points).toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

/** A redeem QR is worth up to half the wallet. */
export function redeemQrWorth(balance: Prisma.Decimal): Prisma.Decimal {
  return Decimal.max(0, balance).mul(MAX_BILL_REDUCTION_PERCENT).div(100).toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

/** The wallet's advisory lock: every spend (redemption, transfer) of one wallet is serialized on it. */
export async function lockWallet(tx: Prisma.TransactionClient, partnerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${partnerId}`}))`;
}

/**
 * Spends `points` from the partner's wallet, soonest-expiring entries first and points that never
 * expire last. Call with the wallet lock held. Throws 422 INSUFFICIENT_POINTS when the balance is
 * short. Returns the soonest expiry among the entries spent (null when they all never expire).
 */
export async function spendWalletPoints(
  tx: Prisma.TransactionClient,
  partnerId: string,
  points: Prisma.Decimal,
  insufficientMessage = 'Not enough in the wallet for this amount'
): Promise<{ soonestExpiry: Date | null; balanceBefore: Prisma.Decimal }> {
  const entries = await tx.pointsEntry.findMany({
    where: { partnerId, ...unexpiredPoints() },
    orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    select: { id: true, points: true, redeemedPoints: true, expiresAt: true },
  });
  const balance = entries.reduce((sum, e) => sum.plus(e.points).minus(e.redeemedPoints), new Decimal(0));
  if (points.lte(0) || points.gt(balance)) {
    throw new HttpError(422, points.lte(0) ? 'The amount is too small' : insufficientMessage, 'INSUFFICIENT_POINTS', {
      balancePoints: balance.toNumber(),
    });
  }

  let remaining = points;
  let soonestExpiry: Date | null = null;
  for (const entry of entries) {
    if (remaining.lte(0)) break;
    const spend = Decimal.min(remaining, entry.points.minus(entry.redeemedPoints));
    if (spend.lte(0)) continue;
    await tx.pointsEntry.update({
      where: { id: entry.id },
      data: { redeemedPoints: { increment: spend } },
    });
    if (entry.expiresAt && (!soonestExpiry || entry.expiresAt < soonestExpiry)) soonestExpiry = entry.expiresAt;
    remaining = remaining.minus(spend);
  }
  return { soonestExpiry, balanceBefore: balance };
}

/**
 * Links the customer with this mobile to the new partner and claims their pending rewards
 * (points, and the cash reward credited as points). Must run inside the registration
 * transaction. Takes the same per-mobile lock as billing, so a referral bill for this mobile
 * either commits before (and is claimed here) or waits and then sees the partner and credits
 * them directly.
 */
export async function claimPendingPoints(tx: Prisma.TransactionClient, partnerId: string, mobile: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bill:cust:${mobile}`}))`;
  const customer = await tx.customer.findUnique({
    where: { mobile },
    select: { id: true },
  });
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
  return {
    claimedPoints: pending._sum.points?.toNumber() ?? 0,
    claimedEntries: claimed.count,
  };
}

/** What older app versions get for the retired cash wallet: empty, payouts off. */
function retiredCashWallet(): CashWallet {
  return {
    balance: 0,
    pendingPayout: 0,
    available: 0,
    upiId: null,
    minimumPayout: 0,
    weeklyPayoutEnabled: false,
    payoutWeekday: 1,
    canRequestPayout: false,
    totals: { purchase: 0, referral: 0, paidOut: 0 },
    entries: [],
    payouts: [],
  };
}

const CASHBACK_TYPES: WalletEntryType[] = ['CASHBACK_PURCHASE', 'CASHBACK_REFERRAL', 'CASH_WALLET_MERGE'];

export async function getPartnerWallet(partnerId: string, limit = 50): Promise<PartnerWallet> {
  const now = new Date();
  const [settings, byType, entries, redemptions, transfers] = await Promise.all([
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
      include: {
        bill: { select: { billNumber: true, outlet: { select: { name: true } } } },
        transfer: { select: { fromPartner: { select: { name: true } } } },
      },
    }),
    prisma.pointsRedemption.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { outlet: { select: { name: true } }, bill: { select: { billNumber: true, billAmount: true } } },
    }),
    prisma.walletTransfer.findMany({
      where: { OR: [{ fromPartnerId: partnerId }, { toPartnerId: partnerId }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        fromPartner: { select: { name: true, mobile: true } },
        toPartner: { select: { name: true, mobile: true } },
      },
    }),
  ]);

  const sumOf = (...types: WalletEntryType[]) =>
    byType
      .filter((g) => types.includes(g.type))
      .reduce((sum, g) => sum.plus(g._sum.points ?? 0).minus(g._sum.redeemedPoints ?? 0), new Decimal(0));
  const balance = sumOf('PURCHASE', 'REFERRAL', 'TRANSFER_IN', ...CASHBACK_TYPES);
  const ratio = { ...settings.pointsToRupees };
  const redeemMax = redeemQrWorth(balance);

  return {
    balancePoints: balance.toNumber(),
    rupeeValue: rupeeValueOf(balance, ratio).toNumber(),
    pointsRatio: ratio,
    walletDisplay: settings.walletDisplay,
    totals: {
      purchasePoints: sumOf('PURCHASE').toNumber(),
      referralPoints: sumOf('REFERRAL').toNumber(),
      cashbackPoints: sumOf(...CASHBACK_TYPES).toNumber(),
      transferInPoints: sumOf('TRANSFER_IN').toNumber(),
    },
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      points: e.points.toNumber(),
      billNumber: e.bill?.billNumber ?? null,
      outletName: e.bill?.outlet.name ?? null,
      fromPartnerName: e.transfer?.fromPartner.name ?? null,
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
      billNumber: r.bill?.billNumber ?? null,
      billAmount: r.bill?.billAmount.toNumber() ?? r.billAmount?.toNumber() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    transfers: transfers.map((t) => {
      const out = t.fromPartnerId === partnerId;
      const other = out ? t.toPartner : t.fromPartner;
      return {
        id: t.id,
        transferNumber: t.transferNumber,
        direction: out ? ('OUT' as const) : ('IN' as const),
        points: t.points.toNumber(),
        rupeeValue: t.rupeeValue.toNumber(),
        counterparty: { name: other.name, mobile: other.mobile },
        createdAt: t.createdAt.toISOString(),
      };
    }),
    redeemEnabled: settings.redeemQrEnabled,
    redeemMaxPoints: redeemMax.toNumber(),
    redeemMaxRupees: rupeeValueOf(redeemMax, ratio).toNumber(),
    cash: retiredCashWallet(),
  };
}
