import { NextRequest } from 'next/server';
import { adminTransactionListQuerySchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { listTransactions } from '@/lib/admin-insights';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/transactions — every bill across outlets, filterable, with totals for the filter. */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const parsed = adminTransactionListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const { page, limit } = parsed.data;

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
