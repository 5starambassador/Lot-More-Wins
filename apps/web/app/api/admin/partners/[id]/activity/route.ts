import { NextRequest } from 'next/server';
import { adminPartnerActivityQuerySchema } from '@lotmorewins/validation';
import type { AdminPartnerActivityPage } from '@lotmorewins/types';
import { requireAdmin } from '@/lib/auth';
import { partnerActivity, partnerActivityCsv } from '@/lib/admin-insights';
import { csvResponse } from '@/lib/admin-csv';
import { fail, handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/partners/:id/activity?page&limit&from&to&outletId&kind — the partner's activity
 * log (own purchases, successful referrals, redemptions, referral QR shares) with totals for
 * the date / outlet filter. `format=csv` downloads every matching row.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, 'partners');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    const parsed = adminPartnerActivityQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);

    if (parsed.data.format === 'csv') {
      const { name, csv } = await partnerActivityCsv(id, parsed.data);
      return csvResponse(name, csv);
    }
    const { page, limit } = parsed.data;
    const { rows, total, summary } = await partnerActivity(id, parsed.data);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data: AdminPartnerActivityPage = {
      rows,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
      summary,
    };
    return ok(data);
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/partners/[id]/activity');
  }
}
