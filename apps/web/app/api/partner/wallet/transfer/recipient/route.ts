import { NextRequest } from 'next/server';
import { walletTransferRecipientQuerySchema } from '@lotmorewins/validation';
import { requirePartnerId } from '@/lib/auth';
import { findTransferRecipient } from '@/lib/wallet-transfers';
import { handleRouteError, ok, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/wallet/transfer/recipient?mobile= — the partner registered with this mobile, to confirm before sending. */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = walletTransferRecipientQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await findTransferRecipient(partnerId, parsed.data.mobile));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/wallet/transfer/recipient');
  }
}
