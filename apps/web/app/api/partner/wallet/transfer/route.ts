import { NextRequest } from 'next/server';
import { walletTransferSchema } from '@lotmorewins/validation';
import { requirePartnerId } from '@/lib/auth';
import { sendWalletTransfer } from '@/lib/wallet-transfers';
import { pushNotification } from '@/lib/partner-notifications';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/wallet/transfer — send points to another partner's wallet, confirmed with the
 * code from POST /api/partner/wallet/transfer/otp. Idempotent per idempotencyKey.
 */
export async function POST(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = walletTransferSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const { result, notifications } = await sendWalletTransfer(partnerId, parsed.data);
    await Promise.all(notifications.map(pushNotification));
    return ok(result, result.replayed ? 200 : 201, result.replayed ? 'Transfer already sent' : 'Transfer sent');
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/wallet/transfer');
  }
}
