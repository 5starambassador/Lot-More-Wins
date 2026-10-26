import { NextRequest } from 'next/server';
import { partnerTransactionsQuerySchema } from '@lotmorewins/validation';
import { requirePartnerId } from '@/lib/auth';
import { listPartnerTransactions } from '@/lib/partner-transactions';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/transactions?type=&from=&to=&limit= — the wallet page history, newest first. */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = partnerTransactionsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await listPartnerTransactions(partnerId, parsed.data));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/transactions');
  }
}
