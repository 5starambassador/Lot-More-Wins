import { ADMIN_SESSION_COOKIE } from '@/lib/auth';
import { ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/admin/auth/logout — clears the Super Admin session cookie. */
export async function POST() {
  const res = ok({ signedOut: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}
