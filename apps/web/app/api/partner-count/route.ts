import { NextResponse } from 'next/server';
import { handleRouteError, ok } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Added to the registered partners for the figure shown on the campaign pages. */
const DISPLAY_HEAD_START = 1500;

/**
 * Public and read-only, so any site may fetch it. Every open page polls this every few seconds, so
 * the CDN answers for two seconds at a time: the database sees the same load however many are open.
 */
function withPublicCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'public, max-age=1, s-maxage=2');
  return res;
}

/** GET /api/partner-count — the live counter on /students-download and /diwali-launch. */
export async function GET() {
  try {
    const registered = await prisma.partner.count();
    return withPublicCors(ok({ count: registered + DISPLAY_HEAD_START }));
  } catch (error) {
    return withPublicCors(handleRouteError(error, 'GET /api/partner-count'));
  }
}
