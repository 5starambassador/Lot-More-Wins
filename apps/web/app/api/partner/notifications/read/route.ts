import { NextRequest } from 'next/server';
import { requirePartnerId } from '@/lib/auth';
import { markPartnerNotificationsRead } from '@/lib/partner-notifications';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/partner/notifications/read — mark every notification of the partner as read. */
export async function POST(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    return ok({ updated: await markPartnerNotificationsRead(partnerId) });
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/notifications/read');
  }
}
