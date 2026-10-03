import { NextRequest } from 'next/server';
import { requireAdminDelete } from '@/lib/auth';
import { outletDeletionImpact } from '@/lib/admin-deletions';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/outlets/:id/deletion — what deleting this outlet would also remove. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminDelete(req, 'outlets');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Outlet not found', 'NOT_FOUND');
    return ok(await outletDeletionImpact(id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/outlets/[id]/deletion');
  }
}
