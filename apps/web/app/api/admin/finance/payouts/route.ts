import { NextRequest, NextResponse } from 'next/server';
import { financeReportQuerySchema } from '@lotmorewins/validation';
import { requireAdmin } from '@/lib/auth';
import { financeWorkbook, getFinanceReport } from '@/lib/finance';
import { csvDateTime } from '@/lib/admin-csv';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/payouts?search&partnerId&status&from&to&page&limit — wallet totals,
 * per-partner balances and payouts (requested in the date range). `format=xlsx` downloads the
 * payout sheet (Payouts + Wallets) for the same filter.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, 'finance');
    const parsed = financeReportQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.format === 'xlsx') {
      const file = await financeWorkbook(parsed.data);
      return new NextResponse(new Uint8Array(file), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="payouts-${csvDateTime(new Date()).slice(0, 10)}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return ok(await getFinanceReport(parsed.data));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/finance/payouts');
  }
}
