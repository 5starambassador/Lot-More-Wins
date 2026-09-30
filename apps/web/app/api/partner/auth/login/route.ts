import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { partnerLoginSchema } from '@lotmorewins/validation';
import type { PartnerOnboardingResponse } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { HttpError, PARTNER_TOKEN_TTL_SEC, signToken } from '@/lib/auth';
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
      include: { qrCodes: { where: { status: 'ACTIVE' }, orderBy: { type: 'asc' } } },
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

    const session: PartnerOnboardingResponse = {
      partner: {
        id: partner.id,
        partnerCode: partner.partnerCode,
        name: partner.name,
        mobile: partner.mobile,
        email: partner.email,
        role: partner.role,
        isAchariyaAssociated: partner.isAchariyaAssociated,
        employeeId: partner.employeeId,
        admissionNumber: partner.admissionNumber,
        status: partner.status,
        createdAt: partner.createdAt.toISOString(),
      },
      qrCodes: partner.qrCodes.map((qr) => ({
        id: qr.id,
        code: qr.code,
        type: qr.type,
        title: qr.type === 'DEFAULT_DISCOUNT' ? 'Default Discount QR' : 'Referral QR',
        description:
          qr.type === 'DEFAULT_DISCOUNT'
            ? 'Show at checkout to redeem your exclusive partner discount.'
            : 'Share with friends & family to earn points whenever they shop.',
        status: qr.status,
        createdAt: qr.createdAt.toISOString(),
      })),
      token: signToken(
        { typ: 'partner', partnerId: partner.id, partnerCode: partner.partnerCode, role: partner.role, mobile: partner.mobile },
        PARTNER_TOKEN_TTL_SEC
      ),
    };
    return ok(session, 200, 'Signed in');
  } catch (error) {
    if (error instanceof HttpError && error.code === 'RATE_LIMITED') {
      const res = fail(429, error.message, error.code);
      res.headers.set('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SEC));
      return res;
    }
    return handleRouteError(error, 'POST /api/partner/auth/login');
  }
}
