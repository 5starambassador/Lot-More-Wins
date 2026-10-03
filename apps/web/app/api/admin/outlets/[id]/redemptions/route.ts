import { NextRequest } from 'next/server';
import { adminOutletRedemptionsQuerySchema } from '@lotmorewins/validation';
import type { AdminOutletRedemptionsPage } from '@lotmorewins/types';
import { requireAdmin } from '@/lib/auth';
import { outletRedemptions, outletRedemptionsCsv } from '@/lib/admin-insights';
import { csvResponse } from '@/lib/admin-csv';
import { fail, handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/outlets/:id/redemptions?page&limit&from&to — wallet redemptions made at the
 * outlet, with totals for the date filter. `format=csv` downloads every matching row.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, 'outlets');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Outlet not found', 'NOT_FOUND');
    const parsed = adminOutletRedemptionsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);

    if (parsed.data.format === 'csv') {
      const { name, csv } = await outletRedemptionsCsv(id, parsed.data);
      return csvResponse(name, csv);
    }
    const { page, limit } = parsed.data;
    const { redemptions, total, summary } = await outletRedemptions(id, parsed.data);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data: AdminOutletRedemptionsPage = {
      redemptions,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
      summary,
    };
    return ok(data);
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/outlets/[id]/redemptions');
  }
}
