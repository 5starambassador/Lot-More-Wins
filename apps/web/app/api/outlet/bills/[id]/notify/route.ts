import { NextRequest } from 'next/server';
import { requireOutletAdmin } from '@/lib/auth';
import { getOutletBill } from '@/lib/billing';
import { sendBillNotification } from '@/lib/bill-notifications';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/outlet/bills/[id]/notify — resend the bill message using the current messaging mode. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const { id } = await params;
    const bill = await getOutletBill(outlet.id, id);
    const updated = await sendBillNotification(bill.id);
    return ok(updated, 200, updated.notification.status === 'SENT' ? 'Message sent' : 'Message not sent');
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/bills/[id]/notify');
  }
}
