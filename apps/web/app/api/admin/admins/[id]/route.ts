import { NextRequest } from 'next/server';
import { adminAccountUpdateSchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { deleteAdminAccount, updateAdminAccount } from '@/lib/admin-accounts';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admin/admins/:id — change an admin's details, pages, permissions, status or password. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireSuperAdmin(req);
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Admin not found', 'NOT_FOUND');
    const parsed = adminAccountUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await updateAdminAccount(id, parsed.data), 200, 'Admin updated');
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/admin/admins/:id');
  }
}

/** DELETE /api/admin/admins/:id — remove an admin account; it can no longer sign in. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const superAdmin = await requireSuperAdmin(req);
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Admin not found', 'NOT_FOUND');
    await deleteAdminAccount(id, superAdmin.id);
    return ok({ deleted: true }, 200, 'Admin deleted');
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/admin/admins/:id');
  }
}
