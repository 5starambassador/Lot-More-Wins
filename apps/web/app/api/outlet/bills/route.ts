import { NextRequest } from 'next/server';
import { billCreateSchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { createBill } from '@/lib/billing';
import { trySendBillNotification } from '@/lib/bill-notifications';
import { pushBillNotifications } from '@/lib/partner-notifications';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/outlet/bills — complete a bill for the authenticated outlet.
 * Idempotent per (outlet, idempotencyKey): a retry returns the original bill with `replayed: true`.
 * Points are credited with the bill; the bill message and the partners' push notifications
 * are sent afterwards. The message outcome is returned in `bill.notification` (a messaging
 * or push failure never fails the bill).
 */
export async function POST(req: NextRequest) {
  try {
    const { outlet, adminId } = await requireOutletAdmin(req);
    const parsed = billCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const result = await createBill(outlet, adminId, parsed.data);
    if (!result.replayed) {
      const [bill] = await Promise.all([trySendBillNotification(result.bill), pushBillNotifications(result.bill.id)]);
      result.bill = bill;
    }
    return ok(result, result.replayed ? 200 : 201, result.replayed ? 'Bill already completed' : 'Bill completed');
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/bills');
  }
}
