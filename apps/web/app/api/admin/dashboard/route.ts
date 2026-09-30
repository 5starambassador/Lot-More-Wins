import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDashboard } from '@/lib/admin-insights';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/dashboard — read-only programme overview for the Super Admin. */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    return ok(await getDashboard());
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/dashboard');
  }
}
