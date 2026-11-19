import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { deleteRun } from '@/lib/push-engine';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/admin/push/runs/:id — removes one send from the history (delivered pushes stay delivered). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await requireSuperAdmin(req);
    await deleteRun((await params).id);
    return ok({ deleted: true }, 200, 'Removed from the history');
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/admin/push/runs/:id');
  }
}
