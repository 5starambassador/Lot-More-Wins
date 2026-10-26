import { NextRequest } from 'next/server';
import { requirePartnerId } from '@/lib/auth';
import { getPartnerWallet } from '@/lib/points';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/payouts — retired. UPI payouts ended when the cash reward wallet merged into the
 * one wallet; cash rewards are spent in the app with the redeem QR. App versions from before that
 * get the (empty) retired cash wallet.
 */
export async function GET(req: NextRequest) {
  try {
    return ok((await getPartnerWallet(requirePartnerId(req), 1)).cash);
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/payouts');
  }
}

/** POST /api/partner/payouts — retired: there are no UPI payouts any more. */
export async function POST() {
  return fail(
    410,
    'UPI payouts have ended. Your cashback is in your wallet: use the redeem QR to pay part of a bill at any outlet.',
    'PAYOUTS_ENDED'
  );
}
