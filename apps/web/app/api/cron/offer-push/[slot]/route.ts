import type { NextRequest } from 'next/server';
import { runScheduledGreeting } from '@/lib/scheduled-greeting';
import { offerPushSlot } from '@/lib/offer-push-schedule';
import { fail } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/cron/offer-push/:slot — one of the ten weekend-offer pushes on 15 Nov (see lib/offer-push-schedule). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slot: string }> }) {
  const greeting = offerPushSlot(Number((await params).slot));
  if (!greeting) return fail(404, 'No such push', 'NOT_FOUND');
  return runScheduledGreeting(req, greeting);
}
