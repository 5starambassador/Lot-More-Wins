import { NextRequest, NextResponse } from 'next/server';
import { billHistoryQuerySchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { listOutletBills } from '@/lib/billing';
import { handleRouteError, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/outlet/transactions?range=today|all — billing history of the authenticated outlet only. */
export async function GET(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const parsed = billHistoryQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const { page, limit, range } = parsed.data;

    const { total, bills, summary } = await listOutletBills(outlet.id, page, limit, range);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      data: bills,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1, range, summary },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlet/transactions');
  }
}
