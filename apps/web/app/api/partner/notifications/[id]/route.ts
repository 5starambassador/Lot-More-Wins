import { NextRequest } from 'next/server';
import { requirePartnerId } from '@/lib/auth';
import { getPartnerNotification } from '@/lib/partner-notifications';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/notifications/:id — one of the partner's notifications, with its full message. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const partnerId = requirePartnerId(req);
    const { id } = await params;
    return ok(await getPartnerNotification(partnerId, id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/notifications/:id');
  }
}
