import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { loadAudienceRows } from '@/lib/push-engine';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/push/audience — every partner with registered referrals, referral QR bills,
 * personal discount bills, redeem bills, last bill and devices. The page filters and groups
 * them; the server applies the same filter again when it sends.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    return ok(await loadAudienceRows());
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/push/audience');
  }
}
