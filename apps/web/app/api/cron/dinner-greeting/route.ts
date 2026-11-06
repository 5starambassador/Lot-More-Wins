import type { NextRequest } from 'next/server';
import { runScheduledGreeting } from '@/lib/scheduled-greeting';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/cron/dinner-greeting — Vercel fires it at 18:00 IST on 6 Nov, as a live test of the scheduled greetings. */
export async function GET(req: NextRequest) {
  return runScheduledGreeting(req, {
    marker: 'dinner-greeting-2026-11-06',
    title: 'Had your dinner? 🍽️',
    body: 'Hope you are having a lovely evening! Open Lot More Wins and check your rewards and offers.',
    sendFrom: '2026-11-06T17:55:00+05:30',
    sendUntil: '2026-11-06T20:00:00+05:30',
  });
}
