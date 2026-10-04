import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS for the JSON API, needed when the Expo apps run in a browser (Expo web on another
 * port / origin). Native apps do not send an Origin and are unaffected.
 * - Development: any http://localhost:* or http://127.0.0.1:* origin, or a private-LAN
 *   address (192.168.x.x, 10.x.x.x, 172.16-31.x.x) so a phone browser on the same Wi-Fi can test.
 * - Always: the programme's own sites (the Partner App web version and the landing page).
 * - Otherwise: only origins listed in CORS_ALLOWED_ORIGINS (comma separated).
 * Credentials (cookies) are never allowed cross-origin: the mobile apps use Bearer tokens,
 * and the Super Admin cookie session stays same-origin only.
 */

const LOCAL_ORIGIN =
  /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const SITE_ORIGINS = ['https://partner.lotmorewins.com', 'https://lotmorewins.com', 'https://www.lotmorewins.com'];

function isAllowedOrigin(origin: string): boolean {
  if (SITE_ORIGINS.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && LOCAL_ORIGIN.test(origin)) return true;
  const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function withCors(res: NextResponse, origin: string) {
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.headers.set('Access-Control-Max-Age', '600');
  return res;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowed = !!origin && isAllowedOrigin(origin);

  if (req.method === 'OPTIONS') {
    return allowed ? withCors(new NextResponse(null, { status: 204 }), origin!) : new NextResponse(null, { status: 204 });
  }

  const res = NextResponse.next();
  return allowed ? withCors(res, origin!) : res;
}

export const config = { matcher: '/api/:path*' };
