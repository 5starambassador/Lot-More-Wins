import { NextRequest } from 'next/server';
import { adminTransactionListQuerySchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { listTransactions, transactionsCsv } from '@/lib/admin-insights';
import { csvResponse } from '@/lib/admin-csv';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/transactions — every bill across outlets, filterable (search, outlet, partner,
 * type, message status, range preset and/or from–to dates), with totals for the filter.
 * `format=csv` downloads every matching bill.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const parsed = adminTransactionListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const { page, limit } = parsed.data;
    if (parsed.data.format === 'csv') return csvResponse('transactions', await transactionsCsv(parsed.data));

    const { total, bills, summary } = await listTransactions(parsed.data);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return ok({
      bills,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
      summary,
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/transactions');
  }
}
