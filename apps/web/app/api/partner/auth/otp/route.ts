import { NextRequest } from 'next/server';
import { partnerLoginOtpRequestSchema } from '@lotmorewins/validation';
import type { PartnerLoginOtpResponse } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { sendPartnerOtp } from '@/lib/partner-otp';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
// Sending retries temporary SMTP failures, which can take several seconds.
export const maxDuration = 30;

/**
 * POST /api/partner/auth/otp — partner sign-in, step 1. Looks up the partner by registered
 * mobile number or email and sends a 6-digit code on the channel the Super Admin chose in
 * Settings: email goes to the partner's registered email, WhatsApp to their registered mobile,
 * whichever of the two the partner typed.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = partnerLoginOtpRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { kind, value } = parsed.data.identifier;

    const partner = await prisma.partner.findUnique({ where: kind === 'email' ? { email: value } : { mobile: value } });
    if (!partner) {
      return fail(
        404,
        `No partner account uses this ${kind === 'email' ? 'email address' : 'mobile number'}. Check it, or become a partner.`,
        'PARTNER_NOT_FOUND'
      );
    }
    if (partner.status !== 'ACTIVE') {
      return fail(403, 'This partner account is not active. Please contact support.', 'PARTNER_INACTIVE');
    }

    const sent: PartnerLoginOtpResponse = await sendPartnerOtp(partner, 'login');
    return ok(sent, 200, `Sign-in code sent via ${sent.mode === 'whatsapp' ? 'WhatsApp' : 'email'}`);
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/auth/otp');
  }
}
