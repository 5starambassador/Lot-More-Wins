import { NextRequest } from 'next/server';
import { paginationQuerySchema } from '@lotmorewins/validation';
import { requirePartnerId } from '@/lib/auth';
import { listPartnerNotifications } from '@/lib/partner-notifications';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/notifications — the partner's activity feed, newest first. */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await listPartnerNotifications(partnerId, parsed.data.page, parsed.data.limit));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/notifications');
  }
}
