import type { NextRequest } from 'next/server';
import { dispatchDuePushes } from '@/lib/push-engine';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/push-campaigns — sends the scheduled pushes that are due (Super Admin → Push
 * notifications). Call it every few minutes with "Authorization: Bearer $CRON_SECRET"; a send
 * happens once however often or from however many places it is called.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return fail(503, 'CRON_SECRET is not set', 'CRON_SECRET_MISSING');
    if (req.headers.get('authorization') !== `Bearer ${secret}`) return fail(401, 'Unauthorized', 'UNAUTHORIZED');
    return ok(await dispatchDuePushes());
  } catch (error) {
    return handleRouteError(error, 'GET /api/cron/push-campaigns');
  }
}
