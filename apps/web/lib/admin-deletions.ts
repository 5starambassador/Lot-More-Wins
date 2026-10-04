import type { Prisma } from '@prisma/client';
import type { AdminResetResult, DeletionImpact } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';

/**
 * Permanent deletes from the web panel. Partners, outlets and bills are linked (bills use a
 * partner's QR codes, points are earned on bills, redemptions happen at outlets), so each
 * delete also removes what cannot exist without it, inside one transaction: it either all
 * happens or nothing does. The panel shows the impact first and asks for confirmation.
 *
 * Deleting a bill takes its points out of the wallets they were credited to (only the part not
 * yet redeemed is still counted anywhere). Deleting a redemption does not give the points back.
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
// Reset: every partner, guest customer, transaction and QR code
// ---------------------------------------------------------------------------

/**
 * The dashboard's "Reset". Removes all partners with their QR codes, wallets (points and
 * redemptions), notifications, push devices and QR shares, all guest customers and all bills.
 * Outlets, outlet admins, panel accounts, settings and media are not touched.
 */
export async function resetProgrammeData(): Promise<AdminResetResult> {
  return prisma.$transaction(async (tx) => {
    // Children before the rows they reference.
    await tx.notification.deleteMany();
    await tx.pointsEntry.deleteMany();
    const redemptions = await tx.pointsRedemption.deleteMany();
    const bills = await tx.bill.deleteMany();
    const customers = await tx.customer.deleteMany();
    await tx.referralShare.deleteMany();
    await tx.pushDevice.deleteMany();
    const qrCodes = await tx.qRCode.deleteMany();
    const partners = await tx.partner.deleteMany();
    return { partners: partners.count, customers: customers.count, bills: bills.count, qrCodes: qrCodes.count, redemptions: redemptions.count };
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Transaction (bill)
// ---------------------------------------------------------------------------

export async function deleteBill(id: string): Promise<{ billNumber: string; pointsEntries: number }> {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id }, select: { billNumber: true, _count: { select: { pointEntries: true } } } });
    if (!bill) throw new HttpError(404, 'Transaction not found', 'NOT_FOUND');
    // Its points entries are removed with it; notifications about it keep their text.
    await tx.bill.delete({ where: { id } });
    return { billNumber: bill.billNumber, pointsEntries: bill._count.pointEntries };
  }, TX_OPTIONS);
}
