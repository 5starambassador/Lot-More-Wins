import { NextRequest } from 'next/server';
import { requireAdmin, requireAdminDelete } from '@/lib/auth';
import { deletePartner } from '@/lib/admin-deletions';
import { adminPartnerUpdateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { getPartnerDetail } from '@/lib/admin-insights';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/partners/:id — partner profile, QR codes, wallet and recent bills. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, 'partners');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    return ok(await getPartnerDetail(id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/partners/[id]');
  }
}

/**
 * PATCH /api/admin/partners/:id — activate / deactivate (status) or classify (category: Achariya /
 * Non-Achariya). Bills already made keep the classification they were calculated with.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, 'partners');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    const parsed = adminPartnerUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const updated = await prisma.partner.updateMany({
      where: { id },
      data: parsed.data,
    });
    if (updated.count === 0) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    return ok(await getPartnerDetail(id), 200, 'Partner updated');
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/admin/partners/[id]');
  }
}

/** DELETE /api/admin/partners/:id — permanently delete the partner with their transactions, points and redemptions. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminDelete(req, 'partners');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    return ok(await deletePartner(id), 200, 'Partner deleted');
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/admin/partners/[id]');
  }
}
