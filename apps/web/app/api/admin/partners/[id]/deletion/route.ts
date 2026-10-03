import { NextRequest } from 'next/server';
import { requireAdminDelete } from '@/lib/auth';
import { partnerDeletionImpact } from '@/lib/admin-deletions';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/partners/:id/deletion — what deleting this partner would also remove. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminDelete(req, 'partners');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    return ok(await partnerDeletionImpact(id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/partners/[id]/deletion');
  }
}
