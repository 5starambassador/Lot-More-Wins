import { NextRequest } from 'next/server';
import { requirePartnerId } from '@/lib/auth';
import { getPartnerTransaction } from '@/lib/partner-transactions';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/transactions/:id — one transaction for its details page (id as listed, e.g. bill_<uuid>). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const partnerId = requirePartnerId(req);
    const { id } = await params;
    return ok(await getPartnerTransaction(partnerId, decodeURIComponent(id)));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/transactions/[id]');
  }
}
