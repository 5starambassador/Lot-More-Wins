import { NextRequest } from 'next/server';
import { redeemScanSchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { scanRedeemQr } from '@/lib/redemptions';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/outlet/redemptions/scan — validate a partner's redeem QR and return their live wallet balance. */
export async function POST(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const parsed = redeemScanSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await scanRedeemQr(outlet, parsed.data.qrCode));
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/redemptions/scan');
  }
}
