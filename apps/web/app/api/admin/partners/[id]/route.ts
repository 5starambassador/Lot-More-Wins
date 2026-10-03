import { NextRequest } from 'next/server';
import { requireAdmin, requireAdminDelete } from '@/lib/auth';
import { deletePartner } from '@/lib/admin-deletions';
import { getPartnerDetail } from '@/lib/admin-insights';
import { fail, handleRouteError, ok } from '@/lib/api-response';

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
