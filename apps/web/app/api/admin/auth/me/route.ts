import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/auth/me — the signed-in Super Admin. */
export async function GET(req: NextRequest) {
  try {
    return ok({ admin: await requireSuperAdmin(req) });
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/auth/me');
  }
}
