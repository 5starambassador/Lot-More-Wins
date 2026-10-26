import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listOfferChanges } from '@/lib/outlet-offers';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/outlets/:id/offer-changes — audit log of the outlet's offer settings, newest first. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, 'outlets');
    const { id } = await params;
    return ok(await listOfferChanges(id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/outlets/:id/offer-changes');
  }
}
