import { Prisma, type Notification } from '@prisma/client';
import type { PartnerNotification, PartnerNotificationPage, ProgramSettings } from '@lotmorewins/types';
import prisma from './prisma';
import { rupeeValueOf } from './points';
import { sendPush } from './push';
import { getProgramSettings } from './settings';

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

// ============================================================================
// Wallet display: notifications are stored in points and shown in the Super Admin's chosen
// unit when they are listed or pushed, so old and new notifications always agree with the
// wallet. Rupee amounts use the current ratio, exactly like the wallet balance.
// ============================================================================

type Display = Pick<ProgramSettings, 'walletDisplay' | 'pointsToRupees'>;

/** "50 points", "50 referral points", "50 purchase points", "50 points worth ₹5.00". */
const POINTS_AMOUNT = /(\d[\d,]*(?:\.\d+)?) (referral |purchase )?points( worth ₹(\d[\d,]*(?:\.\d+)?))?/g;

const RUPEE_TITLES: Partial<Record<Notification['type'], string>> = {
  PURCHASE_POINTS: 'Purchase reward earned',
  REFERRAL_POINTS: 'Referral reward earned',
  POINTS_CLAIMED: 'Rewards added to your wallet',
  POINTS_REDEEMED: 'Wallet amount redeemed',
};

const formatRupees = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function inRupees(text: string, ratio: Display['pointsToRupees']): string {
  return text.replace(POINTS_AMOUNT, (_match, points: string, kind: string | undefined, _worth, worthRupees: string | undefined) => {
    // Redemptions already state the exact rupee value they were redeemed for.
    if (worthRupees) return `₹${worthRupees}`;
    const rupees = formatRupees(rupeeValueOf(new Prisma.Decimal(points.replace(/,/g, '')), ratio).toNumber());
    return kind ? `${rupees} in ${kind.trim()} rewards` : rupees;
  });
}

function present<T extends Pick<Notification, 'type' | 'title' | 'body'>>(n: T, display: Display): T {
  if (display.walletDisplay !== 'RUPEES') return n;
  return { ...n, title: RUPEE_TITLES[n.type] ?? n.title, body: inRupees(n.body, display.pointsToRupees) };
}

const toPush = (n: Pick<Notification, 'id' | 'partnerId' | 'title' | 'body' | 'type'>, display: Display) => {
  const shown = present(n, display);
  return { partnerId: n.partnerId, title: shown.title, body: shown.body, data: { notificationId: n.id, type: n.type } };
};

/** Pushes the notifications a bill created. Never throws. */
export async function pushBillNotifications(billId: string): Promise<void> {
  try {
    const [rows, display] = await Promise.all([prisma.notification.findMany({ where: { billId } }), getProgramSettings()]);
    await sendPush(rows.map((n) => toPush(n, display)));
  } catch (error) {
    console.error(`Push for bill ${billId} failed unexpectedly:`, error);
  }
}

/** Pushes a single stored notification. Never throws. */
export async function pushNotification(notification: Notification): Promise<void> {
  try {
    await sendPush([toPush(notification, await getProgramSettings())]);
  } catch (error) {
    console.error(`Push for notification ${notification.id} failed unexpectedly:`, error);
  }
}

function serialize(stored: Notification, display: Display): PartnerNotification {
  const n = present(stored, display);
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
  const [[total, unread, rows], display] = await Promise.all([
    prisma.$transaction([
      prisma.notification.count({ where: { partnerId } }),
      prisma.notification.count({ where: { partnerId, readAt: null } }),
      prisma.notification.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]),
    getProgramSettings(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    notifications: rows.map((n) => serialize(n, display)),
    unread,
    meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  };
}

export async function markPartnerNotificationsRead(partnerId: string): Promise<number> {
  const result = await prisma.notification.updateMany({ where: { partnerId, readAt: null }, data: { readAt: new Date() } });
  return result.count;
}
