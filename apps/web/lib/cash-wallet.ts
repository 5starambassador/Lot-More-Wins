import crypto from 'crypto';
import { Prisma, type Payout } from '@prisma/client';
import type { CashWallet, PayoutRecord, WeeklyPayoutRunResult } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';
import { getProgramSettings } from './settings';
import { toDateOnly } from './partners';
import { payoutRequestedRow, pushNotification } from './partner-notifications';
import { sendPush } from './push';

/**
 * Cash reward wallet (₹). The ledger (CashRewardEntry) is the only record of money: the balance
 * is credits (PURCHASE + REFERRAL) minus PAYOUT debits. A Pending payout holds its amount (it is
 * not available for another payout) but is not a debit: the debit is written only when the
 * Finance sheet marks it Paid, for the amount actually paid. Rewards earned after a payout was
 * created therefore always stay in the wallet. Every payout operation on a wallet holds the
 * wallet's advisory lock.
 */

type Db = Prisma.TransactionClient | typeof prisma;
const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

export async function lockWallet(tx: Prisma.TransactionClient, partnerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${partnerId}`}))`;
}

export interface CashBalance {
  credits: Prisma.Decimal;
  paidOut: Prisma.Decimal;
  balance: Prisma.Decimal;
  pending: Prisma.Decimal;
  available: Prisma.Decimal;
  hasPending: boolean;
}

export async function cashBalance(db: Db, partnerId: string): Promise<CashBalance> {
  const [byType, pending] = await Promise.all([
    db.cashRewardEntry.groupBy({
      by: ['type'],
      where: { partnerId },
      _sum: { amount: true },
    }),
    db.payout.aggregate({
      where: { partnerId, status: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const sum = (types: string[]) => byType.filter((g) => types.includes(g.type)).reduce((s, g) => s.plus(g._sum.amount ?? 0), ZERO);
  const credits = sum(['PURCHASE', 'REFERRAL']);
  const paidOut = sum(['PAYOUT']);
  const balance = credits.minus(paidOut);
  const pendingAmount = pending._sum.amount ?? ZERO;
  return {
    credits,
    paidOut,
    balance,
    pending: pendingAmount,
    available: Decimal.max(ZERO, balance.minus(pendingAmount)),
    hasPending: pending._count > 0,
  };
}

export function serializePayout(p: Payout): PayoutRecord {
  return {
    id: p.id,
    payoutNumber: p.payoutNumber,
    amount: p.amount.toNumber(),
    status: p.status,
    source: p.source,
    upiId: p.upiId,
    requestedAt: p.requestedAt.toISOString(),
    paidAmount: p.paidAmount?.toNumber() ?? null,
    paidOn: toDateOnly(p.paidOn),
    upiTxnRef: p.upiTxnRef,
    failureNote: p.failureNote,
    settledAt: p.settledAt?.toISOString() ?? null,
  };
}

export async function getCashWallet(partnerId: string, limit = 50, db: Db = prisma): Promise<CashWallet> {
  const [settings, partner, balance, byType, entries, payouts] = await Promise.all([
    getProgramSettings(db),
    db.partner.findUnique({
      where: { id: partnerId },
      select: { upiId: true, status: true },
    }),
    cashBalance(db, partnerId),
    db.cashRewardEntry.groupBy({
      by: ['type'],
      where: { partnerId },
      _sum: { amount: true },
    }),
    db.cashRewardEntry.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        bill: {
          select: { billNumber: true, outlet: { select: { name: true } } },
        },
        payout: { select: { payoutNumber: true } },
      },
    }),
    db.payout.findMany({
      where: { partnerId },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    }),
  ]);
  const total = (type: string) => byType.find((g) => g.type === type)?._sum.amount?.toNumber() ?? 0;
  const upiId = partner?.upiId ?? null;
  return {
    balance: balance.balance.toNumber(),
    pendingPayout: balance.pending.toNumber(),
    available: balance.available.toNumber(),
    upiId,
    minimumPayout: settings.payoutMinimumAmount,
    weeklyPayoutEnabled: settings.weeklyPayoutEnabled,
    payoutWeekday: settings.payoutWeekday,
    canRequestPayout: !!upiId && partner?.status === 'ACTIVE' && balance.available.gt(0) && !balance.hasPending,
    totals: {
      purchase: total('PURCHASE'),
      referral: total('REFERRAL'),
      paidOut: total('PAYOUT'),
    },
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: e.amount.toNumber(),
      billNumber: e.bill?.billNumber ?? null,
      outletName: e.bill?.outlet.name ?? null,
      payoutNumber: e.payout?.payoutNumber ?? null,
      claimedAt: e.claimedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
    payouts: payouts.map(serializePayout),
  };
}

function generatePayoutNumber(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const ymd = ist.toISOString().slice(0, 10).replace(/-/g, '');
  return `LMW-PO-${ymd}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Creates a Pending payout of the whole available balance, inside the caller's transaction and
 * under the wallet lock. Returns null when nothing can be paid out (see the reasons below).
 */
async function createPendingPayout(
  tx: Prisma.TransactionClient,
  partnerId: string,
  source: 'WEEKLY' | 'MANUAL',
  options: { minimum?: Prisma.Decimal; weekKey?: string } = {}
): Promise<{
  payout: Payout | null;
  reason: 'NO_UPI' | 'PENDING_EXISTS' | 'WEEK_EXISTS' | 'BELOW_MINIMUM' | 'INACTIVE' | null;
}> {
  await lockWallet(tx, partnerId);
  const partner = await tx.partner.findUniqueOrThrow({
    where: { id: partnerId },
    select: { upiId: true, status: true },
  });
  if (partner.status !== 'ACTIVE') return { payout: null, reason: 'INACTIVE' };
  if (
    options.weekKey &&
    (await tx.payout.findUnique({
      where: { partnerId_weekKey: { partnerId, weekKey: options.weekKey } },
    }))
  ) {
    return { payout: null, reason: 'WEEK_EXISTS' };
  }
  const balance = await cashBalance(tx, partnerId);
  if (balance.hasPending) return { payout: null, reason: 'PENDING_EXISTS' };
  if (balance.available.lte(0) || (options.minimum && balance.available.lt(options.minimum))) {
    return { payout: null, reason: 'BELOW_MINIMUM' };
  }
  if (!partner.upiId) return { payout: null, reason: 'NO_UPI' };

  const payout = await tx.payout.create({
    data: {
      payoutNumber: generatePayoutNumber(),
      partnerId,
      amount: balance.available,
      source,
      upiId: partner.upiId,
      weekKey: options.weekKey ?? null,
    },
  });
  return { payout, reason: null };
}

/** The partner's "Request Payout": the whole available balance, Pending until Finance pays it. */
export async function requestPayout(partnerId: string) {
  const { payout, notification } = await prisma.$transaction(
    async (tx) => {
      const { payout, reason } = await createPendingPayout(tx, partnerId, 'MANUAL');
      if (!payout) {
        if (reason === 'NO_UPI') throw new HttpError(422, 'Add your UPI ID in Profile before requesting a payout', 'UPI_REQUIRED');
        if (reason === 'PENDING_EXISTS') {
          throw new HttpError(409, 'A payout is already pending. It will be paid in 3–7 working days.', 'PAYOUT_PENDING');
        }
        if (reason === 'INACTIVE') throw new HttpError(403, 'This partner account is not active', 'PARTNER_INACTIVE');
        throw new HttpError(422, 'There is no cash reward balance to pay out yet', 'NO_CASH_BALANCE');
      }
      const notification = await tx.notification.create({
        data: payoutRequestedRow({
          partnerId,
          payoutId: payout.id,
          payoutNumber: payout.payoutNumber,
          amount: payout.amount,
          upiId: payout.upiId,
          weekly: false,
        }),
      });
      return { payout, notification };
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
  await pushNotification(notification);
  return {
    payout: serializePayout(payout),
    wallet: await getCashWallet(partnerId),
  };
}

/** A changed UPI ID also applies to the partner's payouts that are still Pending. */
export async function moveRequestedPayoutsToUpi(tx: Prisma.TransactionClient, partnerId: string, upiId: string) {
  await lockWallet(tx, partnerId);
  await tx.payout.updateMany({
    where: { partnerId, status: 'PENDING' },
    data: { upiId },
  });
}

// ============================================================================
// Weekly payout run (Vercel cron)
// ============================================================================

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** IST ISO week, e.g. 2026-W42. */
export function istWeekKey(now = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const date = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function istWeekday(now = new Date()): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCDay();
}

/**
 * Creates this week's Pending payouts for every active partner whose available balance is at or
 * above the minimum. Runs only on the configured IST weekday unless forced; running again in the
 * same week adds nothing (one weekly payout per partner per week, and never while one is Pending).
 */
export async function runWeeklyPayouts(options: { now?: Date; force?: boolean } = {}): Promise<WeeklyPayoutRunResult> {
  const now = options.now ?? new Date();
  const weekKey = istWeekKey(now);
  const result: WeeklyPayoutRunResult = {
    weekKey,
    ran: false,
    reason: null,
    created: 0,
    createdAmount: 0,
    skippedNoUpi: 0,
    skippedExisting: 0,
  };
  const settings = await getProgramSettings();
  if (!settings.isPersisted) return { ...result, reason: 'Programme settings have not been saved yet' };
  if (!settings.weeklyPayoutEnabled && !options.force) return { ...result, reason: 'Weekly payout is turned off' };
  if (istWeekday(now) !== settings.payoutWeekday && !options.force) {
    return {
      ...result,
      reason: `Today is not the payout day (weekday ${settings.payoutWeekday})`,
    };
  }
  result.ran = true;
  const minimum = new Decimal(settings.payoutMinimumAmount);

  // Candidates: partners whose ledger total reaches the minimum (exact check under the lock).
  const totals = await prisma.cashRewardEntry.groupBy({
    by: ['partnerId', 'type'],
    where: { partnerId: { not: null } },
    _sum: { amount: true },
  });
  const byPartner = new Map<string, Prisma.Decimal>();
  for (const g of totals) {
    const signed = g.type === 'PAYOUT' ? new Decimal(0).minus(g._sum.amount ?? 0) : new Decimal(g._sum.amount ?? 0);
    byPartner.set(g.partnerId!, (byPartner.get(g.partnerId!) ?? ZERO).plus(signed));
  }
  const candidates = [...byPartner].filter(([, balance]) => balance.gte(minimum)).map(([id]) => id);

  const pushes: Prisma.NotificationGetPayload<object>[] = [];
  for (const partnerId of candidates) {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const { payout, reason } = await createPendingPayout(tx, partnerId, 'WEEKLY', { minimum, weekKey });
        if (!payout) return { payout, reason, notification: null };
        const notification = await tx.notification.create({
          data: payoutRequestedRow({
            partnerId,
            payoutId: payout.id,
            payoutNumber: payout.payoutNumber,
            amount: payout.amount,
            upiId: payout.upiId,
            weekly: true,
          }),
        });
        return { payout, reason, notification };
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
    if (outcome.payout) {
      result.created++;
      result.createdAmount = new Decimal(result.createdAmount).plus(outcome.payout.amount).toNumber();
      if (outcome.notification) pushes.push(outcome.notification);
    } else if (outcome.reason === 'NO_UPI') result.skippedNoUpi++;
    else if (outcome.reason === 'PENDING_EXISTS' || outcome.reason === 'WEEK_EXISTS') result.skippedExisting++;
  }
  if (pushes.length) {
    await sendPush(
      pushes.map((n) => ({
        partnerId: n.partnerId,
        title: n.title,
        body: n.body,
        data: { notificationId: n.id, type: n.type },
      }))
    );
  }
  return result;
}
