import type { NextRequest } from 'next/server';
import { runScheduledGreeting } from '@/lib/scheduled-greeting';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/cron/diwali-greeting — Vercel fires it at 09:00 IST on 8 Nov (see apps/web/vercel.json). */
export async function GET(req: NextRequest) {
  return runScheduledGreeting(req, {
    marker: 'diwali-greeting-2026',
    title: 'Happy Diwali from Lot More Wins! 🪔',
    body: 'May this festival of lights fill your home with joy, good health and prosperity. Thank you for being part of our family.',
    sendFrom: '2026-11-08T08:00:00+05:30',
    sendUntil: '2026-11-08T20:00:00+05:30',
  });
}
