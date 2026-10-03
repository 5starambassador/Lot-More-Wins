import { NextRequest } from 'next/server';
import { requireAdminDelete } from '@/lib/auth';
import { deleteBill } from '@/lib/admin-deletions';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DELETE /api/admin/transactions/:id — permanently delete a bill and the points credited on it. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminDelete(req, 'transactions');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Transaction not found', 'NOT_FOUND');
    return ok(await deleteBill(id), 200, 'Transaction deleted');
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/admin/transactions/[id]');
  }
}
