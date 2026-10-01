import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { dashboardCsv, getDashboard } from '@/lib/admin-insights';
import { csvResponse } from '@/lib/admin-csv';
import { adminDashboardQuerySchema } from '@lotmorewins/validation';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/dashboard?from&to — read-only programme overview for the Super Admin.
 * The period (IST days, inclusive; default last 30 days) drives the totals, trend and rankings.
 * `format=csv` downloads the headline figures and the trend table for the period.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const parsed = adminDashboardQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.format === 'csv') return csvResponse('dashboard', await dashboardCsv(parsed.data));
    return ok(await getDashboard(parsed.data));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/dashboard');
  }
}
