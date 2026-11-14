import type { NextRequest } from 'next/server';
import crypto from 'crypto';
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
  /**
   * Full message of an offer. When set, every active partner also gets an OFFER notification in
   * the app (title, body, and this on its own page), and the push carries its id.
   */
  detail?: string;
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

    const messages: PushMessage[] = greeting.detail
      ? await createOfferNotifications(greeting, new Set(devices.map((d) => d.partnerId)))
      : devices.map((d) => ({ partnerId: d.partnerId, title: greeting.title, body: greeting.body, data: { type: 'GREETING' } }));
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

/** OFFER notifications for every active partner; returns the pushes for those with a device. */
export async function createOfferNotifications(
  greeting: Pick<ScheduledGreeting, 'title' | 'body' | 'detail'>,
  pushTo: Set<string>,
  createdAt = new Date()
): Promise<PushMessage[]> {
  const partners = await prisma.partner.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
  const rows = partners.map((p) => ({
    id: crypto.randomUUID(),
    partnerId: p.id,
    type: 'OFFER' as const,
    title: greeting.title,
    body: greeting.body,
    detail: greeting.detail ?? null,
    createdAt,
  }));
  for (let i = 0; i < rows.length; i += 1000) await prisma.notification.createMany({ data: rows.slice(i, i + 1000) });
  return rows
    .filter((r) => pushTo.has(r.partnerId))
    .map((r) => ({ partnerId: r.partnerId, title: r.title, body: r.body, data: { type: 'OFFER', notificationId: r.id } }));
}
