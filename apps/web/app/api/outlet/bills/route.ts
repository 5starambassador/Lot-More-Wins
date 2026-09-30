import { NextRequest } from 'next/server';
import { billCreateSchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { createBill } from '@/lib/billing';
import { trySendBillNotification } from '@/lib/bill-notifications';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/outlet/bills — complete a bill for the authenticated outlet.
 * Idempotent per (outlet, idempotencyKey): a retry returns the original bill with `replayed: true`.
 * Points are credited with the bill; the bill message is sent afterwards and its outcome
 * is returned in `bill.notification` (a messaging failure never fails the bill).
 */
export async function POST(req: NextRequest) {
  try {
    const { outlet, adminId } = await requireOutletAdmin(req);
    const parsed = billCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const result = await createBill(outlet, adminId, parsed.data);
    if (!result.replayed) {
      result.bill = await trySendBillNotification(result.bill);
    }
    return ok(result, result.replayed ? 200 : 201, result.replayed ? 'Bill already completed' : 'Bill completed');
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/bills');
  }
}
