import { NextRequest } from 'next/server';
import { scanRequestSchema } from '@lotmorewins/validation';
import { HttpError, requireOutletAdmin } from '@/lib/auth';
import { normalizeShortCode } from '@/lib/redemptions';
import { scanQr } from '@/lib/billing';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/outlet/scan — validate a scanned partner QR and return server-resolved partner details. */
export async function POST(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const parsed = scanRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    // A wallet redeem short code typed into an Outlet Admin build that sends it here: those builds
    // take redeem input only when it starts with "LMW-RDM.", so say how to enter it.
    if (normalizeShortCode(parsed.data.qrCode)) {
      throw new HttpError(
        422,
        `This is a wallet redeem code. Enter it as LMW-RDM.${normalizeShortCode(parsed.data.qrCode)}, or update the Outlet Admin app.`,
        'REDEEM_SHORT_CODE'
      );
    }
    return ok(await scanQr(outlet, parsed.data.qrCode));
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/scan');
  }
}
