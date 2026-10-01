import { NextRequest } from 'next/server';
import { redeemSchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { redeemPoints } from '@/lib/redemptions';
import { pushNotification } from '@/lib/partner-notifications';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/outlet/redemptions — spend points from a partner's wallet at the authenticated outlet.
 * The rupee amount is converted to points with the Super Admin ratio and taken from the
 * soonest-expiring points. A redeem QR works once: a retry returns the original redemption
 * with `replayed: true`.
 */
export async function POST(req: NextRequest) {
  try {
    const { outlet, adminId } = await requireOutletAdmin(req);
    const parsed = redeemSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const { receipt, notification } = await redeemPoints(outlet, adminId, parsed.data);
    if (notification) await pushNotification(notification);
    return ok(receipt, receipt.replayed ? 200 : 201, receipt.replayed ? 'Points already redeemed' : 'Points redeemed');
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/redemptions');
  }
}
