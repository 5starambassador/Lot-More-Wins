import { NextRequest } from 'next/server';
import { paginationQuerySchema } from '@lotmorewins/validation';
import { requireAdmin } from '@/lib/auth';
import { getDiwaliLeaderboard, getDiwaliRegistrationLeaderboard } from '@/lib/diwali-leaderboard';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diwali-leaderboard?page&limit — partners ranked by the total value of their referral bills.
 * With board=registrations, ranked by how many partners registered naming them as "Referred by".
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, 'partners');
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const { page, limit } = parsed.data;
    if (req.nextUrl.searchParams.get('board') === 'registrations') return ok(await getDiwaliRegistrationLeaderboard(page, limit));
    return ok(await getDiwaliLeaderboard(page, limit));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/diwali-leaderboard');
  }
}
