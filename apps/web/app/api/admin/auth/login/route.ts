import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { ADMIN_SESSION_COOKIE, HttpError, SUPER_ADMIN_TOKEN_TTL_SEC, signToken } from '@/lib/auth';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';
import {
  RATE_LIMIT_RETRY_AFTER_SEC,
  assertLoginAllowed,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
} from '@/lib/login-rate-limit';

export const dynamic = 'force-dynamic';

// Compared against when the email is unknown so response time does not reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync('lmw-timing-equalizer', 10);

/** POST /api/admin/auth/login — Super Admin sign-in; issues an httpOnly session cookie. */
export async function POST(req: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const { email } = parsed.data;
    const ip = clientIp(req);
    await assertLoginAllowed('super_admin', email, ip);

    const admin = await prisma.superAdmin.findUnique({ where: { email: parsed.data.email } });
    const valid = bcrypt.compareSync(parsed.data.password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !valid || !admin.isActive) {
      await recordLoginFailure('super_admin', email, ip);
      return fail(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    await clearLoginFailures('super_admin', email, ip);

    const token = signToken({ typ: 'super_admin', sub: admin.id }, SUPER_ADMIN_TOKEN_TTL_SEC);
    const res = ok({ admin: { id: admin.id, name: admin.name, email: admin.email } });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production' && process.env.ADMIN_COOKIE_INSECURE !== 'true',
      path: '/',
      maxAge: SUPER_ADMIN_TOKEN_TTL_SEC,
    });
    return res;
  } catch (error) {
    if (error instanceof HttpError && error.code === 'RATE_LIMITED') {
      const res = fail(429, error.message, error.code);
      res.headers.set('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SEC));
      return res;
    }
    return handleRouteError(error, 'POST /api/admin/auth/login');
  }
}
