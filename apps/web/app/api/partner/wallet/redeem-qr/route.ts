import { NextRequest } from 'next/server';
import { requirePartnerId } from '@/lib/auth';
import { createRedeemQr } from '@/lib/redemptions';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/wallet/redeem-qr — a new short-lived, single-use redeem QR with the
 * partner's details and the current worth of their points. Scanned in the Outlet Admin app.
 */
export async function POST(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    return ok(await createRedeemQr(partnerId), 201);
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/wallet/redeem-qr');
  }
}
