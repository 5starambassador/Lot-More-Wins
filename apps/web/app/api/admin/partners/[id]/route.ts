import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getPartnerDetail } from '@/lib/admin-insights';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/partners/:id — partner profile, QR codes, wallet and recent bills. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(req);
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    return ok(await getPartnerDetail(id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/partners/[id]');
  }
}
