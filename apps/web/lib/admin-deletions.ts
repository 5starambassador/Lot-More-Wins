import { Prisma } from '@prisma/client';
import type { BillDeletionResult, DeletionImpact } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';
import { availablePoints, lockWallet, spendWalletPoints } from './points';

const Decimal = Prisma.Decimal;

/**
 * Permanent deletes from the web panel. Partners, outlets and bills are linked (bills use a
 * partner's QR codes, points are earned on bills, redemptions happen at outlets), so each
 * delete also removes what cannot exist without it, inside one transaction: it either all
 * happens or nothing does. The panel shows the impact first and asks for confirmation.
 *
 * Deleting a bill reverses everything it did to the wallets (see deleteBill).
 */

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

// ---------------------------------------------------------------------------
// Partner: their bills (as buyer or referrer), their points, redemptions and QR codes
// ---------------------------------------------------------------------------

async function partnerBills(db: Tx | typeof prisma, partnerId: string): Promise<Prisma.BillWhereInput> {
  const qrCodes = await db.qRCode.findMany({ where: { partnerId }, select: { id: true } });
  return { OR: [{ qrCodeId: { in: qrCodes.map((q) => q.id) } }, { partnerId }, { referrerPartnerId: partnerId }] };
}

async function requirePartner(db: Tx | typeof prisma, id: string) {
  const partner = await db.partner.findUnique({ where: { id }, select: { id: true } });
  if (!partner) throw new HttpError(404, 'Partner not found', 'PARTNER_NOT_FOUND');
}

export async function partnerDeletionImpact(id: string): Promise<DeletionImpact> {
  await requirePartner(prisma, id);
  const bills = await partnerBills(prisma, id);
  const [billCount, redemptions, pointsEntries] = await Promise.all([
    prisma.bill.count({ where: bills }),
    prisma.pointsRedemption.count({ where: { partnerId: id } }),
    prisma.pointsEntry.count({ where: { OR: [{ bill: bills }, { partnerId: id }] } }),
  ]);
  return { bills: billCount, redemptions, pointsEntries };
}

export async function deletePartner(id: string): Promise<DeletionImpact> {
  return prisma.$transaction(async (tx) => {
    await requirePartner(tx, id);
    const bills = await partnerBills(tx, id);
    // Points entries on these bills go with them (cascade); notifications keep their text.
    const deletedBills = await tx.bill.deleteMany({ where: bills });
    // Points this partner earned on other partners' bills (e.g. as a referred customer).
    const deletedEntries = await tx.pointsEntry.deleteMany({ where: { partnerId: id } });
    const deletedRedemptions = await tx.pointsRedemption.deleteMany({ where: { partnerId: id } });
    // Their mobile stays a known customer on other bills, no longer linked to an account.
    await tx.customer.updateMany({ where: { partnerId: id }, data: { partnerId: null } });
    // QR codes, notifications, push devices and share counts are removed with the partner.
    await tx.partner.delete({ where: { id } });
    return { bills: deletedBills.count, redemptions: deletedRedemptions.count, pointsEntries: deletedEntries.count };
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Outlet: its bills, redemptions and outlet admin logins
// ---------------------------------------------------------------------------

async function requireOutlet(db: Tx | typeof prisma, id: string) {
  const outlet = await db.outlet.findUnique({ where: { id }, select: { id: true } });
  if (!outlet) throw new HttpError(404, 'Outlet not found', 'NOT_FOUND');
}

export async function outletDeletionImpact(id: string): Promise<DeletionImpact> {
  await requireOutlet(prisma, id);
  const [bills, redemptions, pointsEntries, outletAdmins] = await Promise.all([
    prisma.bill.count({ where: { outletId: id } }),
    prisma.pointsRedemption.count({ where: { outletId: id } }),
    prisma.pointsEntry.count({ where: { bill: { outletId: id } } }),
    prisma.outletAdmin.count({ where: { outletId: id } }),
  ]);
  return { bills, redemptions, pointsEntries, outletAdmins };
}

export async function deleteOutlet(id: string): Promise<DeletionImpact> {
  return prisma.$transaction(async (tx) => {
    await requireOutlet(tx, id);
    const entries = await tx.pointsEntry.count({ where: { bill: { outletId: id } } });
    const bills = await tx.bill.deleteMany({ where: { outletId: id } });
    const redemptions = await tx.pointsRedemption.deleteMany({ where: { outletId: id } });
    const admins = await tx.outletAdmin.count({ where: { outletId: id } });
    // Outlet admin logins are removed with the outlet.
    await tx.outlet.delete({ where: { id } });
    return { bills: bills.count, redemptions: redemptions.count, pointsEntries: entries, outletAdmins: admins };
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Transaction (bill)
// ---------------------------------------------------------------------------

/**
 * Gives `points` back to a partner's wallet after a redemption is undone, reversing how they were
 * spent (soonest-expiring first): points that never expire first, then the latest expiry. Entries
 * of the bill being deleted are left out. Returns the points actually given back.
 */
async function unspendWalletPoints(tx: Tx, partnerId: string, points: Prisma.Decimal, excludeBillId: string) {
  const entries = await tx.pointsEntry.findMany({
    where: { partnerId, redeemedPoints: { gt: 0 }, OR: [{ billId: null }, { billId: { not: excludeBillId } }] },
    orderBy: [{ expiresAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
    select: { id: true, redeemedPoints: true },
  });
  let remaining = points;
  for (const entry of entries) {
    if (remaining.lte(0)) break;
    const giveBack = Decimal.min(remaining, entry.redeemedPoints);
    await tx.pointsEntry.update({ where: { id: entry.id }, data: { redeemedPoints: { decrement: giveBack } } });
    remaining = remaining.minus(giveBack);
  }
  return points.minus(remaining);
}

/**
 * Deletes a bill as if it never happened, in one transaction:
 * - points and cash rewards credited on it leave the wallets they went to. A part already spent
 *   (redeemed or sent) is taken from the same wallet's other points instead, as far as the wallet
 *   allows, so the balance returns to what it would have been without this bill;
 * - a wallet redeem paid on it is undone: the redemption is removed and its points go back;
 * - the partners' notifications about it are removed.
 * Outlet history, outlet and panel reports and referral progress are calculated from the bills, so
 * they follow on their own.
 */
export async function deleteBill(id: string): Promise<BillDeletionResult> {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({
      where: { id },
      select: {
        billNumber: true,
        pointEntries: { select: { partnerId: true, redeemedPoints: true } },
        redemption: { select: { id: true, partnerId: true, points: true } },
      },
    });
    if (!bill) throw new HttpError(404, 'Transaction not found', 'NOT_FOUND');

    // Points of this bill already spent, per wallet.
    const spent = new Map<string, Prisma.Decimal>();
    for (const entry of bill.pointEntries) {
      if (!entry.partnerId || entry.redeemedPoints.lte(0)) continue;
      spent.set(entry.partnerId, (spent.get(entry.partnerId) ?? new Decimal(0)).plus(entry.redeemedPoints));
    }
    // Same lock as redemptions and transfers; a fixed order so two deletes cannot deadlock.
    const wallets = [...new Set([...spent.keys(), ...(bill.redemption ? [bill.redemption.partnerId] : [])])].sort();
    for (const partnerId of wallets) await lockWallet(tx, partnerId);

    let refunded = new Decimal(0);
    if (bill.redemption) {
      refunded = await unspendWalletPoints(tx, bill.redemption.partnerId, bill.redemption.points, id);
      await tx.pointsRedemption.delete({ where: { id: bill.redemption.id } });
    }
    const notifications = await tx.notification.deleteMany({ where: { billId: id } });
    // Points entries and cash reward entries on it are removed with it (cascade).
    await tx.bill.delete({ where: { id } });

    let respent = new Decimal(0);
    for (const [partnerId, points] of spent) {
      const take = Decimal.min(points, await availablePoints(tx, partnerId));
      if (take.lte(0)) continue;
      await spendWalletPoints(tx, partnerId, take);
      respent = respent.plus(take);
    }

    return {
      billNumber: bill.billNumber,
      pointsEntries: bill.pointEntries.length,
      refundedPoints: refunded.toNumber(),
      respentPoints: respent.toNumber(),
      notifications: notifications.count,
    };
  }, TX_OPTIONS);
}
