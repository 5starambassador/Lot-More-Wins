import { NextRequest } from 'next/server';
import { redeemQrCreateSchema } from '@lotmorewins/validation';
import { HttpError, requirePartnerId } from '@/lib/auth';
import { createRedeemQr } from '@/lib/redemptions';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/wallet/redeem-qr — a new short-lived, single-use redeem QR with the
 * partner's details and the current worth of their points. Scanned in the Outlet Admin app.
 * Body { outletId } makes it work at that outlet only; older apps send no body (any outlet).
 */
export async function POST(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const text = await req.text();
    let body: unknown = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new HttpError(400, 'Request body must be valid JSON', 'INVALID_JSON');
      }
    }
    const parsed = redeemQrCreateSchema.safeParse(body ?? {});
    if (!parsed.success) return validationError(parsed.error);
    return ok(await createRedeemQr(partnerId, parsed.data.outletId), 201);
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/wallet/redeem-qr');
  }
}
