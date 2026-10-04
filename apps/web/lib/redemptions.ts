import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { Notification, Outlet as OutletRow, Partner } from '@prisma/client';
import type { RedeemQr, RedeemScanResult, RedemptionReceipt, ScannedPartner } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError, signToken, verifyToken } from './auth';
import { assertOutletCanTransact } from './billing';
import { getProgramSettings, requireConfiguredSettings } from './settings';
import { availablePoints, rupeeValueOf, unexpiredPoints } from './points';
import { redeemedNotificationRow } from './partner-notifications';

/**
 * Wallet redemption. The partner generates a short-lived, single-use redeem QR in the app;
 * the Outlet Admin scans it, sees the partner and their live balance, enters the bill and takes
 * a rupee amount (never more than the bill) off it. Points are spent from the soonest-expiring entries first.
 * The QR carries only a signed token: the partner, balance and worth are always read from
 * the database when it is scanned.
 */

const Decimal = Prisma.Decimal;

export const REDEEM_QR_PREFIX = 'LMW-RDM.';
export const REDEEM_QR_TTL_SEC = 10 * 60;

export function isRedeemQr(raw: string): boolean {
  return raw.trim().startsWith(REDEEM_QR_PREFIX);
}

function scannedPartner(partner: Partner): ScannedPartner {
  return { id: partner.id, partnerCode: partner.partnerCode, name: partner.name, mobile: partner.mobile, email: partner.email };
}

export async function createRedeemQr(partnerId: string): Promise<RedeemQr> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new HttpError(404, 'Partner account not found', 'PARTNER_NOT_FOUND');
  if (partner.status !== 'ACTIVE') {
    throw new HttpError(403, 'This partner account is not active', 'PARTNER_INACTIVE');
  }

  const [settings, balance] = await Promise.all([getProgramSettings(), availablePoints(prisma, partnerId)]);
  if (balance.lte(0)) {
    throw new HttpError(422, 'You have no points to redeem yet', 'NO_POINTS');
  }

  const token = signToken({ typ: 'redeem', partnerId, jti: crypto.randomUUID() }, REDEEM_QR_TTL_SEC);
  return {
    code: `${REDEEM_QR_PREFIX}${token}`,
    expiresAt: new Date(Date.now() + REDEEM_QR_TTL_SEC * 1000).toISOString(),
    partner: { id: partner.id, partnerCode: partner.partnerCode, name: partner.name, mobile: partner.mobile },
    balancePoints: balance.toNumber(),
    rupeeValue: rupeeValueOf(balance, settings.pointsToRupees).toNumber(),
    pointsRatio: { ...settings.pointsToRupees },
  };
}

/** Verifies the signature and expiry of a scanned redeem QR. */
function parseRedeemQr(raw: string) {
  const value = raw.trim();
  const payload = value.startsWith(REDEEM_QR_PREFIX) ? verifyToken(value.slice(REDEEM_QR_PREFIX.length)) : null;
  if (!payload || payload.typ !== 'redeem' || typeof payload.partnerId !== 'string' || typeof payload.jti !== 'string') {
    throw new HttpError(
      422,
      'This redeem QR has expired or is not valid. Ask the partner to generate a new one.',
      'REDEEM_QR_INVALID'
    );
  }
  return { partnerId: payload.partnerId, tokenId: payload.jti, expiresAt: new Date(payload.exp * 1000) };
}

async function activePartner(db: Prisma.TransactionClient | typeof prisma, partnerId: string) {
  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (!partner || partner.status !== 'ACTIVE') {
    throw new HttpError(422, 'The partner linked to this QR code is not active', 'PARTNER_INACTIVE');
  }
  return partner;
}

export async function scanRedeemQr(outlet: OutletRow, rawValue: string): Promise<RedeemScanResult> {
  assertOutletCanTransact(outlet);
  const { partnerId, tokenId, expiresAt } = parseRedeemQr(rawValue);
  if (await prisma.pointsRedemption.findUnique({ where: { tokenId }, select: { id: true } })) {
    throw new HttpError(409, 'This redeem QR has already been used. Ask the partner to generate a new one.', 'REDEEM_QR_USED');
  }

  const [partner, settings, balance] = await Promise.all([
    activePartner(prisma, partnerId),
    requireConfiguredSettings(),
    availablePoints(prisma, partnerId),
  ]);
  return {
    partner: scannedPartner(partner),
    balancePoints: balance.toNumber(),
    rupeeValue: rupeeValueOf(balance, settings.pointsToRupees).toNumber(),
    pointsRatio: { ...settings.pointsToRupees },
    expiresAt: expiresAt.toISOString(),
  };
}

type RedemptionRow = Prisma.PointsRedemptionGetPayload<{ include: { partner: true; outlet: { select: { id: true; name: true } } } }>;

async function receipt(
  db: Prisma.TransactionClient | typeof prisma,
  redemption: RedemptionRow,
  replayed: boolean
): Promise<RedemptionReceipt> {
  const [settings, balance] = await Promise.all([getProgramSettings(db), availablePoints(db, redemption.partnerId)]);
  return {
    id: redemption.id,
    points: redemption.points.toNumber(),
    rupeeValue: redemption.rupeeValue.toNumber(),
    billAmount: redemption.billAmount?.toNumber() ?? null,
    payableAmount: redemption.billAmount ? redemption.billAmount.minus(redemption.rupeeValue).toNumber() : null,
    partner: scannedPartner(redemption.partner),
    outlet: redemption.outlet,
    balancePoints: balance.toNumber(),
    balanceRupeeValue: rupeeValueOf(balance, settings.pointsToRupees).toNumber(),
    createdAt: redemption.createdAt.toISOString(),
    replayed,
  };
}

const redemptionInclude = { partner: true, outlet: { select: { id: true, name: true } } } as const;

export async function redeemPoints(
  outlet: OutletRow,
  adminId: string,
  input: { qrCode: string; rupees: number; billAmount?: number }
): Promise<{ receipt: RedemptionReceipt; notification: Notification | null }> {
  const { partnerId, tokenId } = parseRedeemQr(input.qrCode);

  return prisma.$transaction(
    async (tx) => {
      // Re-read the outlet inside the transaction so a just-deactivated outlet cannot redeem.
      const currentOutlet = await tx.outlet.findUniqueOrThrow({ where: { id: outlet.id } });
      assertOutletCanTransact(currentOutlet);

      // Serialize redemptions of the same wallet so the balance cannot be spent twice.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${partnerId}`}))`;

      // Each redeem QR works once; the same outlet retrying gets the original result back.
      const used = await tx.pointsRedemption.findUnique({ where: { tokenId }, include: redemptionInclude });
      if (used) {
        if (used.outletId !== outlet.id) {
          throw new HttpError(409, 'This redeem QR has already been used', 'REDEEM_QR_USED');
        }
        return { receipt: await receipt(tx, used, true), notification: null };
      }

      await activePartner(tx, partnerId);
      const settings = await requireConfiguredSettings(tx);
      const ratio = settings.pointsToRupees;

      const rupees = new Decimal(input.rupees).toDecimalPlaces(2);
      const billAmount = input.billAmount === undefined ? null : new Decimal(input.billAmount).toDecimalPlaces(2);
      if (billAmount && rupees.gt(billAmount)) {
        throw new HttpError(422, 'The amount to redeem cannot be more than the bill', 'REDEEM_EXCEEDS_BILL');
      }
      const points = rupees.mul(ratio.points).div(ratio.rupees).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Soonest-expiring points are spent first; points that never expire last.
      const entries = await tx.pointsEntry.findMany({
        where: { partnerId, ...unexpiredPoints() },
        orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
        select: { id: true, points: true, redeemedPoints: true },
      });
      const balance = entries.reduce((sum, e) => sum.plus(e.points).minus(e.redeemedPoints), new Decimal(0));
      if (points.lte(0) || points.gt(balance)) {
        throw new HttpError(
          422,
          points.lte(0) ? 'The amount is too small to redeem' : 'The partner does not have enough points for this amount',
          'INSUFFICIENT_POINTS',
          { balancePoints: balance.toNumber(), rupeeValue: rupeeValueOf(balance, ratio).toNumber() }
        );
      }

      let remaining = points;
      for (const entry of entries) {
        if (remaining.lte(0)) break;
        const spend = Decimal.min(remaining, entry.points.minus(entry.redeemedPoints));
        if (spend.lte(0)) continue;
        await tx.pointsEntry.update({ where: { id: entry.id }, data: { redeemedPoints: { increment: spend } } });
        remaining = remaining.minus(spend);
      }

      const redemption = await tx.pointsRedemption.create({
        data: {
          partnerId,
          outletId: outlet.id,
          createdByAdminId: adminId,
          points,
          rupeeValue: rupees,
          billAmount,
          pointsRatioPoints: ratio.points,
          pointsRatioRupees: ratio.rupees,
          tokenId,
        },
        include: redemptionInclude,
      });
      const notification = await tx.notification.create({
        data: redeemedNotificationRow({ partnerId, points, rupeeValue: rupees, outletName: currentOutlet.name }),
      });

      return { receipt: await receipt(tx, redemption, false), notification };
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
}
