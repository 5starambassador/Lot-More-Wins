import { NextRequest } from 'next/server';
import { walletTransferOtpSchema } from '@lotmorewins/validation';
import type { WalletTransferOtpResponse } from '@lotmorewins/types';
import { requirePartnerId } from '@/lib/auth';
import { requestTransferOtp } from '@/lib/wallet-transfers';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
// Sending retries temporary SMTP failures, which can take several seconds.
export const maxDuration = 30;

/**
 * POST /api/partner/wallet/transfer/otp — checks the recipient and balance, then sends the sender
 * a one-time code (on the Super Admin's messaging channel) that confirms the transfer.
 */
export async function POST(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = walletTransferOtpSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const sent: WalletTransferOtpResponse = await requestTransferOtp(partnerId, parsed.data.mobile, parsed.data.points);
    return ok(sent, 200, `Confirmation code sent via ${sent.mode === 'whatsapp' ? 'WhatsApp' : 'email'}`);
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/wallet/transfer/otp');
  }
}
