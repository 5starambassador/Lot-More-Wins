import prisma from './prisma';

/**
 * Mobile push through the Expo push service. Best-effort: a push problem is logged and
 * never fails the request that triggered it; the notification is always in the in-app feed.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TIMEOUT_MS = 8_000;
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

export interface PushMessage {
  partnerId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const devices = await prisma.pushDevice.findMany({
      where: { partnerId: { in: [...new Set(messages.map((m) => m.partnerId))] } },
      select: { partnerId: true, token: true },
    });
    const payload = messages.flatMap((m) =>
      devices
        .filter((d) => d.partnerId === m.partnerId)
        .map((d) => ({ to: d.token, title: m.title, body: m.body, data: m.data ?? {}, sound: 'default', channelId: 'default' }))
    );

    const stale: string[] = [];
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.error(`Expo push request failed with HTTP ${res.status}`);
        continue;
      }
      const tickets = ((await res.json()) as { data?: ExpoTicket[] }).data ?? [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') stale.push(batch[index].to);
      });
    }
    // The app was uninstalled or the token rotated: stop sending to it.
    if (stale.length) await prisma.pushDevice.deleteMany({ where: { token: { in: stale } } });
  } catch (error) {
    console.error('Push notification delivery failed:', error);
  }
}
