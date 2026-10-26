import { ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/weekly-payouts — retired. Weekly UPI payouts ended when the cash reward wallet
 * merged into the one wallet; the Vercel cron entry can be removed. Does nothing.
 */
export async function GET() {
  return ok({ skipped: true, reason: 'UPI payouts have ended' });
}
