import { NextRequest } from 'next/server';
import { paginationQuerySchema } from '@lotmorewins/validation';
import { requireAdmin } from '@/lib/auth';
import { getDiwaliLeaderboard } from '@/lib/diwali-leaderboard';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/diwali-leaderboard?page&limit — partners ranked by the total value of their referral bills. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, 'partners');
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await getDiwaliLeaderboard(parsed.data.page, parsed.data.limit));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/diwali-leaderboard');
  }
}
