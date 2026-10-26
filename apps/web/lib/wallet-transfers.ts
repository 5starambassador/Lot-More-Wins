import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { Notification } from '@prisma/client';
import type { WalletTransferRecipient, WalletTransferResponse } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';
import { getProgramSettings } from './settings';
import { availablePoints, lockWallet, rupeeValueOf, spendWalletPoints } from './points';
import { consumePartnerOtp, sendPartnerOtp, type SentPartnerOtp } from './partner-otp';
import { transferNotificationRows } from './partner-notifications';

/**
 * Partner-to-partner wallet transfer, like a UPI payment between two partner accounts. The
 * recipient is found by their registered mobile number only; every transfer is confirmed with a
 * one-time code sent to the sender (sessions never expire, so the code is what stops a borrowed
 * phone from emptying the wallet). The sender's points are spent soonest-expiring first; the
 * recipient gets one entry carrying the soonest expiry among the points sent, so a transfer can
 * never extend how long points last.
 */

const Decimal = Prisma.Decimal;

async function activeSender(partnerId: string) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new HttpError(404, 'Partner account not found', 'PARTNER_NOT_FOUND');
  if (partner.status !== 'ACTIVE') throw new HttpError(403, 'This partner account is not active', 'PARTNER_INACTIVE');
  return partner;
}

async function recipientByMobile(senderId: string, mobile: string) {
  const recipient = await prisma.partner.findUnique({ where: { mobile } });
  if (!recipient || recipient.status !== 'ACTIVE') {
    throw new HttpError(404, 'No active partner account uses this mobile number', 'RECIPIENT_NOT_FOUND');
  }
  if (recipient.id === senderId) {
    throw new HttpError(422, 'You cannot send points to your own wallet', 'SELF_TRANSFER');
  }
  return recipient;
}

export async function findTransferRecipient(senderId: string, mobile: string): Promise<WalletTransferRecipient> {
  const recipient = await recipientByMobile(senderId, mobile);
  return { name: recipient.name, partnerCode: recipient.partnerCode, mobile: recipient.mobile };
}

/** Checks the transfer can go ahead (recipient, balance), then sends the sender a confirmation code. */
export async function requestTransferOtp(senderId: string, mobile: string, points: number): Promise<SentPartnerOtp> {
  const sender = await activeSender(senderId);
  await recipientByMobile(senderId, mobile);
  const balance = await availablePoints(prisma, senderId);
  if (new Decimal(points).gt(balance)) {
    throw new HttpError(422, 'Your wallet does not have enough for this amount', 'INSUFFICIENT_POINTS', {
      balancePoints: balance.toNumber(),
    });
  }
  return sendPartnerOtp(sender, 'transfer');
}

function generateTransferNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `LMW-T-${ymd}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

type TransferRow = Prisma.WalletTransferGetPayload<{ include: { toPartner: { select: { name: true; mobile: true } } } }>;

function senderView(t: TransferRow) {
  return {
    id: t.id,
    transferNumber: t.transferNumber,
    direction: 'OUT' as const,
    points: t.points.toNumber(),
    rupeeValue: t.rupeeValue.toNumber(),
    counterparty: { name: t.toPartner.name, mobile: t.toPartner.mobile },
    createdAt: t.createdAt.toISOString(),
  };
}

/**
 * Sends `points` to the partner with `mobile`. Idempotent per (sender, idempotencyKey): a retry
 * returns the original transfer with `replayed: true` and needs no new code.
 */
export async function sendWalletTransfer(
  senderId: string,
  input: { mobile: string; points: number; otp: string; idempotencyKey: string }
): Promise<{ result: WalletTransferResponse; notifications: Notification[] }> {
  const replayOf = async () => {
    const existing = await prisma.walletTransfer.findUnique({
      where: { fromPartnerId_idempotencyKey: { fromPartnerId: senderId, idempotencyKey: input.idempotencyKey } },
      include: { toPartner: { select: { name: true, mobile: true } } },
    });
    if (!existing) return null;
    if (existing.toPartner.mobile !== input.mobile || !existing.points.equals(new Decimal(input.points).toDecimalPlaces(2))) {
      throw new HttpError(409, 'This request key was already used for a different transfer', 'IDEMPOTENCY_CONFLICT');
    }
    const settings = await getProgramSettings();
    const balance = await availablePoints(prisma, senderId);
    return {
      result: {
        transfer: senderView(existing),
        balancePoints: balance.toNumber(),
        rupeeValue: rupeeValueOf(balance, settings.pointsToRupees).toNumber(),
        replayed: true,
      },
      notifications: [],
    };
  };

  const replay = await replayOf();
  if (replay) return replay;

  const sender = await activeSender(senderId);
  const recipient = await recipientByMobile(senderId, input.mobile);
  await consumePartnerOtp(senderId, 'transfer', input.otp);

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Serialize spends of the sender's wallet so the balance cannot be spent twice.
        await lockWallet(tx, senderId);
        const settings = await getProgramSettings(tx);
        const ratio = settings.pointsToRupees;
        const points = new Decimal(input.points).toDecimalPlaces(2);
        const { soonestExpiry } = await spendWalletPoints(tx, senderId, points, 'Your wallet does not have enough for this amount');

        const transfer = await tx.walletTransfer.create({
          data: {
            transferNumber: generateTransferNumber(),
            fromPartnerId: senderId,
            toPartnerId: recipient.id,
            points,
            rupeeValue: rupeeValueOf(points, ratio),
            pointsRatioPoints: ratio.points,
            pointsRatioRupees: ratio.rupees,
            idempotencyKey: input.idempotencyKey,
          },
          include: { toPartner: { select: { name: true, mobile: true } } },
        });
        await tx.pointsEntry.create({
          data: {
            type: 'TRANSFER_IN',
            points,
            partnerId: recipient.id,
            transferId: transfer.id,
            expiresAt: soonestExpiry,
          },
        });
        const rows = transferNotificationRows({
          fromPartnerId: senderId,
          fromName: sender.name,
          toPartnerId: recipient.id,
          toName: recipient.name,
          points,
          transferNumber: transfer.transferNumber,
        });
        const notifications = await Promise.all(rows.map((data) => tx.notification.create({ data })));

        const balance = await availablePoints(tx, senderId);
        return {
          result: {
            transfer: senderView(transfer),
            balancePoints: balance.toNumber(),
            rupeeValue: rupeeValueOf(balance, ratio).toNumber(),
            replayed: false,
          },
          notifications,
        };
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
  } catch (error) {
    // A concurrent request with the same key won the insert: replay it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const again = await replayOf();
      if (again) return again;
    }
    throw error;
  }
}
