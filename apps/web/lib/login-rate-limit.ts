import type { NextRequest } from 'next/server';
import prisma from './prisma';
import { HttpError } from './auth';

/**
 * Database-backed limiter for Super Admin and Outlet Admin sign-in (same approach as the
 * OTP request limit). Failures are keyed by the submitted email — whether or not an
 * account exists — so a blocked response never reveals account existence.
 *
 * Within a 15-minute window, sign-in is refused once there are:
 *   - 5 failures for the same email from the same IP (typical brute force),
 *   - 20 failures from the same IP across any emails (credential stuffing),
 *   - 50 failures for the same email across all IPs (distributed attack; kept high so an
 *     attacker cannot easily lock a legitimate user out).
 */

export type LoginScope = 'super_admin' | 'outlet_admin' | 'partner';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL_AND_IP = 5;
const MAX_PER_IP = 20;
const MAX_PER_EMAIL = 50;
const RETENTION_MS = 24 * 60 * 60 * 1000;

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
  return ip.slice(0, 64);
}

/** Throws 429 when the email/IP combination has exceeded any limit. Call before checking the password. */
export async function assertLoginAllowed(scope: LoginScope, email: string, ip: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [emailAndIp, byIp, byEmail] = await Promise.all([
    prisma.loginAttempt.count({ where: { scope, email, ip, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { scope, ip, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { scope, email, createdAt: { gte: since } } }),
  ]);
  if (emailAndIp >= MAX_PER_EMAIL_AND_IP || byIp >= MAX_PER_IP || byEmail >= MAX_PER_EMAIL) {
    throw new HttpError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.', 'RATE_LIMITED');
  }
}

export async function recordLoginFailure(scope: LoginScope, email: string, ip: string): Promise<void> {
  await prisma.$transaction([
    prisma.loginAttempt.create({ data: { scope, email, ip } }),
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } }),
  ]);
}

/** A successful sign-in clears that email's earlier failures from the same IP. */
export async function clearLoginFailures(scope: LoginScope, email: string, ip: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { scope, email, ip } });
}

export const RATE_LIMIT_RETRY_AFTER_SEC = WINDOW_MS / 1000;
