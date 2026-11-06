import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendPush, type PushMessage } from '@/lib/push';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Vercel fires the cron at 09:00 IST (see apps/web/vercel.json); it can't send outside this window. */
const SEND_FROM = Date.parse('2026-11-08T08:00:00+05:30');
const SEND_UNTIL = Date.parse('2026-11-08T20:00:00+05:30');

/** This row in system_health records that the greeting was sent. Creating it is what allows sending. */
const SENT_MARKER = 'diwali-greeting-2026';

const TITLE = 'Happy Diwali from Lot More Wins! 🪔';
const BODY = 'May this festival of lights fill your home with joy, good health and prosperity. Thank you for being part of our family.';

/** A failed batch must not stop the others. */
const PARTNERS_PER_SEND = 100;

/**
 * GET /api/cron/diwali-greeting — pushes the Diwali greeting to active partners on Android, once.
 * Nothing is added to the Notifications page: older apps can't show a new notification type there.
 * With ?dry=1, only reports who it would reach.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return fail(503, 'CRON_SECRET is not set', 'CRON_SECRET_MISSING');
    if (req.headers.get('authorization') !== `Bearer ${secret}`) return fail(401, 'Unauthorized', 'UNAUTHORIZED');

    const devices = await prisma.pushDevice.findMany({
      where: { platform: 'android', partner: { status: 'ACTIVE' } },
      distinct: ['partnerId'],
      select: { partnerId: true },
    });
    if (req.nextUrl.searchParams.get('dry') === '1') return ok({ dryRun: true, partners: devices.length, title: TITLE, body: BODY });

    const now = Date.now();
    if (now < SEND_FROM || now >= SEND_UNTIL) return ok({ skipped: true, reason: 'Outside the send window' });

    try {
      await prisma.systemHealth.create({ data: { id: SENT_MARKER, status: 'sending' } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return ok({ skipped: true, reason: 'Already sent' });
      throw error;
    }

    const messages: PushMessage[] = devices.map((d) => ({ partnerId: d.partnerId, title: TITLE, body: BODY, data: { type: 'GREETING' } }));
    const totals = { partners: messages.length, devices: 0, accepted: 0, errors: {} as Record<string, number> };
    for (let start = 0; start < messages.length; start += PARTNERS_PER_SEND) {
      const result = await sendPush(messages.slice(start, start + PARTNERS_PER_SEND));
      totals.devices += result.devices;
      totals.accepted += result.accepted;
      for (const code of result.errors) totals.errors[code] = (totals.errors[code] ?? 0) + 1;
    }

    await prisma.systemHealth.update({ where: { id: SENT_MARKER }, data: { status: 'sent', checkedAt: new Date(), metadata: totals } });
    console.log('Diwali greeting sent:', JSON.stringify(totals));
    return ok(totals);
  } catch (error) {
    return handleRouteError(error, 'GET /api/cron/diwali-greeting');
  }
}
