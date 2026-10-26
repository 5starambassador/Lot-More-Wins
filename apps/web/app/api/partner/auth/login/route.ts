import { NextRequest } from 'next/server';
import { partnerLoginSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { HttpError } from '@/lib/auth';
import { activeQrInclude, partnerSession } from '@/lib/partners';
import { consumePartnerOtp } from '@/lib/partner-otp';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';
import {
  RATE_LIMIT_RETRY_AFTER_SEC,
  assertLoginAllowed,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
} from '@/lib/login-rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/auth/login — partner sign-in, step 2: the registered mobile number or email
 * and the one-time code from POST /api/partner/auth/otp. There is no password sign-in. Returns
 * the same session payload as onboarding (profile, permanent QR codes, a token that never expires).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    // App versions from before code sign-in send a password and no code.
    if (body && typeof body === 'object' && 'password' in body && !('otp' in body)) {
      return fail(
        426,
        'Password sign-in has been replaced by a one-time code. Please update the Lot More Wins app to sign in.',
        'APP_UPDATE_REQUIRED'
      );
    }
    const parsed = partnerLoginSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { identifier, otp } = parsed.data;

    const ip = clientIp(req);
    await assertLoginAllowed('partner', identifier.value, ip);

    const partner = await prisma.partner.findUnique({
      where: identifier.kind === 'email' ? { email: identifier.value } : { mobile: identifier.value },
      include: activeQrInclude,
    });
    if (!partner) {
      await recordLoginFailure('partner', identifier.value, ip);
      return fail(400, 'This code is not valid. Please request a new one.', 'OTP_INVALID');
    }

    try {
      await consumePartnerOtp(partner.id, 'login', otp);
    } catch (error) {
      if (error instanceof HttpError && error.code === 'OTP_INVALID') await recordLoginFailure('partner', identifier.value, ip);
      throw error;
    }
    await clearLoginFailures('partner', identifier.value, ip);

    if (partner.status !== 'ACTIVE') {
      return fail(403, 'This partner account is not active. Please contact support.', 'PARTNER_INACTIVE');
    }

    return ok(partnerSession(partner), 200, 'Signed in');
  } catch (error) {
    if (error instanceof HttpError && error.code === 'RATE_LIMITED') {
      const res = fail(429, error.message, error.code);
      res.headers.set('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SEC));
      return res;
    }
    return handleRouteError(error, 'POST /api/partner/auth/login');
  }
}
