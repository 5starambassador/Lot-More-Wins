import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { partnerLoginSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { HttpError } from '@/lib/auth';
import { activeQrInclude, partnerSession } from '@/lib/partners';
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

/**
 * POST /api/partner/auth/login — partner sign-in with the registered mobile number or email
 * and password. Returns the same session payload as onboarding (profile, permanent QR codes, token).
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = partnerLoginSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { kind, value, password } = parsed.data;

    const ip = clientIp(req);
    await assertLoginAllowed('partner', value, ip);

    const partner = await prisma.partner.findUnique({
      where: kind === 'email' ? { email: value } : { mobile: value },
      include: activeQrInclude,
    });
    const valid = bcrypt.compareSync(password, partner?.passwordHash ?? DUMMY_HASH);
    if (!partner || !valid) {
      await recordLoginFailure('partner', value, ip);
      return fail(401, 'Incorrect mobile number, email or password', 'INVALID_CREDENTIALS');
    }
    await clearLoginFailures('partner', value, ip);

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
