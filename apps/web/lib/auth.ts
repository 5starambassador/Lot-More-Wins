import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import type { SuperAdmin } from '@prisma/client';
import type { AdminPage, SuperAdminProfile } from '@lotmorewins/types';
import { ADMIN_PAGES } from '@lotmorewins/validation';
import prisma from './prisma';

/**
 * Central token handling for every caller type (partner, super admin, outlet admin).
 * HS256 JWTs signed with JWT_SECRET. Every protected route verifies the signature
 * and expiry here — payloads are never trusted without verification.
 */

/** 'redeem' tokens are the payload of a partner's redeem QR; they never authenticate a request. */
export type TokenType = 'partner' | 'super_admin' | 'outlet_admin' | 'redeem';

export interface TokenPayload {
  typ?: TokenType;
  sub?: string;
  partnerId?: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

export const ADMIN_SESSION_COOKIE = 'lmw_admin_session';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  }
  return secret;
}

function sign(input: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

export function signToken(payload: Record<string, unknown>, expiresInSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec })).toString('base64url');
  return `${header}.${body}.${sign(`${header}.${body}`, getJwtSecret())}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = Buffer.from(sign(`${header}.${body}`, getJwtSecret()));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (decodedHeader.alg !== 'HS256') return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

// ============================================================================
// Error type shared by route handlers
// ============================================================================

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** Safe, client-facing extra data (never internal error details). */
    public readonly details?: unknown
  ) {
    super(message);
  }
}

// ============================================================================
// Partner
// ============================================================================

export const PARTNER_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;

/** Returns the verified partner id. Phase 2 partner tokens carry `partnerId` without `typ`. */
export function requirePartnerId(req: NextRequest): string {
  const token = getBearerToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload || (payload.typ && payload.typ !== 'partner') || typeof payload.partnerId !== 'string') {
    throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  }
  return payload.partnerId;
}

// ============================================================================
// Super Admin — httpOnly cookie for the web panel, Bearer for API clients/tests
// ============================================================================

export const SUPER_ADMIN_TOKEN_TTL_SEC = 60 * 60 * 12;

export function readSuperAdminIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.typ !== 'super_admin' || typeof payload.sub !== 'string') return null;
  return payload.sub;
}

/**
 * Every web panel account (Super Admin or Admin) signs in the same way and carries the same
 * session; what it may do is read from its database row on every request, so a change of
 * pages, delete permission or a deactivation applies immediately.
 */
export function toAdminProfile(
  admin: Pick<SuperAdmin, 'id' | 'name' | 'email' | 'role' | 'position' | 'pages' | 'canDelete'>
): SuperAdminProfile {
  const isSuper = admin.role === 'SUPER_ADMIN';
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    position: admin.position,
    pages: isSuper ? [...ADMIN_PAGES] : ADMIN_PAGES.filter((page) => admin.pages.includes(page)),
    canDelete: isSuper || admin.canDelete,
  };
}

/** The active panel account behind a session token, or null. Used by the panel's server layouts too. */
export async function loadAdminSession(token: string | null | undefined): Promise<SuperAdminProfile | null> {
  const adminId = readSuperAdminIdFromToken(token);
  if (!adminId) return null;
  const admin = await prisma.superAdmin.findUnique({ where: { id: adminId } });
  return admin && admin.isActive ? toAdminProfile(admin) : null;
}

const PAGE_NAMES: Record<AdminPage, string> = {
  dashboard: 'the dashboard',
  partners: 'Partners',
  outlets: 'Outlets',
  transactions: 'Transactions',
  settings: 'Programme settings',
};

/**
 * Any signed-in panel account; with `page`, only one that has been given that page.
 * Throws 401 without a valid session and 403 without access.
 */
export async function requireAdmin(req: NextRequest, page?: AdminPage): Promise<SuperAdminProfile> {
  const token = getBearerToken(req) ?? req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!readSuperAdminIdFromToken(token)) {
    throw new HttpError(401, 'Admin authentication required', 'UNAUTHENTICATED');
  }
  const admin = await loadAdminSession(token);
  if (!admin) throw new HttpError(403, 'This admin account is not active', 'FORBIDDEN');
  if (page && !admin.pages.includes(page)) {
    throw new HttpError(403, `You do not have access to ${PAGE_NAMES[page]}`, 'PAGE_FORBIDDEN');
  }
  return admin;
}

/** Deleting on `page`: needs that page and the delete permission. */
export async function requireAdminDelete(req: NextRequest, page: AdminPage): Promise<SuperAdminProfile> {
  const admin = await requireAdmin(req, page);
  if (!admin.canDelete) throw new HttpError(403, 'You do not have permission to delete records', 'DELETE_FORBIDDEN');
  return admin;
}

/** Super Admin only: managing admin accounts. */
export async function requireSuperAdmin(req: NextRequest): Promise<SuperAdminProfile> {
  const admin = await requireAdmin(req);
  if (admin.role !== 'SUPER_ADMIN') throw new HttpError(403, 'Only the Super Admin can do this', 'SUPER_ADMIN_ONLY');
  return admin;
}

// ============================================================================
// Outlet Admin — the outlet is always resolved from the verified admin record,
// never from a client-supplied outlet id.
// ============================================================================

export const OUTLET_ADMIN_TOKEN_TTL_SEC = 60 * 60 * 24 * 7;

export async function requireOutletAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.typ !== 'outlet_admin' || typeof payload.sub !== 'string') {
    throw new HttpError(401, 'Outlet Admin authentication required', 'UNAUTHENTICATED');
  }
  const admin = await prisma.outletAdmin.findUnique({
    where: { id: payload.sub },
    include: { outlet: true },
  });
  if (!admin || !admin.isActive) {
    throw new HttpError(403, 'Outlet Admin access denied', 'FORBIDDEN');
  }
  return { adminId: admin.id, adminEmail: admin.email, outlet: admin.outlet };
}
