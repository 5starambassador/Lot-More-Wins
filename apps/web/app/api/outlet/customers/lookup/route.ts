import { NextRequest } from 'next/server';
import { customerLookupQuerySchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { assertOutletCanTransact, lookupCustomer } from '@/lib/billing';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/outlet/customers/lookup?mobile= — prefill for the referral customer form (null when unknown). */
export async function GET(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    assertOutletCanTransact(outlet);
    const parsed = customerLookupQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await lookupCustomer(parsed.data.mobile));
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlet/customers/lookup');
  }
}
