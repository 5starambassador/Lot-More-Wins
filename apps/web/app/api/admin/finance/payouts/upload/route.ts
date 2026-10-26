import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listPayoutUploads } from '@/lib/finance';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET /api/admin/finance/payouts/upload — payout sheets applied so far: who uploaded which file and what it changed. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, 'finance');
    return ok(await listPayoutUploads());
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/finance/payouts/upload');
  }
}

/**
 * POST /api/admin/finance/payouts/upload — retired. UPI payouts ended when the cash reward wallet
 * merged into the one wallet (pending payouts were cancelled and their amount moved into the
 * wallet), so there is nothing left to settle.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req, 'finance');
    return fail(410, 'UPI payouts have ended; there are no payouts to settle.', 'PAYOUTS_ENDED');
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/finance/payouts/upload');
  }
}
