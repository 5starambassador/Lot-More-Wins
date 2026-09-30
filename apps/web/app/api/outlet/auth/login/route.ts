import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@lotmorewins/validation';
import type { OutletAdminSession } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { HttpError, OUTLET_ADMIN_TOKEN_TTL_SEC, signToken } from '@/lib/auth';
import { serializeOutlet } from '@/lib/outlets';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';
import {
  RATE_LIMIT_RETRY_AFTER_SEC,
  assertLoginAllowed,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
} from '@/lib/login-rate-limit';

export const dynamic = 'force-dynamic';

const DUMMY_HASH = bcrypt.hashSync('lmw-timing-equalizer', 10);

/** POST /api/outlet/auth/login — Outlet Admin sign-in for the mobile app. */
export async function POST(req: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const { email } = parsed.data;
    const ip = clientIp(req);
    await assertLoginAllowed('outlet_admin', email, ip);

    const admin = await prisma.outletAdmin.findUnique({
      where: { email: parsed.data.email },
      include: { outlet: true },
    });
    const valid = bcrypt.compareSync(parsed.data.password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !valid || !admin.isActive) {
      await recordLoginFailure('outlet_admin', email, ip);
      return fail(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    await clearLoginFailures('outlet_admin', email, ip);

    const session: OutletAdminSession = {
      token: signToken({ typ: 'outlet_admin', sub: admin.id }, OUTLET_ADMIN_TOKEN_TTL_SEC),
      admin: { id: admin.id, email: admin.email },
      outlet: serializeOutlet(admin.outlet),
    };
    return ok(session);
  } catch (error) {
    if (error instanceof HttpError && error.code === 'RATE_LIMITED') {
      const res = fail(429, error.message, error.code);
      res.headers.set('Retry-After', String(RATE_LIMIT_RETRY_AFTER_SEC));
      return res;
    }
    return handleRouteError(error, 'POST /api/outlet/auth/login');
  }
}
