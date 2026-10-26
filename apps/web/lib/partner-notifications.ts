import { Prisma, type Notification } from '@prisma/client';
import type { BillCalculation, PartnerNotification, PartnerNotificationPage, ProgramSettings } from '@lotmorewins/types';
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
  const date = expiresAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  return ` Valid till ${date}.`;
}

/** ₹1,234.50 */
export function formatRupees(amount: Prisma.Decimal | number): string {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const formatPercent = (value: number) => `${Number(value.toFixed(2))}%`;

type PointsEntryInput = Pick<Prisma.PointsEntryCreateManyInput, 'type' | 'points' | 'partnerId' | 'expiresAt'>;
/** A cash reward a bill credited into the wallet, in rupees. */
type CashEntryInput = { type: 'PURCHASE' | 'REFERRAL'; amount: number; partnerId: string | null };

/**
 * One line of bill amounts: "₹100.00 − ₹10.00 discount (10%) + ₹4.50 GST (5%) = ₹94.50", or for a
 * redeem bill "₹300.00 − ₹150.00 from wallet = ₹150.00".
 */
export function billBreakdownText(
  calc: Pick<BillCalculation, 'billAmount' | 'discountPercentage' | 'discountAmount' | 'gstPercentage' | 'gstAmount' | 'finalAmount'> &
    Partial<Pick<BillCalculation, 'walletRedeemAmount'>>
): string {
  const discount =
    calc.discountAmount > 0 ? ` − ${formatRupees(calc.discountAmount)} discount (${formatPercent(calc.discountPercentage)})` : '';
  const gst = calc.gstAmount > 0 ? ` + ${formatRupees(calc.gstAmount)} GST (${formatPercent(calc.gstPercentage)})` : '';
  const wallet = calc.walletRedeemAmount ? ` − ${formatRupees(calc.walletRedeemAmount)} from wallet` : '';
  return `${formatRupees(calc.billAmount)}${discount}${gst}${wallet} = ${formatRupees(calc.finalAmount)}`;
}

/**
 * Notifications for a new bill:
 * - the purchaser's receipt (when they are a registered partner) with the amounts, GST and the
 *   points and cash reward the bill earned them;
 * - the referring partner's referral points and / or cash reward.
 * Rewards held for a customer who has not registered yet have no partner to notify.
 */
export function billNotificationRows(input: {
  billId: string;
  billNumber: string;
  outletName: string;
  /** Referral bills: the referred customer who purchased. */
  customerName: string | null;
  /** The registered partner who purchased: the direct partner, or a referred customer who is a partner. */
  purchaserPartnerId: string | null;
  calc: Pick<BillCalculation, 'billAmount' | 'discountPercentage' | 'discountAmount' | 'gstPercentage' | 'gstAmount' | 'finalAmount'>;
  entries: PointsEntryInput[];
  cashEntries: CashEntryInput[];
}): Prisma.NotificationCreateManyInput[] {
  const rows: Prisma.NotificationCreateManyInput[] = [];
  const pointsOf = (type: 'PURCHASE' | 'REFERRAL') => input.entries.find((e) => e.type === type && e.partnerId);
  const cashOf = (type: 'PURCHASE' | 'REFERRAL') => input.cashEntries.find((e) => e.type === type && e.partnerId);

  if (input.purchaserPartnerId) {
    const points = pointsOf('PURCHASE');
    const cash = cashOf('PURCHASE');
    const expiresAt = (points?.expiresAt as Date | null | undefined) ?? null;
    const earned = [
      points ? ` You have earned ${formatPoints(points.points as number)} purchase points.${validity(expiresAt)}` : '',
      cash ? ` ${formatRupees(cash.amount)} cashback has been added to your wallet.` : '',
    ].join('');
    rows.push({
      partnerId: input.purchaserPartnerId,
      type: 'BILL_RECEIPT',
      title: `Bill at ${input.outletName}`,
      body: `Bill ${input.billNumber}: ${billBreakdownText(input.calc)}.${earned}`,
      points: points?.points ?? null,
      amount: cash?.amount ?? null,
      expiresAt,
      billId: input.billId,
    });
  }

  const referral = pointsOf('REFERRAL');
  const referralCash = cashOf('REFERRAL');
  const referrerId = referral?.partnerId ?? referralCash?.partnerId;
  if (referrerId) {
    const who = `the ${input.customerName ?? 'referred'} referred customer purchase on the ${input.outletName} outlet`;
    const expiresAt = (referral?.expiresAt as Date | null | undefined) ?? null;
    const cashText = referralCash ? formatRupees(referralCash.amount) : '';
    rows.push(
      referral
        ? {
            partnerId: referrerId,
            type: 'REFERRAL_POINTS',
            title: 'Referral points earned',
            body: `You have earned ${formatPoints(referral.points as number)} referral points added to your wallet from ${who}.${validity(expiresAt)}${
              referralCash ? ` ${cashText} cashback has been added too.` : ''
            }`,
            points: referral.points,
            amount: referralCash?.amount ?? null,
            expiresAt,
            billId: input.billId,
          }
        : {
            partnerId: referrerId,
            type: 'CASH_REWARD',
            title: 'Cashback earned',
            body: `You have earned ${cashText} cashback, added to your wallet, from ${who}.`,
            amount: referralCash!.amount,
            billId: input.billId,
          }
    );
  }
  return rows;
}

// ============================================================================
// Payouts
// ============================================================================

export function payoutRequestedRow(input: {
  partnerId: string;
  payoutId: string;
  payoutNumber: string;
  amount: Prisma.Decimal;
  upiId: string;
  weekly: boolean;
}): Prisma.NotificationCreateManyInput {
  return {
    partnerId: input.partnerId,
    type: 'PAYOUT_REQUESTED',
    title: input.weekly ? 'Weekly payout scheduled' : 'Payout requested',
    body: `${formatRupees(input.amount)} from your cash reward wallet will be paid to ${input.upiId} in 3–7 working days (payout ${input.payoutNumber}).`,
    amount: input.amount,
    payoutId: input.payoutId,
  };
}

export function payoutPaidRow(input: {
  partnerId: string;
  payoutId: string;
  payoutNumber: string;
  paidAmount: Prisma.Decimal;
  upiId: string;
  upiTxnRef: string;
}): Prisma.NotificationCreateManyInput {
  return {
    partnerId: input.partnerId,
    type: 'PAYOUT_PAID',
    title: 'Payout paid',
    body: `${formatRupees(input.paidAmount)} has been paid to ${input.upiId} (payout ${input.payoutNumber}, UPI ref ${input.upiTxnRef}).`,
    amount: input.paidAmount,
    payoutId: input.payoutId,
  };
}

export function payoutFailedRow(input: {
  partnerId: string;
  payoutId: string;
  payoutNumber: string;
  amount: Prisma.Decimal;
  upiId: string;
}): Prisma.NotificationCreateManyInput {
  return {
    partnerId: input.partnerId,
    type: 'PAYOUT_FAILED',
    title: 'Payout could not be paid',
    body: `We could not pay ${formatRupees(input.amount)} to ${input.upiId} (payout ${input.payoutNumber}). The amount is back in your wallet; please check your UPI ID in Profile.`,
    amount: input.amount,
    payoutId: input.payoutId,
  };
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

/** Rewards (points and cashback) earned as a referred customer, claimed into the new wallet on registration. */
export function claimedNotificationRow(partnerId: string, points: number): Prisma.NotificationCreateManyInput {
  return {
    partnerId,
    type: 'POINTS_CLAIMED',
    title: 'Points added to your wallet',
    body: `${formatPoints(points)} points from your earlier visits as a referred customer have been added to your wallet.`,
    points,
  };
}

export function redeemedNotificationRow(input: {
  partnerId: string;
  points: Prisma.Decimal;
  rupeeValue: Prisma.Decimal;
  outletName: string;
  /** Redeem bills: the bill the wallet paid part of. */
  billAmount?: Prisma.Decimal;
}): Prisma.NotificationCreateManyInput {
  const rupees = input.rupeeValue.toNumber().toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const bill = input.billAmount ? ` towards your ${formatRupees(input.billAmount)} bill` : '';
  return {
    partnerId: input.partnerId,
    type: 'POINTS_REDEEMED',
    title: 'Points redeemed',
    body: `You have redeemed ${formatPoints(input.points)} points worth ₹${rupees} from your wallet${bill} on the ${input.outletName} outlet. The rest of your wallet is untouched.`,
    points: input.points,
  };
}

/** Both sides of a partner-to-partner transfer. */
export function transferNotificationRows(input: {
  fromPartnerId: string;
  fromName: string;
  toPartnerId: string;
  toName: string;
  points: Prisma.Decimal;
  transferNumber: string;
}): Prisma.NotificationCreateManyInput[] {
  return [
    {
      partnerId: input.fromPartnerId,
      type: 'WALLET_TRANSFER_OUT',
      title: 'Points sent',
      body: `You have sent ${formatPoints(input.points)} points from your wallet to ${input.toName} (transfer ${input.transferNumber}).`,
      points: input.points,
    },
    {
      partnerId: input.toPartnerId,
      type: 'WALLET_TRANSFER_IN',
      title: 'Points received',
      body: `${input.fromName} has sent you ${formatPoints(input.points)} points. They are in your wallet now (transfer ${input.transferNumber}).`,
      points: input.points,
    },
  ];
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
  WALLET_TRANSFER_OUT: 'Wallet amount sent',
  WALLET_TRANSFER_IN: 'Wallet amount received',
};

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
  return {
    ...n,
    title: RUPEE_TITLES[n.type] ?? n.title,
    body: inRupees(n.body, display.pointsToRupees),
  };
}

const toPush = (n: Pick<Notification, 'id' | 'partnerId' | 'title' | 'body' | 'type'>, display: Display) => {
  const shown = present(n, display);
  return {
    partnerId: n.partnerId,
    title: shown.title,
    body: shown.body,
    data: { notificationId: n.id, type: n.type },
  };
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
    amount: n.amount?.toNumber() ?? null,
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
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export async function markPartnerNotificationsRead(partnerId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { partnerId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
