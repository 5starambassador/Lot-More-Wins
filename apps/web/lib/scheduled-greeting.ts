import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { sendPush, type PushMessage } from './push';
import { fail, handleRouteError, ok } from './api-response';

/** A failed batch must not stop the others. */
const PARTNERS_PER_SEND = 100;

export interface ScheduledGreeting {
  /** This row in system_health records that the greeting was sent. Creating it is what allows sending. */
  marker: string;
  title: string;
  body: string;
  /** It can't send outside this window, whenever the cron fires. */
  sendFrom: string;
  sendUntil: string;
}

/**
 * Pushes a greeting to active partners on Android, once. Nothing is added to the Notifications
 * page: older apps can't show a new notification type there. With ?dry=1, only reports who it
 * would reach.
 */
export async function runScheduledGreeting(req: NextRequest, greeting: ScheduledGreeting) {
  const label = `GET /api/cron (${greeting.marker})`;
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return fail(503, 'CRON_SECRET is not set', 'CRON_SECRET_MISSING');
    if (req.headers.get('authorization') !== `Bearer ${secret}`) return fail(401, 'Unauthorized', 'UNAUTHORIZED');

    const devices = await prisma.pushDevice.findMany({
      where: { platform: 'android', partner: { status: 'ACTIVE' } },
      distinct: ['partnerId'],
      select: { partnerId: true },
    });
    if (req.nextUrl.searchParams.get('dry') === '1') return ok({ dryRun: true, partners: devices.length, title: greeting.title, body: greeting.body });

    const now = Date.now();
    if (now < Date.parse(greeting.sendFrom) || now >= Date.parse(greeting.sendUntil)) return ok({ skipped: true, reason: 'Outside the send window' });

    try {
      await prisma.systemHealth.create({ data: { id: greeting.marker, status: 'sending' } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return ok({ skipped: true, reason: 'Already sent' });
      throw error;
    }

    const messages: PushMessage[] = devices.map((d) => ({ partnerId: d.partnerId, title: greeting.title, body: greeting.body, data: { type: 'GREETING' } }));
    const totals = { partners: messages.length, devices: 0, accepted: 0, errors: {} as Record<string, number> };
    for (let start = 0; start < messages.length; start += PARTNERS_PER_SEND) {
      const result = await sendPush(messages.slice(start, start + PARTNERS_PER_SEND));
      totals.devices += result.devices;
      totals.accepted += result.accepted;
      for (const code of result.errors) totals.errors[code] = (totals.errors[code] ?? 0) + 1;
    }

    await prisma.systemHealth.update({ where: { id: greeting.marker }, data: { status: 'sent', checkedAt: new Date(), metadata: totals } });
    console.log(`Greeting ${greeting.marker} sent:`, JSON.stringify(totals));
    return ok(totals);
  } catch (error) {
    return handleRouteError(error, label);
  }
}
