import { NextRequest } from 'next/server';
import { requirePartnerId } from '@/lib/auth';
import { getPartnerHome } from '@/lib/partners';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/home — referral progress, current offers and unread notification count. */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    return ok(await getPartnerHome(partnerId));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/home');
  }
}
