import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { Outlet as OutletRow, Partner } from '@prisma/client';
import type {
  BillCalculation,
  BillRecord,
  RedeemQr,
  RedeemScanResult,
  RedemptionReceipt,
  ScannedPartner,
} from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError, signToken, verifyToken } from './auth';
import {
  assertOutletCanTransact,
  billInclude,
  calculateRedeemBill,
  outletBillTerms,
  pricingVersion,
  serializeBill,
} from './billing';
import { getProgramSettings, requireConfiguredSettings } from './settings';
import { availablePoints, lockWallet, redeemQrWorth, rupeeValueOf, spendWalletPoints } from './points';
import { redeemedNotificationRow } from './partner-notifications';

/**
 * Wallet redemption. The partner generates a short-lived, single-use redeem QR in the app, worth
 * their whole wallet. It is one of the three QRs a bill can take (with the Personal Discount
 * QR and a Referral QR, never together): the Outlet Admin scans it, enters the bill, and the
 * wallet pays for up to half the bill (never more than the QR is worth or the live balance). The
 * customer pays the rest. Nothing is held when the QR is generated, so whatever the QR was worth
 * beyond what the bill used simply stays in the wallet. A redeem bill gets no discount and earns
 * no rewards. Points are spent from the soonest-expiring entries first. The QR carries only a
 * signed token: the partner and balance are always read from the database.
 */

const Decimal = Prisma.Decimal;

export const REDEEM_QR_PREFIX = 'LMW-RDM.';
export const REDEEM_QR_TTL_SEC = 10 * 60;

export function isRedeemQr(raw: string): boolean {
  return raw.trim().startsWith(REDEEM_QR_PREFIX);
}

function scannedPartner(partner: Partner): ScannedPartner {
  return {
    id: partner.id,
    partnerCode: partner.partnerCode,
    name: partner.name,
    mobile: partner.mobile,
    email: partner.email,
  };
}

/** The redeem QR is behind a Super Admin setting (off by default). 422, not 403: Outlet Admin apps sign out on 403s. */
function assertRedeemEnabled(settings: { redeemQrEnabled: boolean }) {
  if (!settings.redeemQrEnabled) {
    throw new HttpError(422, 'Wallet redemption is turned off', 'REDEEM_DISABLED');
  }
}

export async function createRedeemQr(partnerId: string): Promise<RedeemQr> {
  const settings = await getProgramSettings();
  assertRedeemEnabled(settings);
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new HttpError(404, 'Partner account not found', 'PARTNER_NOT_FOUND');
  if (partner.status !== 'ACTIVE') {
    throw new HttpError(403, 'This partner account is not active', 'PARTNER_INACTIVE');
  }

  const balance = await availablePoints(prisma, partnerId);
  const maxPoints = redeemQrWorth(balance);
  if (maxPoints.lte(0) || rupeeValueOf(maxPoints, settings.pointsToRupees).lte(0)) {
    throw new HttpError(422, 'Your wallet has nothing to redeem yet', 'NO_POINTS');
  }

  // The QR's worth is signed into it, so the outlet can never take more than the wallet held then.
  const token = signToken(
    { typ: 'redeem', partnerId, jti: crypto.randomUUID(), maxPoints: maxPoints.toString() },
    REDEEM_QR_TTL_SEC
  );
  return {
    code: `${REDEEM_QR_PREFIX}${token}`,
    expiresAt: new Date(Date.now() + REDEEM_QR_TTL_SEC * 1000).toISOString(),
    partner: {
      id: partner.id,
      partnerCode: partner.partnerCode,
      name: partner.name,
      mobile: partner.mobile,
    },
    balancePoints: balance.toNumber(),
    rupeeValue: rupeeValueOf(balance, settings.pointsToRupees).toNumber(),
    maxPoints: maxPoints.toNumber(),
    maxRupees: rupeeValueOf(maxPoints, settings.pointsToRupees).toNumber(),
    pointsRatio: { ...settings.pointsToRupees },
  };
}

/** Verifies the signature and expiry of a scanned redeem QR. */
function parseRedeemQr(raw: string) {
  const value = raw.trim();
  const payload = value.startsWith(REDEEM_QR_PREFIX) ? verifyToken(value.slice(REDEEM_QR_PREFIX.length)) : null;
  if (
    !payload ||
    payload.typ !== 'redeem' ||
    typeof payload.partnerId !== 'string' ||
    typeof payload.jti !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new HttpError(
      422,
      'This redeem QR has expired or is not valid. Ask the partner to generate a new one.',
      'REDEEM_QR_INVALID'
    );
  }
  // QRs generated before redeem bills carry no worth: the live balance applies to them.
  const maxPoints = typeof payload.maxPoints === 'string' ? new Decimal(payload.maxPoints) : null;
  return {
    partnerId: payload.partnerId,
    tokenId: payload.jti,
    maxPoints,
    expiresAt: new Date(payload.exp * 1000),
  };
}

async function activePartner(db: Prisma.TransactionClient | typeof prisma, partnerId: string) {
  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (!partner || partner.status !== 'ACTIVE') {
    throw new HttpError(422, 'The partner linked to this QR code is not active', 'PARTNER_INACTIVE');
  }
  return partner;
}

async function assertQrUnused(db: Prisma.TransactionClient | typeof prisma, tokenId: string) {
  if (await db.pointsRedemption.findUnique({ where: { tokenId }, select: { id: true } })) {
    throw new HttpError(409, 'This redeem QR has already been used. Ask the partner to generate a new one.', 'REDEEM_QR_USED');
  }
}

/** The QR's worth, capped by the live balance. */
function usableWorth(qrMaxPoints: Prisma.Decimal | null, balance: Prisma.Decimal) {
  const worth = qrMaxPoints ?? redeemQrWorth(balance);
  return Decimal.max(0, Decimal.min(worth, balance));
}

export async function scanRedeemQr(outlet: OutletRow, rawValue: string): Promise<RedeemScanResult> {
  assertOutletCanTransact(outlet);
  const { partnerId, tokenId, maxPoints, expiresAt } = parseRedeemQr(rawValue);
  await assertQrUnused(prisma, tokenId);

  const [partner, settings, balance] = await Promise.all([
    activePartner(prisma, partnerId),
    requireConfiguredSettings(),
    availablePoints(prisma, partnerId),
  ]);
  assertRedeemEnabled(settings);
  const worth = usableWorth(maxPoints, balance);
  const terms = outletBillTerms(settings, outlet);
  return {
    partner: scannedPartner(partner),
    balancePoints: balance.toNumber(),
    rupeeValue: rupeeValueOf(balance, settings.pointsToRupees).toNumber(),
    maxPoints: worth.toNumber(),
    maxRupees: rupeeValueOf(worth, settings.pointsToRupees).toNumber(),
    pointsRatio: { ...settings.pointsToRupees },
    gstPercentage: terms.gstPercentage,
    expiresAt: expiresAt.toISOString(),
    settingsVersion: pricingVersion(settings.updatedAt, terms.version),
  };
}

/** Bill preview for a redeem QR: what the wallet pays and what the customer pays. */
export async function previewRedeemBill(
  outlet: OutletRow,
  input: { qrCode: string; billAmount: number; customer?: unknown }
): Promise<BillCalculation> {
  assertOutletCanTransact(outlet);
  if (input.customer) {
    throw new HttpError(400, 'Customer details apply only to referral QR codes', 'CUSTOMER_NOT_ALLOWED');
  }
  const { partnerId, tokenId, maxPoints } = parseRedeemQr(input.qrCode);
  await assertQrUnused(prisma, tokenId);
  const [partner, settings, balance] = await Promise.all([
    activePartner(prisma, partnerId),
    requireConfiguredSettings(),
    availablePoints(prisma, partnerId),
  ]);
  assertRedeemEnabled(settings);
  return calculateRedeemBill(
    settings,
    { qrMaxPoints: usableWorth(maxPoints, balance), balancePoints: balance, partnerCategory: partner.category },
    input.billAmount,
    outletBillTerms(settings, outlet)
  );
}

function generateBillNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `LMW-B-${ymd}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Completes a redeem bill: spends the wallet part (at most half the bill) and records the bill and
 * the redemption in one transaction. Idempotent per (outlet, idempotencyKey); each redeem QR works
 * once.
 */
export async function createRedeemBill(
  outlet: OutletRow,
  adminId: string,
  input: {
    qrCode: string;
    billAmount: number;
    customer?: unknown;
    idempotencyKey: string;
    settingsVersion?: string;
    /** Old Outlet Admin apps only: the exact wallet amount asked for; refused if the bill cannot take it. */
    requestedRupees?: number;
  }
): Promise<{ bill: BillRecord; replayed: boolean }> {
  if (input.customer) {
    throw new HttpError(400, 'Customer details apply only to referral QR codes', 'CUSTOMER_NOT_ALLOWED');
  }
  const { partnerId, tokenId, maxPoints } = parseRedeemQr(input.qrCode);

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Re-read the outlet inside the transaction so a just-deactivated outlet cannot bill.
        const currentOutlet = await tx.outlet.findUniqueOrThrow({ where: { id: outlet.id } });
        assertOutletCanTransact(currentOutlet);

        // Serialize spends of the same wallet so the balance cannot be spent twice.
        await lockWallet(tx, partnerId);

        const replay = await tx.bill.findUnique({
          where: { outletId_idempotencyKey: { outletId: outlet.id, idempotencyKey: input.idempotencyKey } },
          include: { ...billInclude, redemption: { select: { tokenId: true } } },
        });
        if (replay) {
          const sameRequest =
            replay.redemption?.tokenId === tokenId && replay.billAmount.equals(new Decimal(input.billAmount).toDecimalPlaces(2));
          if (!sameRequest) {
            throw new HttpError(409, 'This request key was already used for a different bill', 'IDEMPOTENCY_CONFLICT');
          }
          return { bill: serializeBill(replay), replayed: true };
        }
        await assertQrUnused(tx, tokenId);

        const partner = await activePartner(tx, partnerId);
        const settings = await requireConfiguredSettings(tx);
        assertRedeemEnabled(settings);
        const balance = await availablePoints(tx, partnerId);
        const requested = input.requestedRupees === undefined ? undefined : new Decimal(input.requestedRupees).toDecimalPlaces(2);
        const calc = calculateRedeemBill(
          settings,
          {
            qrMaxPoints: usableWorth(maxPoints, balance),
            balancePoints: balance,
            partnerCategory: partner.category,
            requestedRupees: requested,
          },
          input.billAmount,
          outletBillTerms(settings, currentOutlet)
        );
        if (requested && requested.gt(calc.walletRedeemAmount)) {
          throw new HttpError(
            422,
            `At most ₹${calc.walletRedeemAmount.toFixed(2)} can be paid from the wallet on this bill (up to half the bill). Enter that amount or less.`,
            'REDEEM_OVER_LIMIT'
          );
        }
        if (input.settingsVersion && input.settingsVersion !== calc.settingsVersion) {
          throw new HttpError(
            409,
            "Programme settings or this outlet's offers were updated. Please review the updated amounts and confirm again.",
            'SETTINGS_CHANGED',
            { calculation: calc }
          );
        }
        if (calc.walletRedeemPoints <= 0) {
          throw new HttpError(422, 'The partner has nothing in the wallet to redeem', 'INSUFFICIENT_POINTS');
        }

        const points = new Decimal(calc.walletRedeemPoints);
        await spendWalletPoints(tx, partnerId, points, 'The partner does not have enough in the wallet for this amount');

        const created = await tx.bill.create({
          data: {
            billNumber: generateBillNumber(),
            outletId: outlet.id,
            qrCodeId: null,
            transactionType: 'WALLET_REDEEM',
            partnerId,
            isFirstTime: false,
            billAmount: calc.billAmount,
            discountPercentage: 0,
            discountAmount: 0,
            taxableAmount: calc.taxableAmount,
            gstPercentage: calc.gstPercentage,
            gstAmount: calc.gstAmount,
            walletRedeemPoints: calc.walletRedeemPoints,
            walletRedeemAmount: calc.walletRedeemAmount,
            finalAmount: calc.finalAmount,
            settingsVersion: new Date(settings.updatedAt),
            outletSettingsVersion: new Date(calc.outletSettingsVersion),
            partnerCategory: calc.partnerCategory,
            pointsRatioPoints: calc.pointsRatio.points,
            pointsRatioRupees: calc.pointsRatio.rupees,
            pointsBasis: calc.pointsBasis,
            notificationStatus: 'PENDING',
            idempotencyKey: input.idempotencyKey,
            createdByAdminId: adminId,
          },
        });
        await tx.pointsRedemption.create({
          data: {
            partnerId,
            outletId: outlet.id,
            createdByAdminId: adminId,
            points,
            rupeeValue: calc.walletRedeemAmount,
            billAmount: calc.billAmount,
            pointsRatioPoints: calc.pointsRatio.points,
            pointsRatioRupees: calc.pointsRatio.rupees,
            tokenId,
            billId: created.id,
          },
        });
        await tx.notification.create({
          data: {
            ...redeemedNotificationRow({
              partnerId,
              points,
              rupeeValue: new Decimal(calc.walletRedeemAmount),
              outletName: currentOutlet.name,
              billAmount: new Decimal(calc.billAmount),
            }),
            billId: created.id,
          },
        });

        const bill = await tx.bill.findUniqueOrThrow({ where: { id: created.id }, include: billInclude });
        return { bill: serializeBill(bill), replayed: false };
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
  } catch (error) {
    // A concurrent request with the same idempotency key won the insert: replay it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.bill.findUnique({
        where: { outletId_idempotencyKey: { outletId: outlet.id, idempotencyKey: input.idempotencyKey } },
        include: billInclude,
      });
      if (existing) return { bill: serializeBill(existing), replayed: true };
      throw new HttpError(409, 'This redeem QR has already been used. Ask the partner to generate a new one.', 'REDEEM_QR_USED');
    }
    throw error;
  }
}

/**
 * Wallet redemption from Outlet Admin app versions from before redeem bills (v1.0.0): they send the
 * bill and the rupees to take off, and expect a redemption receipt back. It becomes a redeem bill,
 * so the same rules apply (at most half the bill); an amount the bill cannot take is refused with
 * the most it can. The QR is the idempotency key, so a retry replays the same receipt.
 */
export async function createLegacyRedemption(
  outlet: OutletRow,
  adminId: string,
  input: { qrCode: string; rupees: number; billAmount?: number }
): Promise<{ receipt: RedemptionReceipt; bill: BillRecord }> {
  if (input.billAmount === undefined) {
    throw new HttpError(400, 'Enter the bill amount to redeem against', 'BILL_AMOUNT_REQUIRED');
  }
  const { partnerId, tokenId } = parseRedeemQr(input.qrCode);
  const { bill, replayed } = await createRedeemBill(outlet, adminId, {
    qrCode: input.qrCode,
    billAmount: input.billAmount,
    idempotencyKey: `legacy-redeem-${tokenId}`,
    requestedRupees: input.rupees,
  });

  const [partner, settings, balance] = await Promise.all([
    prisma.partner.findUniqueOrThrow({ where: { id: partnerId } }),
    getProgramSettings(),
    availablePoints(prisma, partnerId),
  ]);
  const receipt: RedemptionReceipt = {
    id: bill.id,
    points: bill.walletRedeemPoints,
    rupeeValue: bill.walletRedeemAmount,
    billAmount: bill.billAmount,
    payableAmount: bill.finalAmount,
    partner: scannedPartner(partner),
    outlet: bill.outlet,
    balancePoints: balance.toNumber(),
    balanceRupeeValue: rupeeValueOf(balance, settings.pointsToRupees).toNumber(),
    createdAt: bill.createdAt,
    replayed,
  };
  return { receipt, bill };
}
