import { NextRequest } from 'next/server';
import { paginationQuerySchema } from '@lotmorewins/validation';
import { requirePartnerId } from '@/lib/auth';
import { getPartnerReferralHistory } from '@/lib/partner-transactions';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/referral-history?page=&limit= — totals and the bills closed with the partner's referral QR. */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await getPartnerReferralHistory(partnerId, parsed.data.page, parsed.data.limit));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/referral-history');
  }
}
