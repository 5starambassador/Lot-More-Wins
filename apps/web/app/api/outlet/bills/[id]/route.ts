import { NextRequest } from 'next/server';
import { requireOutletAdmin } from '@/lib/auth';
import { getOutletBill, serializeBill } from '@/lib/billing';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/outlet/bills/[id] — one bill of the authenticated outlet. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const { id } = await params;
    return ok(serializeBill(await getOutletBill(outlet.id, id)));
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlet/bills/[id]');
  }
}
