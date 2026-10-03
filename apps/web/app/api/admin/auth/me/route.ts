import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/auth/me — the signed-in panel account with its role, pages and delete permission. */
export async function GET(req: NextRequest) {
  try {
    return ok({ admin: await requireAdmin(req) });
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/auth/me');
  }
}
