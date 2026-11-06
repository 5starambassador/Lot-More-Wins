import { NextRequest } from 'next/server';
import { paginationQuerySchema } from '@lotmorewins/validation';
import { requireAdmin } from '@/lib/auth';
import { getPartnerReferralHistory } from '@/lib/partner-transactions';
import { fail, handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/partners/:id/referral-history?page&limit — the partner's referral metrics and bills, with guest contacts in full. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, 'partners');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    const parsed = paginationQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await getPartnerReferralHistory(id, parsed.data.page, parsed.data.limit, { revealContacts: true }));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/partners/[id]/referral-history');
  }
}
