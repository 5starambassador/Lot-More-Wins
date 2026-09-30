import { NextRequest } from 'next/server';
import { billPreviewSchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { previewBill } from '@/lib/billing';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/outlet/bills/preview — server-calculated discount and final amount; persists nothing. */
export async function POST(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const parsed = billPreviewSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await previewBill(outlet, parsed.data));
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/bills/preview');
  }
}
