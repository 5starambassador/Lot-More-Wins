import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { partnerLoginSchema, partnerPasswordLoginSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { HttpError } from '@/lib/auth';
import { activeQrInclude, partnerSession } from '@/lib/partners';
import { consumePartnerOtp, reviewLoginOtp } from '@/lib/partner-otp';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';
import {
  RATE_LIMIT_RETRY_AFTER_SEC,
  assertLoginAllowed,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
} from '@/lib/login-rate-limit';

export const dynamic = 'force-dynamic';

// Compared against when the account is unknown so response time does not reveal registered partners.
const DUMMY_HASH = bcrypt.hashSync('lmw-timing-equalizer', 10);

type Identifier = { kind: 'email' | 'mobile'; value: string };

function findPartner(identifier: Identifier) {
  return prisma.partner.findUnique({
    where: identifier.kind === 'email' ? { email: identifier.value } : { mobile: identifier.value },
    include: activeQrInclude,
  });
}

/**
 * POST /api/partner/auth/login — partner sign-in. Returns the same session payload as onboarding
 * (profile, permanent QR codes, a token that never expires).
 * - The current app: the registered mobile number or email and the one-time code from
 *   POST /api/partner/auth/otp (step 2 of code sign-in).
 * - App versions from before code sign-in (v1.0.0, still installed as APKs): the mobile number or
 *   email and the password set at registration. Partners who registered without a password (the
 *   current app) hold an unusable random one, so they can only sign in with a code.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const ip = clientIp(req);
    let partner: Awaited<ReturnType<typeof findPartner>>;
    let identifier: Identifier;

    if (body && typeof body === 'object' && 'password' in body && !('otp' in body)) {
      const parsed = partnerPasswordLoginSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      identifier = parsed.data.identifier;
      await assertLoginAllowed('partner', identifier.value, ip);

      partner = await findPartner(identifier);
      const valid = bcrypt.compareSync(parsed.data.password, partner?.passwordHash ?? DUMMY_HASH);
      if (!partner || !valid) {
        await recordLoginFailure('partner', identifier.value, ip);
        return fail(401, 'Incorrect mobile number, email or password', 'INVALID_CREDENTIALS');
      }
    } else {
      const parsed = partnerLoginSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      identifier = parsed.data.identifier;
      // The app store review account signs in with its fixed code, free of the lockout (see reviewLoginOtp).
      const reviewOtp = identifier.kind === 'email' ? reviewLoginOtp(identifier.value) : null;
      if (!reviewOtp) await assertLoginAllowed('partner', identifier.value, ip);

      partner = await findPartner(identifier);
      if (!partner) {
        if (!reviewOtp) await recordLoginFailure('partner', identifier.value, ip);
        return fail(400, 'This code is not valid. Please request a new one.', 'OTP_INVALID');
      }
      if (reviewOtp) {
        if (parsed.data.otp !== reviewOtp) {
          return fail(400, 'Incorrect code. Please check it and try again.', 'OTP_INVALID');
        }
      } else {
        try {
          await consumePartnerOtp(partner.id, 'login', parsed.data.otp);
        } catch (error) {
          if (error instanceof HttpError && error.code === 'OTP_INVALID') await recordLoginFailure('partner', identifier.value, ip);
          throw error;
        }
      }
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
