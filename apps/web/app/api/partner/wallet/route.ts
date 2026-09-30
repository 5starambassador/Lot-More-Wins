import { NextRequest } from 'next/server';
import { requirePartnerId } from '@/lib/auth';
import { getPartnerWallet } from '@/lib/points';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/wallet — points balance, rupee value (current settings ratio) and recent ledger entries. */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    return ok(await getPartnerWallet(partnerId));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/wallet');
  }
}
