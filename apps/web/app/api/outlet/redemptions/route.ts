import { NextRequest } from 'next/server';
import { redeemSchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { createLegacyRedemption } from '@/lib/redemptions';
import { trySendBillNotification } from '@/lib/bill-notifications';
import { pushBillNotifications } from '@/lib/partner-notifications';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/outlet/redemptions — wallet redemption for Outlet Admin app versions from before redeem
 * bills (v1.0.0). The current app redeems through POST /api/outlet/bills with the redeem QR. The
 * old request (rupees + bill) becomes a redeem bill under the same rules, at most half the bill,
 * and the old receipt shape is returned. A redeem QR works once: a retry replays the receipt.
 */
export async function POST(req: NextRequest) {
  try {
    const { outlet, adminId } = await requireOutletAdmin(req);
    const parsed = redeemSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const { receipt, bill } = await createLegacyRedemption(outlet, adminId, parsed.data);
    if (!receipt.replayed) await Promise.all([trySendBillNotification(bill), pushBillNotifications(bill.id)]);
    return ok(receipt, receipt.replayed ? 200 : 201, receipt.replayed ? 'Points already redeemed' : 'Points redeemed');
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/redemptions');
  }
}
