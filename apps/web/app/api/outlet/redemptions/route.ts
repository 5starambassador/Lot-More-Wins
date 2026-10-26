import { fail } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/outlet/redemptions — retired. Redeeming used to take any amount up to the bill; a redeem
 * QR is now part of a bill (POST /api/outlet/bills/preview and /api/outlet/bills with the redeem QR),
 * which takes at most half the bill. Outlet Admin app versions from before that get this message.
 */
export async function POST() {
  return fail(
    426,
    'Wallet redemption has moved into billing. Please update the Lot More Wins Outlet app to redeem.',
    'APP_UPDATE_REQUIRED'
  );
}
