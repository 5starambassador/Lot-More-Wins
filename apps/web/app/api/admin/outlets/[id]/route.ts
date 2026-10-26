import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { outletUpdateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requireAdmin, requireAdminDelete } from '@/lib/auth';
import { deleteOutlet } from '@/lib/admin-deletions';
import { adminOutletInclude, serializeAdminOutlet } from '@/lib/outlets';
import { applyOfferChanges, pickOfferFields } from '@/lib/outlet-offers';
import { getProgramSettings } from '@/lib/settings';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/outlets/:id */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin(req, 'outlets');
    const { id } = await params;
    const outlet = await prisma.outlet.findUnique({
      where: { id },
      include: adminOutletInclude,
    });
    if (!outlet) return fail(404, 'Outlet not found', 'NOT_FOUND');
    return ok(serializeAdminOutlet(outlet, await getProgramSettings()));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/outlets/:id');
  }
}

/**
 * PATCH /api/admin/outlets/:id — update details and offers (discounts, GST, cash reward, Outlet
 * Admin editing), activate/deactivate, or reset the admin password. Offer changes are audit-logged.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(req, 'outlets');
    const { id } = await params;
    const parsed = outletUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const {
      adminPassword,
      firstTimeDiscount,
      achariyaFirstTimeDiscount,
      repeatDiscount,
      referralDiscount,
      gstPercentage,
      purchasePointsPercentage,
      referralPointsPercentage,
      achariyaReferralPointsPercentage,
      cashRewardPurchasePercentage,
      cashRewardReferralPercentage,
      givesCashReward,
      canEditOffers,
      ...fields
    } = parsed.data;
    const offers = pickOfferFields({
      firstTimeDiscount,
      achariyaFirstTimeDiscount,
      repeatDiscount,
      referralDiscount,
      gstPercentage,
      purchasePointsPercentage,
      referralPointsPercentage,
      achariyaReferralPointsPercentage,
      cashRewardPurchasePercentage,
      cashRewardReferralPercentage,
      givesCashReward,
      canEditOffers,
    });

    const existing = await prisma.outlet.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return fail(404, 'Outlet not found', 'NOT_FOUND');

    const outlet = await prisma.$transaction(
      async (tx) => {
        if (adminPassword) {
          await tx.outletAdmin.updateMany({
            where: { outletId: id },
            data: { passwordHash: bcrypt.hashSync(adminPassword, 10) },
          });
        }
        await applyOfferChanges(tx, id, offers, {
          type: 'SUPER_ADMIN',
          id: admin.id,
          email: admin.email,
        });
        return tx.outlet.update({
          where: { id },
          data: fields,
          include: adminOutletInclude,
        });
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
    return ok(serializeAdminOutlet(outlet, await getProgramSettings()), 200, 'Outlet updated');
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/admin/outlets/:id');
  }
}

/** DELETE /api/admin/outlets/:id — permanently delete the outlet with its bills, redemptions and admin login. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAdminDelete(req, 'outlets');
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail(404, 'Outlet not found', 'NOT_FOUND');
    return ok(await deleteOutlet(id), 200, 'Outlet deleted');
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/admin/outlets/:id');
  }
}
