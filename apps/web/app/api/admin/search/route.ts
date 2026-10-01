import { NextRequest } from 'next/server';
import { adminSearchQuerySchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { adminSearch } from '@/lib/admin-insights';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/search?q — partners and outlets matching one query, for the dashboard search bar. */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const parsed = adminSearchQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await adminSearch(parsed.data.q));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/search');
  }
}
