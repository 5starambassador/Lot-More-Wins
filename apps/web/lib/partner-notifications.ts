import type { Notification, Prisma } from '@prisma/client';
import type { PartnerNotification, PartnerNotificationPage } from '@lotmorewins/types';
import prisma from './prisma';
import { sendPush } from './push';

/**
 * Partner activity feed. A notification row is written in the same transaction as the wallet
 * change it describes (points earned, claimed or redeemed) and pushed to the partner's
 * devices once that transaction has committed.
 */

function formatPoints(points: Prisma.Decimal | number): string {
  return Number(points).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** e.g. " Valid till 12 Jan 2027." — empty when the points never expire. */
function validity(expiresAt: Date | null | undefined): string {
  if (!expiresAt) return '';
  const date = expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return ` Valid till ${date}.`;
}

/** Notifications for the points a new bill credited to registered partners. */
export function billNotificationRows(input: {
  billId: string;
  outletName: string;
  /** Referral bills: the referred customer who purchased. */
  customerName: string | null;
  entries: Pick<Prisma.PointsEntryCreateManyInput, 'type' | 'points' | 'partnerId' | 'expiresAt'>[];
}): Prisma.NotificationCreateManyInput[] {
  return input.entries.flatMap((entry) => {
    // Points held for a customer who has not registered yet have no partner to notify.
    if (!entry.partnerId) return [];
    const points = formatPoints(entry.points as number);
    const expiresAt = (entry.expiresAt as Date | null | undefined) ?? null;
    const isReferral = entry.type === 'REFERRAL';
    return [
      {
        partnerId: entry.partnerId,
        type: isReferral ? ('REFERRAL_POINTS' as const) : ('PURCHASE_POINTS' as const),
        title: isReferral ? 'Referral points earned' : 'Purchase points earned',
        body: isReferral
          ? `You have earned ${points} referral points added to your wallet from the ${input.customerName ?? 'referred'} referred customer purchase on the ${input.outletName} outlet.${validity(expiresAt)}`
          : `You have earned ${points} purchase points added to your wallet by the purchase on the ${input.outletName} outlet.${validity(expiresAt)}`,
        points: entry.points,
        expiresAt,
        billId: input.billId,
      },
    ];
  });
}

export function referralRewardNotificationRow(input: {
  partnerId: string;
  billId: string;
  goal: number;
  discount: number;
}): Prisma.NotificationCreateManyInput {
  const discount = Number(input.discount.toFixed(2));
  return {
    partnerId: input.partnerId,
    type: 'REFERRAL_REWARD',
    title: 'Special discount unlocked',
    body: `You have completed ${input.goal} successful referrals and unlocked a ${discount}% special discount on your next purchase. Show your Personal Discount QR at any outlet to use it.`,
    billId: input.billId,
  };
}

export function claimedNotificationRow(partnerId: string, points: number): Prisma.NotificationCreateManyInput {
  return {
    partnerId,
    type: 'POINTS_CLAIMED',
    title: 'Points added to your wallet',
    body: `${formatPoints(points)} purchase points from your earlier visits as a referred customer have been added to your wallet.`,
    points,
  };
}

export function redeemedNotificationRow(input: {
  partnerId: string;
  points: Prisma.Decimal;
  rupeeValue: Prisma.Decimal;
  outletName: string;
}): Prisma.NotificationCreateManyInput {
  const rupees = input.rupeeValue.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    partnerId: input.partnerId,
    type: 'POINTS_REDEEMED',
    title: 'Points redeemed',
    body: `You have redeemed ${formatPoints(input.points)} points worth ₹${rupees} from your wallet on the ${input.outletName} outlet.`,
    points: input.points,
  };
}

const toPush = (n: Pick<Notification, 'id' | 'partnerId' | 'title' | 'body' | 'type'>) => ({
  partnerId: n.partnerId,
  title: n.title,
  body: n.body,
  data: { notificationId: n.id, type: n.type },
});

/** Pushes the notifications a bill created. Never throws. */
export async function pushBillNotifications(billId: string): Promise<void> {
  try {
    const rows = await prisma.notification.findMany({ where: { billId } });
    await sendPush(rows.map(toPush));
  } catch (error) {
    console.error(`Push for bill ${billId} failed unexpectedly:`, error);
  }
}

/** Pushes a single stored notification. Never throws. */
export async function pushNotification(notification: Notification): Promise<void> {
  await sendPush([toPush(notification)]);
}

function serialize(n: Notification): PartnerNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    points: n.points?.toNumber() ?? null,
    expiresAt: n.expiresAt?.toISOString() ?? null,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listPartnerNotifications(partnerId: string, page: number, limit: number): Promise<PartnerNotificationPage> {
  const [total, unread, rows] = await prisma.$transaction([
    prisma.notification.count({ where: { partnerId } }),
    prisma.notification.count({ where: { partnerId, readAt: null } }),
    prisma.notification.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    notifications: rows.map(serialize),
    unread,
    meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  };
}

export async function markPartnerNotificationsRead(partnerId: string): Promise<number> {
  const result = await prisma.notification.updateMany({ where: { partnerId, readAt: null }, data: { readAt: new Date() } });
  return result.count;
}
