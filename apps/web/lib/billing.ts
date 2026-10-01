import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { Outlet as OutletRow, Partner, QRCode } from '@prisma/client';
import type {
  BillCalculation,
  BillRecord,
  BillTransactionType,
  CustomerLookup,
  PartnerClassification,
  PurchasePointsRecipient,
  ReferredCustomerInput,
  ScanResult,
} from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';
import { requireConfiguredSettings, type ConfiguredProgramSettings } from './settings';

/**
 * Billing engine. Everything that affects money, points or eligibility is decided here,
 * from persisted data only: QR validity/type, partner identity/type/status, first-time
 * status, and every percentage/ratio from the saved Super Admin settings (the single
 * source; nothing is hardcoded and billing is refused until settings are saved).
 * Callers pass only the raw scanned value, the bill amount and (for referrals) the
 * referred customer's details.
 */

type Db = Prisma.TransactionClient | typeof prisma;
const Decimal = Prisma.Decimal;

const QR_CODE_PATTERN = /^LMW-(DISC|REF)-[0-9A-F]{16}$/;

/** Accepts the bare permanent token or a URL whose last path segment is the token. */
export function extractQrToken(raw: string): string {
  let value = raw.trim();
  if (/^https?:\/\//i.test(value)) {
    value = value.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
  }
  return value.toUpperCase();
}

export function classify(partner: Pick<Partner, 'isAchariyaAssociated'>): PartnerClassification {
  return partner.isAchariyaAssociated ? 'ACHARIYA' : 'NON_ACHARIYA';
}

function transactionTypeFor(qr: Pick<QRCode, 'type'>): BillTransactionType {
  return qr.type === 'DEFAULT_DISCOUNT' ? 'DIRECT_PARTNER' : 'REFERRAL';
}

export function assertOutletCanTransact(outlet: Pick<OutletRow, 'status'>) {
  if (outlet.status !== 'ACTIVE') {
    throw new HttpError(403, 'This outlet is inactive and cannot process transactions', 'OUTLET_INACTIVE');
  }
}

/** Validates the QR against the database: exists, active, well-typed, owned by an active partner. */
export async function resolveQr(db: Db, rawValue: string) {
  const token = extractQrToken(rawValue);
  const match = QR_CODE_PATTERN.exec(token);
  if (!match) {
    throw new HttpError(404, 'This is not a Lot More Wins partner QR code', 'INVALID_QR');
  }

  const qr = await db.qRCode.findUnique({ where: { code: token }, include: { partner: true } });
  if (!qr) {
    throw new HttpError(404, 'QR code not recognised', 'INVALID_QR');
  }

  const expectedType = match[1] === 'DISC' ? 'DEFAULT_DISCOUNT' : 'REFERRAL';
  if (qr.type !== expectedType) {
    throw new HttpError(422, 'QR code type is invalid', 'INVALID_QR_TYPE');
  }
  if (qr.status !== 'ACTIVE') {
    throw new HttpError(422, 'This QR code is no longer active', 'QR_INACTIVE');
  }
  if (!qr.partner || qr.partner.status !== 'ACTIVE') {
    throw new HttpError(422, 'The partner linked to this QR code is not active', 'PARTNER_INACTIVE');
  }
  return qr;
}

type ResolvedQr = Awaited<ReturnType<typeof resolveQr>>;

/**
 * First-time status is determined across the whole programme (not per outlet):
 * a direct partner is first-time until they have a completed DIRECT_PARTNER bill (this is
 * the register bonus, and also applies to a customer who later registers as a partner);
 * a referred customer is first-time until their mobile has a completed bill.
 * The register bonus lapses settings.firstTimeValidityDays after the partner registered
 * (0 = never), after which their first bill is treated as a repeat sale.
 */
async function isFirstTimeDirect(db: Db, partner: { id: string; createdAt: Date }, validityDays: number) {
  if (validityDays > 0 && Date.now() > partner.createdAt.getTime() + validityDays * 86_400_000) return false;
  return (await db.bill.count({ where: { partnerId: partner.id, transactionType: 'DIRECT_PARTNER' } })) === 0;
}

/** Expiry stamped on points when they are earned; null when the validity setting is 0 (never). */
function pointsExpiry(validityDays: number): Date | null {
  return validityDays > 0 ? new Date(Date.now() + validityDays * 86_400_000) : null;
}

async function isFirstTimeCustomer(db: Db, mobile: string) {
  return (await db.bill.count({ where: { customer: { mobile } } })) === 0;
}

// ============================================================================
// Settings -> money and points (the only place this mapping happens)
// ============================================================================

export function discountPercentageFor(
  settings: ConfiguredProgramSettings,
  qrType: QRCode['type'],
  classification: PartnerClassification,
  isFirstTime: boolean
): number {
  const table =
    qrType === 'REFERRAL' ? settings.referralDiscount : isFirstTime ? settings.firstTimeDiscount : settings.repeatDiscount;
  return classification === 'ACHARIYA' ? table.achariya : table.nonAchariya;
}

export interface BillContext {
  qrType: QRCode['type'];
  /** Classification of the QR owner (direct partner, or referring partner). */
  classification: PartnerClassification;
  isFirstTime: boolean;
  /** Referral only: the customer's mobile belongs to a registered partner. */
  customerIsPartner: boolean;
}

const roundMoney = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/**
 * Pure calculation of a bill from the saved settings.
 * points = base × percentage ÷ 100 × (ratio points ÷ ratio rupees),
 * where base is the bill or payable amount according to settings.pointsBasis.
 */
export function calculateBill(settings: ConfiguredProgramSettings, ctx: BillContext, billAmount: number): BillCalculation {
  const discountPercentage = discountPercentageFor(settings, ctx.qrType, ctx.classification, ctx.isFirstTime);
  const amount = new Decimal(billAmount).toDecimalPlaces(2);
  const discountAmount = roundMoney(amount.mul(discountPercentage).div(100));
  const finalAmount = amount.minus(discountAmount);

  const pointsBase = settings.pointsBasis === 'BILL_AMOUNT' ? amount : finalAmount;
  const pointsPerRupee = new Decimal(settings.pointsToRupees.points).div(settings.pointsToRupees.rupees);
  const pointsFor = (percentage: number) => roundMoney(pointsBase.mul(percentage).div(100).mul(pointsPerRupee));

  const isReferral = ctx.qrType === 'REFERRAL';
  const referralPointsPercentage = isReferral
    ? ctx.classification === 'ACHARIYA'
      ? settings.referralPoints.achariya
      : settings.referralPoints.nonAchariya
    : 0;
  const purchasePointsRecipient: PurchasePointsRecipient = !isReferral
    ? 'PARTNER'
    : ctx.customerIsPartner
      ? 'CUSTOMER_PARTNER'
      : 'CUSTOMER_PENDING';

  return {
    transactionType: isReferral ? 'REFERRAL' : 'DIRECT_PARTNER',
    classification: ctx.classification,
    isFirstTime: ctx.isFirstTime,
    billAmount: amount.toNumber(),
    discountPercentage,
    discountAmount: discountAmount.toNumber(),
    finalAmount: finalAmount.toNumber(),
    pointsBasis: settings.pointsBasis,
    pointsBaseAmount: pointsBase.toNumber(),
    pointsRatio: { ...settings.pointsToRupees },
    purchasePointsPercentage: settings.purchasePointsPercentage,
    purchasePoints: pointsFor(settings.purchasePointsPercentage).toNumber(),
    purchasePointsRecipient,
    referralPointsPercentage,
    referralPoints: isReferral ? pointsFor(referralPointsPercentage).toNumber() : 0,
    settingsVersion: settings.updatedAt,
  };
}

function assertCustomerMatchesQr(qr: ResolvedQr, customer: ReferredCustomerInput | undefined) {
  if (qr.type === 'REFERRAL') {
    if (!customer) {
      throw new HttpError(400, 'Referred customer details are required for a referral bill', 'CUSTOMER_REQUIRED');
    }
    if (customer.mobile === qr.partner.mobile) {
      throw new HttpError(422, 'A partner cannot use their own referral QR code', 'SELF_REFERRAL');
    }
  } else if (customer) {
    throw new HttpError(400, 'Customer details apply only to referral QR codes', 'CUSTOMER_NOT_ALLOWED');
  }
}

/** Partner registered with the referred customer's mobile, if any. */
async function partnerIdForMobile(db: Db, mobile: string): Promise<string | null> {
  const partner = await db.partner.findUnique({ where: { mobile }, select: { id: true } });
  return partner?.id ?? null;
}

async function buildContext(
  db: Db,
  settings: ConfiguredProgramSettings,
  qr: ResolvedQr,
  customer: ReferredCustomerInput | undefined
) {
  const isDirect = qr.type === 'DEFAULT_DISCOUNT';
  const customerPartnerId = !isDirect && customer ? await partnerIdForMobile(db, customer.mobile) : null;
  const ctx: BillContext = {
    qrType: qr.type,
    classification: classify(qr.partner),
    isFirstTime: isDirect
      ? await isFirstTimeDirect(db, qr.partner, settings.firstTimeValidityDays)
      : await isFirstTimeCustomer(db, customer!.mobile),
    customerIsPartner: customerPartnerId !== null,
  };
  return { ctx, customerPartnerId };
}

// ============================================================================
// Scan, lookup, preview and create
// ============================================================================

export async function scanQr(outlet: OutletRow, rawValue: string): Promise<ScanResult> {
  assertOutletCanTransact(outlet);
  const settings = await requireConfiguredSettings();
  const qr = await resolveQr(prisma, rawValue);
  const classification = classify(qr.partner);

  // Referral discount depends only on the referring partner; first-time status of a
  // referred customer is unknown until their mobile is entered.
  const isFirstTime =
    qr.type === 'DEFAULT_DISCOUNT' ? await isFirstTimeDirect(prisma, qr.partner, settings.firstTimeValidityDays) : null;
  const discountPercentage = discountPercentageFor(settings, qr.type, classification, isFirstTime ?? false);

  return {
    qrType: qr.type,
    transactionType: transactionTypeFor(qr),
    partner: {
      id: qr.partner.id,
      partnerCode: qr.partner.partnerCode,
      name: qr.partner.name,
      mobile: qr.partner.mobile,
      email: qr.partner.email,
      classification,
    },
    discount: { classification, isFirstTime, discountPercentage },
    settingsVersion: settings.updatedAt,
  };
}

/** Prefill for the referral customer form: a known customer, or a registered partner with that mobile. */
export async function lookupCustomer(mobile: string): Promise<CustomerLookup | null> {
  const [customer, partner] = await Promise.all([
    prisma.customer.findUnique({ where: { mobile }, select: { name: true, email: true } }),
    prisma.partner.findUnique({ where: { mobile }, select: { name: true, email: true } }),
  ]);
  const source = customer ?? partner;
  if (!source) return null;
  return { mobile, name: source.name, email: source.email ?? partner?.email ?? null, isPartner: partner !== null };
}

export async function previewBill(
  outlet: OutletRow,
  input: { qrCode: string; billAmount: number; customer?: ReferredCustomerInput }
): Promise<BillCalculation> {
  assertOutletCanTransact(outlet);
  const settings = await requireConfiguredSettings();
  const qr = await resolveQr(prisma, input.qrCode);
  assertCustomerMatchesQr(qr, input.customer);
  const { ctx } = await buildContext(prisma, settings, qr, input.customer);
  return calculateBill(settings, ctx, input.billAmount);
}

const partnerSelect = { id: true, name: true, mobile: true, email: true, partnerCode: true, isAchariyaAssociated: true } as const;

export const billInclude = {
  outlet: { select: { id: true, name: true } },
  qrCode: { select: { type: true } },
  partner: { select: partnerSelect },
  referrerPartner: { select: partnerSelect },
  customer: { select: { id: true, name: true, mobile: true, email: true, partnerId: true } },
  pointEntries: { select: { type: true, partnerId: true } },
} satisfies Prisma.BillInclude;

export type BillWithRelations = Prisma.BillGetPayload<{ include: typeof billInclude }>;

function purchaseRecipientOf(bill: BillWithRelations): PurchasePointsRecipient {
  if (bill.transactionType === 'DIRECT_PARTNER') return 'PARTNER';
  const entry = bill.pointEntries.find((e) => e.type === 'PURCHASE');
  const credited = entry ? entry.partnerId !== null : bill.customer?.partnerId != null;
  return credited ? 'CUSTOMER_PARTNER' : 'CUSTOMER_PENDING';
}

export function serializeBill(bill: BillWithRelations): BillRecord {
  const owner = bill.partner ?? bill.referrerPartner;
  const person = (p: BillWithRelations['partner']) =>
    p ? { id: p.id, name: p.name, mobile: p.mobile, partnerCode: p.partnerCode } : null;
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    qrType: bill.qrCode.type,
    transactionType: bill.transactionType,
    classification: owner ? classify(owner) : 'NON_ACHARIYA',
    isFirstTime: bill.isFirstTime,
    billAmount: bill.billAmount.toNumber(),
    discountPercentage: bill.discountPercentage.toNumber(),
    discountAmount: bill.discountAmount.toNumber(),
    finalAmount: bill.finalAmount.toNumber(),
    pointsBasis: bill.pointsBasis,
    pointsBaseAmount: (bill.pointsBasis === 'BILL_AMOUNT' ? bill.billAmount : bill.finalAmount).toNumber(),
    pointsRatio: { points: bill.pointsRatioPoints.toNumber(), rupees: bill.pointsRatioRupees.toNumber() },
    purchasePointsPercentage: bill.purchasePointsPercentage.toNumber(),
    purchasePoints: bill.purchasePoints.toNumber(),
    purchasePointsRecipient: purchaseRecipientOf(bill),
    referralPointsPercentage: bill.referralPointsPercentage.toNumber(),
    referralPoints: bill.referralPoints.toNumber(),
    settingsVersion: bill.settingsVersion?.toISOString() ?? null,
    createdAt: bill.createdAt.toISOString(),
    outlet: bill.outlet,
    partner: person(bill.partner),
    referrerPartner: person(bill.referrerPartner),
    customer: bill.customer
      ? { id: bill.customer.id, name: bill.customer.name, mobile: bill.customer.mobile, email: bill.customer.email }
      : null,
    notification: {
      status: bill.notificationStatus,
      channel: bill.notificationChannel === 'WHATSAPP' ? 'whatsapp' : bill.notificationChannel === 'EMAIL' ? 'email' : null,
      recipient: bill.notificationRecipient,
      error: bill.notificationError,
      attempts: bill.notificationAttempts,
      sentAt: bill.notificationSentAt?.toISOString() ?? null,
    },
  };
}

/** Window in which an identical bill (same outlet, QR, amount, customer) is treated as a duplicate submission. */
const DUPLICATE_WINDOW_MS = 60_000;

function generateBillNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `LMW-B-${ymd}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function createBill(
  outlet: OutletRow,
  adminId: string,
  input: {
    qrCode: string;
    billAmount: number;
    customer?: ReferredCustomerInput;
    idempotencyKey: string;
    settingsVersion?: string;
  }
): Promise<{ bill: BillRecord; replayed: boolean }> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Re-read the outlet inside the transaction so a just-deactivated outlet cannot bill.
        const currentOutlet = await tx.outlet.findUniqueOrThrow({ where: { id: outlet.id } });
        assertOutletCanTransact(currentOutlet);

        const qr = await resolveQr(tx, input.qrCode);
        assertCustomerMatchesQr(qr, input.customer);

        // Serialize concurrent bills for the same QR (and referred customer) so that
        // idempotency, duplicate detection and first-time status cannot race.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bill:qr:${qr.id}`}))`;
        if (input.customer) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bill:cust:${input.customer.mobile}`}))`;
        }

        const replay = await tx.bill.findUnique({
          where: { outletId_idempotencyKey: { outletId: outlet.id, idempotencyKey: input.idempotencyKey } },
          include: billInclude,
        });
        if (replay) {
          const sameRequest =
            replay.qrCodeId === qr.id &&
            replay.billAmount.equals(new Decimal(input.billAmount).toDecimalPlaces(2)) &&
            (replay.customer?.mobile ?? null) === (input.customer?.mobile ?? null);
          if (!sameRequest) {
            throw new HttpError(409, 'This request key was already used for a different bill', 'IDEMPOTENCY_CONFLICT');
          }
          return { bill: serializeBill(replay), replayed: true };
        }

        const duplicate = await tx.bill.findFirst({
          where: {
            outletId: outlet.id,
            qrCodeId: qr.id,
            billAmount: new Decimal(input.billAmount).toDecimalPlaces(2),
            customer: input.customer ? { mobile: input.customer.mobile } : undefined,
            createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
          },
          select: { billNumber: true },
        });
        if (duplicate) {
          throw new HttpError(
            409,
            `An identical bill (${duplicate.billNumber}) was completed moments ago`,
            'DUPLICATE_BILL'
          );
        }

        // Settings are read inside the transaction; this bill is calculated and stored with exactly these values.
        const settings = await requireConfiguredSettings(tx);
        // Calculate before creating the customer so first-time status reflects prior bills only.
        const { ctx, customerPartnerId } = await buildContext(tx, settings, qr, input.customer);
        const calc = calculateBill(settings, ctx, input.billAmount);

        if (input.settingsVersion && input.settingsVersion !== settings.updatedAt) {
          throw new HttpError(
            409,
            'Programme settings were updated by the Super Admin. Please review the updated amounts and confirm again.',
            'SETTINGS_CHANGED',
            { calculation: calc }
          );
        }

        let customerId: string | null = null;
        if (input.customer) {
          const customer = await tx.customer.upsert({
            where: { mobile: input.customer.mobile },
            create: {
              mobile: input.customer.mobile,
              name: input.customer.name,
              email: input.customer.email ?? null,
              partnerId: customerPartnerId,
            },
            update: {
              name: input.customer.name,
              ...(input.customer.email ? { email: input.customer.email } : {}),
              ...(customerPartnerId ? { partnerId: customerPartnerId } : {}),
            },
          });
          customerId = customer.id;
        }

        const isDirect = qr.type === 'DEFAULT_DISCOUNT';
        const created = await tx.bill.create({
          data: {
            billNumber: generateBillNumber(),
            outletId: outlet.id,
            qrCodeId: qr.id,
            transactionType: calc.transactionType,
            partnerId: isDirect ? qr.partner.id : null,
            referrerPartnerId: isDirect ? null : qr.partner.id,
            customerId,
            isFirstTime: calc.isFirstTime,
            billAmount: calc.billAmount,
            discountPercentage: calc.discountPercentage,
            discountAmount: calc.discountAmount,
            finalAmount: calc.finalAmount,
            settingsVersion: new Date(settings.updatedAt),
            purchasePointsPercentage: calc.purchasePointsPercentage,
            referralPointsPercentage: calc.referralPointsPercentage,
            pointsRatioPoints: calc.pointsRatio.points,
            pointsRatioRupees: calc.pointsRatio.rupees,
            pointsBasis: calc.pointsBasis,
            purchasePoints: calc.purchasePoints,
            referralPoints: calc.referralPoints,
            notificationStatus: 'PENDING',
            idempotencyKey: input.idempotencyKey,
            createdByAdminId: adminId,
          },
        });

        // Points ledger: credited in the same transaction as the bill.
        const entries: Prisma.PointsEntryCreateManyInput[] = [];
        if (calc.purchasePoints > 0) {
          entries.push(
            isDirect
              ? {
                  type: 'PURCHASE',
                  points: calc.purchasePoints,
                  billId: created.id,
                  partnerId: qr.partner.id,
                  expiresAt: pointsExpiry(settings.purchasePointsValidityDays),
                }
              : {
                  type: 'PURCHASE',
                  points: calc.purchasePoints,
                  billId: created.id,
                  customerId,
                  partnerId: customerPartnerId,
                  expiresAt: pointsExpiry(settings.purchasePointsValidityDays),
                }
          );
        }
        if (calc.referralPoints > 0) {
          entries.push({
            type: 'REFERRAL',
            points: calc.referralPoints,
            billId: created.id,
            partnerId: qr.partner.id,
            expiresAt: pointsExpiry(settings.referralPointsValidityDays),
          });
        }
        if (entries.length) await tx.pointsEntry.createMany({ data: entries });

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
    }
    throw error;
  }
}

export type BillHistoryRange = 'today' | 'all';

export function startOfTodayIst() {
  // Outlets operate in India; "today" is the IST calendar day.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + istOffsetMs);
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - istOffsetMs);
}

export async function listOutletBills(outletId: string, page: number, limit: number, range: BillHistoryRange = 'all') {
  const where: Prisma.BillWhereInput = {
    outletId,
    ...(range === 'today' ? { createdAt: { gte: startOfTodayIst() } } : {}),
  };
  const [total, bills, sums] = await prisma.$transaction([
    prisma.bill.count({ where }),
    prisma.bill.findMany({
      where,
      include: billInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bill.aggregate({
      where,
      _sum: { billAmount: true, discountAmount: true, finalAmount: true, purchasePoints: true, referralPoints: true },
    }),
  ]);
  const n = (d: Prisma.Decimal | null) => d?.toNumber() ?? 0;
  return {
    total,
    bills: bills.map(serializeBill),
    summary: {
      billCount: total,
      billAmount: n(sums._sum.billAmount),
      discountAmount: n(sums._sum.discountAmount),
      finalAmount: n(sums._sum.finalAmount),
      purchasePoints: n(sums._sum.purchasePoints),
      referralPoints: n(sums._sum.referralPoints),
    },
  };
}

export async function getOutletBill(outletId: string, billId: string) {
  const bill = await prisma.bill.findFirst({ where: { id: billId, outletId }, include: billInclude });
  if (!bill) throw new HttpError(404, 'Bill not found', 'BILL_NOT_FOUND');
  return bill;
}
