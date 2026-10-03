import { NextRequest } from 'next/server';
import { adminAccountCreateSchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminAccount, listAdminAccounts } from '@/lib/admin-accounts';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/admins — every panel account (Super Admin only). */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    return ok(await listAdminAccounts());
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/admins');
  }
}

/** POST /api/admin/admins — add an admin with its pages and delete permission (Super Admin only). */
export async function POST(req: NextRequest) {
  try {
    const superAdmin = await requireSuperAdmin(req);
    const parsed = adminAccountCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await createAdminAccount(parsed.data, superAdmin.id), 201, 'Admin added');
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/admins');
  }
}
