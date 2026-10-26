import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { Outlet as OutletRow, Partner, QRCode } from '@prisma/client';
import type {
  BillCalculation,
  BillRecord,
  BillTransactionType,
  CustomerLookup,
  PurchasePointsRecipient,
  ReferredCustomerInput,
  ScanResult,
} from '@lotmorewins/types';
import type { OutletEffectiveDiscounts, OutletEffectiveRewards, PartnerCategory } from '@lotmorewins/types';
import { MAX_BILL_REDUCTION_PERCENT } from '@lotmorewins/validation';
import prisma from './prisma';
import { HttpError } from './auth';
import { requireConfiguredSettings, type ConfiguredProgramSettings } from './settings';
import { birthdayBonusFor } from './partners';
import { billNotificationRows, referralRewardNotificationRow } from './partner-notifications';
import { referralProgress } from './referral-rewards';
import { effectiveDiscounts, effectiveRewards, programmeDiscounts, programmeRewards } from './outlet-offers';
import { rupeeValueOf } from './points';

/**
 * Billing engine. Everything that affects money, points or eligibility is decided here,
 * from persisted data only: QR validity/type, partner identity/status, first-time
 * status, the partner's birthday, and every percentage/ratio from the saved Super Admin settings (the single
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

  const qr = await db.qRCode.findUnique({
    where: { code: token },
    include: { partner: true },
  });
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

/** The register bonus lapses settings.firstTimeValidityDays after the partner registered (0 = never). */
export function firstTimeWindowOpen(partner: Pick<Partner, 'createdAt'>, validityDays: number, now = Date.now()) {
  return validityDays <= 0 || now <= partner.createdAt.getTime() + validityDays * 86_400_000;
}

/**
 * First-time status is per outlet: each outlet gives its first-time discount on the first bill
 * there and its repeat discount after that.
 * - A direct partner is first-time at an outlet until they have a DIRECT_PARTNER bill there (this
 *   is the register bonus, and also applies to a customer who later registers as a partner), and
 *   only while the register bonus window is open; after it their first bill is a repeat sale.
 * - A referred customer is first-time at an outlet until their mobile has a bill there.
 */
export async function isFirstTimeDirect(
  db: Db,
  partner: Pick<Partner, 'id' | 'createdAt'>,
  validityDays: number,
  outletId: string
) {
  if (!firstTimeWindowOpen(partner, validityDays)) return false;
  return (
    (await db.bill.count({
      where: { partnerId: partner.id, outletId, transactionType: 'DIRECT_PARTNER' },
    })) === 0
  );
}

/** Expiry stamped on points when they are earned; null when the validity setting is 0 (never). */
function pointsExpiry(validityDays: number): Date | null {
  return validityDays > 0 ? new Date(Date.now() + validityDays * 86_400_000) : null;
}

async function isFirstTimeCustomer(db: Db, mobile: string, outletId: string) {
  return (await db.bill.count({ where: { outletId, customer: { mobile } } })) === 0;
}

// ============================================================================
// Settings -> money and points (the only place this mapping happens)
// ============================================================================

/** What the bill's outlet contributes: its discounts and rewards (overrides resolved), GST and cash reward. */
export interface OutletBillTerms {
  discounts: OutletEffectiveDiscounts;
  rewards: OutletEffectiveRewards;
  gstPercentage: number;
  givesCashReward: boolean;
  /** The outlet's offer settings version (offersUpdatedAt). */
  version: string;
}

type OutletOfferRow = Parameters<typeof effectiveDiscounts>[1];

export function outletBillTerms(settings: ConfiguredProgramSettings, outlet: OutletOfferRow): OutletBillTerms {
  return {
    discounts: effectiveDiscounts(settings, outlet),
    rewards: effectiveRewards(settings, outlet),
    gstPercentage: outlet.gstPercentage.toNumber(),
    givesCashReward: outlet.givesCashReward,
    version: outlet.offersUpdatedAt.toISOString(),
  };
}

/** Programme discounts only, no GST and no cash reward: how every bill was calculated before outlet offers. */
export function programmeBillTerms(settings: ConfiguredProgramSettings): OutletBillTerms {
  return {
    discounts: programmeDiscounts(settings),
    rewards: programmeRewards(settings),
    gstPercentage: 0,
    givesCashReward: false,
    version: settings.updatedAt,
  };
}

/**
 * The version a preview is confirmed against: the later of the programme settings and the outlet's
 * offer settings, so a change to either between preview and confirm is caught. Older Outlet Admin
 * apps send back whatever version they were given, so they get the same protection.
 */
export function pricingVersion(settingsVersion: string, outletVersion: string): string {
  return new Date(outletVersion) > new Date(settingsVersion) ? outletVersion : settingsVersion;
}

/** Discount before any birthday bonus. The first-time discount follows the partner's classification. */
export function discountPercentageFor(
  discounts: OutletEffectiveDiscounts,
  qrType: QRCode['type'],
  isFirstTime: boolean,
  category: PartnerCategory = 'NON_ACHARIYA'
): number {
  if (qrType === 'REFERRAL') return discounts.referralDiscount;
  if (!isFirstTime) return discounts.repeatDiscount;
  return category === 'ACHARIYA' ? discounts.achariyaFirstTimeDiscount : discounts.firstTimeDiscount;
}

/** Referral points % (at this outlet) of the referring partner's classification. */
export function referralPointsPercentageFor(rewards: OutletEffectiveRewards, category: PartnerCategory): number {
  return category === 'ACHARIYA' ? rewards.achariyaReferralPointsPercentage : rewards.referralPointsPercentage;
}

const MAX_REDUCTION = new Decimal(MAX_BILL_REDUCTION_PERCENT);

/**
 * Total discount on a bill and what it is made of. Both extras apply only to the partner's
 * own (direct QR) bill:
 * - a waiting referral reward replaces the usual discount when it is the larger of the two
 *   (so it is never spent on a bill where it would not help);
 * - the birthday bonus is added on top.
 * The total never exceeds half the bill (MAX_BILL_REDUCTION_PERCENT), whatever the settings say,
 * so no bill comes to ₹0.
 */
export function discountWithBonus(
  discounts: OutletEffectiveDiscounts,
  qrType: QRCode['type'],
  isFirstTime: boolean,
  birthdayBonus: number,
  referralReward = 0,
  category: PartnerCategory = 'NON_ACHARIYA'
) {
  const isDirect = qrType === 'DEFAULT_DISCOUNT';
  const usual = new Decimal(discountPercentageFor(discounts, qrType, isFirstTime, category));
  const useReward = isDirect && usual.lt(referralReward);
  const base = Decimal.min(useReward ? new Decimal(referralReward) : usual, MAX_REDUCTION);
  const bonus = isDirect ? Decimal.max(0, Decimal.min(new Decimal(birthdayBonus), MAX_REDUCTION.minus(base))) : new Decimal(0);
  return {
    discountPercentage: base.plus(bonus).toNumber(),
    birthdayBonusPercentage: bonus.toNumber(),
    referralRewardPercentage: useReward ? base.toNumber() : 0,
  };
}

export interface BillContext {
  qrType: QRCode['type'];
  isFirstTime: boolean;
  /** Direct QR only: bonus the partner is entitled to today (0 when it is not their birthday). */
  birthdayBonus: number;
  /** Direct QR only: special discount of a referral reward the partner has waiting (0 when none). */
  referralReward: number;
  /** Referral only: the customer's mobile belongs to a registered partner. */
  customerIsPartner: boolean;
  /** Classification of the partner whose QR was scanned; Non-Achariya when omitted. */
  partnerCategory?: PartnerCategory;
}

const roundMoney = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
/** Payable rounded off to whole rupees, half up (₹166.50 → ₹167, ₹166.49 → ₹166). */
const roundOffRupees = (d: Prisma.Decimal) => d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/**
 * Pure calculation of a bill from the saved settings and the outlet's terms (programme values,
 * no GST and no cash reward when no outlet is given).
 * taxable = bill − discount, in whole rupees; GST = taxable × outlet GST %, to the paisa;
 * payable = taxable + GST, rounded off to whole rupees (the difference is the bill's round-off).
 * points = base × percentage ÷ 100 × (ratio points ÷ ratio rupees), cash reward = base × percentage ÷ 100,
 * where base is the bill or the taxable amount according to settings.pointsBasis (never GST).
 */
export function calculateBill(
  settings: ConfiguredProgramSettings,
  ctx: BillContext,
  billAmount: number,
  outlet: OutletBillTerms = programmeBillTerms(settings)
): BillCalculation {
  const category = ctx.partnerCategory ?? 'NON_ACHARIYA';
  const { discountPercentage, birthdayBonusPercentage, referralRewardPercentage } = discountWithBonus(
    outlet.discounts,
    ctx.qrType,
    ctx.isFirstTime,
    ctx.birthdayBonus,
    ctx.referralReward,
    category
  );
  const amount = new Decimal(billAmount).toDecimalPlaces(2);
  // The discounted amount is whole rupees, rounded half-up (₹330.70 → ₹331, ₹330.40 → ₹330);
  // the discount is what remains, so discount + taxable amount always equals the bill.
  const taxableAmount = amount.minus(amount.mul(discountPercentage).div(100)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const discountAmount = amount.minus(taxableAmount);
  // GST is charged on the discounted amount, to the paisa (₹90 at 5% → ₹4.50, payable ₹94.50).
  // With GST 0 the payable is the whole-rupee discounted amount, exactly as before GST existed.
  const gstAmount = roundMoney(taxableAmount.mul(outlet.gstPercentage).div(100));
  // The payable is always rounded off to whole rupees (₹166.95 → ₹167, ₹166.40 → ₹166).
  const exactAmount = taxableAmount.plus(gstAmount);
  const finalAmount = roundOffRupees(exactAmount);
  const rewards = outlet.rewards;

  const pointsBase = settings.pointsBasis === 'BILL_AMOUNT' ? amount : taxableAmount;
  const pointsPerRupee = new Decimal(settings.pointsToRupees.points).div(settings.pointsToRupees.rupees);
  const pointsFor = (percentage: number) => roundMoney(pointsBase.mul(percentage).div(100).mul(pointsPerRupee));
  const cashFor = (percentage: number) => roundMoney(pointsBase.mul(percentage).div(100));

  const isReferral = ctx.qrType === 'REFERRAL';
  const referralPointsPercentage = isReferral ? referralPointsPercentageFor(rewards, category) : 0;
  const cashRewardPurchasePercentage = outlet.givesCashReward ? rewards.cashRewardPurchasePercentage : 0;
  const cashRewardReferralPercentage = outlet.givesCashReward && isReferral ? rewards.cashRewardReferralPercentage : 0;
  const purchasePointsRecipient: PurchasePointsRecipient = !isReferral
    ? 'PARTNER'
    : ctx.customerIsPartner
      ? 'CUSTOMER_PARTNER'
      : 'CUSTOMER_PENDING';

  return {
    transactionType: isReferral ? 'REFERRAL' : 'DIRECT_PARTNER',
    isFirstTime: ctx.isFirstTime,
    billAmount: amount.toNumber(),
    discountPercentage,
    birthdayBonusPercentage,
    referralRewardPercentage,
    discountAmount: discountAmount.toNumber(),
    taxableAmount: taxableAmount.toNumber(),
    gstPercentage: outlet.gstPercentage,
    gstAmount: gstAmount.toNumber(),
    walletRedeemPoints: 0,
    walletRedeemAmount: 0,
    roundOffAmount: finalAmount.minus(exactAmount).toNumber(),
    finalAmount: finalAmount.toNumber(),
    partnerCategory: category,
    pointsBasis: settings.pointsBasis,
    pointsBaseAmount: pointsBase.toNumber(),
    pointsRatio: { ...settings.pointsToRupees },
    purchasePointsPercentage: rewards.purchasePointsPercentage,
    purchasePoints: pointsFor(rewards.purchasePointsPercentage).toNumber(),
    purchasePointsRecipient,
    referralPointsPercentage,
    referralPoints: isReferral ? pointsFor(referralPointsPercentage).toNumber() : 0,
    cashRewardPurchasePercentage,
    cashRewardPurchaseAmount: cashFor(cashRewardPurchasePercentage).toNumber(),
    cashRewardReferralPercentage,
    cashRewardReferralAmount: cashFor(cashRewardReferralPercentage).toNumber(),
    settingsVersion: pricingVersion(settings.updatedAt, outlet.version),
    outletSettingsVersion: outlet.version,
  };
}

/**
 * Pure calculation of a redeem bill (WALLET_REDEEM): no discount and no rewards. GST is charged on
 * the bill as usual; the wallet then pays for up to half the bill (MAX_BILL_REDUCTION_PERCENT),
 * never more than the redeem QR is worth or the live balance. The customer pays the rest.
 * Whatever the QR was worth beyond that is never taken, so it simply stays in the wallet.
 * `requestedRupees` (old Outlet Admin apps, which ask for an amount) caps the wallet part further.
 */
export function calculateRedeemBill(
  settings: ConfiguredProgramSettings,
  wallet: {
    qrMaxPoints: Prisma.Decimal;
    balancePoints: Prisma.Decimal;
    partnerCategory: PartnerCategory;
    requestedRupees?: Prisma.Decimal;
  },
  billAmount: number,
  outlet: OutletBillTerms
): BillCalculation {
  const ratio = settings.pointsToRupees;
  const amount = new Decimal(billAmount).toDecimalPlaces(2);
  const gstAmount = roundMoney(amount.mul(outlet.gstPercentage).div(100));
  const usablePoints = Decimal.max(0, Decimal.min(wallet.qrMaxPoints, wallet.balancePoints));
  const halfBill = amount.mul(MAX_BILL_REDUCTION_PERCENT).div(100).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const rupees = Decimal.min(rupeeValueOf(usablePoints, ratio), halfBill, wallet.requestedRupees ?? halfBill);
  // Rupees were rounded down from the points, so this never needs more points than are usable.
  const points = Decimal.min(
    rupees.mul(ratio.points).div(ratio.rupees).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    usablePoints
  );

  // The customer pays the rest, rounded off to whole rupees like every bill.
  const exactAmount = amount.plus(gstAmount).minus(rupees);

  return {
    transactionType: 'WALLET_REDEEM',
    isFirstTime: false,
    billAmount: amount.toNumber(),
    discountPercentage: 0,
    birthdayBonusPercentage: 0,
    referralRewardPercentage: 0,
    discountAmount: 0,
    taxableAmount: amount.toNumber(),
    gstPercentage: outlet.gstPercentage,
    gstAmount: gstAmount.toNumber(),
    walletRedeemPoints: points.toNumber(),
    walletRedeemAmount: rupees.toNumber(),
    roundOffAmount: roundOffRupees(exactAmount).minus(exactAmount).toNumber(),
    finalAmount: roundOffRupees(exactAmount).toNumber(),
    partnerCategory: wallet.partnerCategory,
    pointsBasis: settings.pointsBasis,
    pointsBaseAmount: 0,
    pointsRatio: { ...ratio },
    purchasePointsPercentage: 0,
    purchasePoints: 0,
    purchasePointsRecipient: 'PARTNER',
    referralPointsPercentage: 0,
    referralPoints: 0,
    cashRewardPurchasePercentage: 0,
    cashRewardPurchaseAmount: 0,
    cashRewardReferralPercentage: 0,
    cashRewardReferralAmount: 0,
    settingsVersion: pricingVersion(settings.updatedAt, outlet.version),
    outletSettingsVersion: outlet.version,
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
  const partner = await db.partner.findUnique({
    where: { mobile },
    select: { id: true },
  });
  return partner?.id ?? null;
}

/** Special discount of the referral reward the partner has earned and not yet used; 0 when none. */
async function waitingReferralReward(db: Db, settings: ConfiguredProgramSettings, partnerId: string): Promise<number> {
  const { rewardAvailable } = await referralProgress(db, partnerId, settings.referralRewardGoal);
  return rewardAvailable ? settings.referralRewardDiscount : 0;
}

async function buildContext(
  db: Db,
  settings: ConfiguredProgramSettings,
  qr: ResolvedQr,
  customer: ReferredCustomerInput | undefined,
  outletId: string
) {
  const isDirect = qr.type === 'DEFAULT_DISCOUNT';
  const customerPartnerId = !isDirect && customer ? await partnerIdForMobile(db, customer.mobile) : null;
  const ctx: BillContext = {
    qrType: qr.type,
    partnerCategory: qr.partner.category,
    birthdayBonus: isDirect ? birthdayBonusFor(settings, qr.partner) : 0,
    referralReward: isDirect ? await waitingReferralReward(db, settings, qr.partner.id) : 0,
    isFirstTime: isDirect
      ? await isFirstTimeDirect(db, qr.partner, settings.firstTimeValidityDays, outletId)
      : await isFirstTimeCustomer(db, customer!.mobile, outletId),
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
  const isDirect = qr.type === 'DEFAULT_DISCOUNT';
  const terms = outletBillTerms(settings, outlet);

  // The referral discount does not depend on first-time status; first-time status of a referred
  // customer is unknown until their mobile is entered.
  const isFirstTime = isDirect ? await isFirstTimeDirect(prisma, qr.partner, settings.firstTimeValidityDays, outlet.id) : null;
  const discount = discountWithBonus(
    terms.discounts,
    qr.type,
    isFirstTime ?? false,
    isDirect ? birthdayBonusFor(settings, qr.partner) : 0,
    isDirect ? await waitingReferralReward(prisma, settings, qr.partner.id) : 0,
    qr.partner.category
  );

  return {
    qrType: qr.type,
    transactionType: transactionTypeFor(qr),
    partner: {
      id: qr.partner.id,
      partnerCode: qr.partner.partnerCode,
      name: qr.partner.name,
      mobile: qr.partner.mobile,
      email: qr.partner.email,
    },
    discount: { isFirstTime, ...discount },
    gstPercentage: terms.gstPercentage,
    givesCashReward: terms.givesCashReward,
    settingsVersion: pricingVersion(settings.updatedAt, terms.version),
  };
}

/** Prefill for the referral customer form: a known customer, or a registered partner with that mobile. */
export async function lookupCustomer(mobile: string): Promise<CustomerLookup | null> {
  const [customer, partner] = await Promise.all([
    prisma.customer.findUnique({
      where: { mobile },
      select: { name: true, email: true },
    }),
    prisma.partner.findUnique({
      where: { mobile },
      select: { name: true, email: true },
    }),
  ]);
  const source = customer ?? partner;
  if (!source) return null;
  return {
    mobile,
    name: source.name,
    email: source.email ?? partner?.email ?? null,
    isPartner: partner !== null,
  };
}

export async function previewBill(
  outlet: OutletRow,
  input: {
    qrCode: string;
    billAmount: number;
    customer?: ReferredCustomerInput;
  }
): Promise<BillCalculation> {
  assertOutletCanTransact(outlet);
  const settings = await requireConfiguredSettings();
  const qr = await resolveQr(prisma, input.qrCode);
  assertCustomerMatchesQr(qr, input.customer);
  const { ctx } = await buildContext(prisma, settings, qr, input.customer, outlet.id);
  return calculateBill(settings, ctx, input.billAmount, outletBillTerms(settings, outlet));
}

const partnerSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  partnerCode: true,
} as const;

export const billInclude = {
  outlet: { select: { id: true, name: true } },
  qrCode: { select: { type: true } },
  partner: { select: partnerSelect },
  referrerPartner: { select: partnerSelect },
  customer: {
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      partnerId: true,
    },
  },
  pointEntries: { select: { type: true, partnerId: true } },
} satisfies Prisma.BillInclude;

export type BillWithRelations = Prisma.BillGetPayload<{
  include: typeof billInclude;
}>;

function purchaseRecipientOf(bill: BillWithRelations): PurchasePointsRecipient {
  if (bill.transactionType === 'DIRECT_PARTNER') return 'PARTNER';
  const entry = bill.pointEntries.find((e) => e.type === 'PURCHASE');
  const credited = entry ? entry.partnerId !== null : bill.customer?.partnerId != null;
  return credited ? 'CUSTOMER_PARTNER' : 'CUSTOMER_PENDING';
}

/** Amount after discount, before GST. Bills from before GST stored only the payable, which is the same amount. */
export function taxableAmountOf(bill: Pick<BillWithRelations, 'taxableAmount' | 'finalAmount'>): Prisma.Decimal {
  return bill.taxableAmount ?? bill.finalAmount;
}

/** What the bill's round-off added (or took off): payable − (taxable + GST − wallet). 0 on bills from before round-off. */
export function roundOffOf(
  bill: Pick<BillWithRelations, 'taxableAmount' | 'finalAmount' | 'gstAmount' | 'walletRedeemAmount'>
): Prisma.Decimal {
  return bill.finalAmount.minus(taxableAmountOf(bill).plus(bill.gstAmount).minus(bill.walletRedeemAmount));
}

/** A cash reward a bill credited (in rupees), for its notifications. */
export interface CashRewardCredit {
  type: 'PURCHASE' | 'REFERRAL';
  amount: number;
  partnerId: string | null;
}

export function serializeBill(bill: BillWithRelations): BillRecord {
  const person = (p: BillWithRelations['partner']) =>
    p ? { id: p.id, name: p.name, mobile: p.mobile, partnerCode: p.partnerCode } : null;
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    qrType: bill.qrCode?.type ?? null,
    transactionType: bill.transactionType,
    isFirstTime: bill.isFirstTime,
    billAmount: bill.billAmount.toNumber(),
    discountPercentage: bill.discountPercentage.toNumber(),
    birthdayBonusPercentage: bill.birthdayBonusPercentage.toNumber(),
    referralRewardPercentage: bill.referralRewardPercentage.toNumber(),
    discountAmount: bill.discountAmount.toNumber(),
    taxableAmount: taxableAmountOf(bill).toNumber(),
    gstPercentage: bill.gstPercentage.toNumber(),
    gstAmount: bill.gstAmount.toNumber(),
    walletRedeemPoints: bill.walletRedeemPoints.toNumber(),
    walletRedeemAmount: bill.walletRedeemAmount.toNumber(),
    roundOffAmount: roundOffOf(bill).toNumber(),
    finalAmount: bill.finalAmount.toNumber(),
    partnerCategory: bill.partnerCategory,
    pointsBasis: bill.pointsBasis,
    pointsBaseAmount: (bill.pointsBasis === 'BILL_AMOUNT' ? bill.billAmount : taxableAmountOf(bill)).toNumber(),
    pointsRatio: {
      points: bill.pointsRatioPoints.toNumber(),
      rupees: bill.pointsRatioRupees.toNumber(),
    },
    purchasePointsPercentage: bill.purchasePointsPercentage.toNumber(),
    purchasePoints: bill.purchasePoints.toNumber(),
    purchasePointsRecipient: purchaseRecipientOf(bill),
    referralPointsPercentage: bill.referralPointsPercentage.toNumber(),
    referralPoints: bill.referralPoints.toNumber(),
    cashRewardPurchasePercentage: bill.cashRewardPurchasePercentage.toNumber(),
    cashRewardPurchaseAmount: bill.cashRewardPurchaseAmount.toNumber(),
    cashRewardReferralPercentage: bill.cashRewardReferralPercentage.toNumber(),
    cashRewardReferralAmount: bill.cashRewardReferralAmount.toNumber(),
    settingsVersion: bill.settingsVersion?.toISOString() ?? null,
    outletSettingsVersion: bill.outletSettingsVersion?.toISOString() ?? null,
    createdAt: bill.createdAt.toISOString(),
    outlet: bill.outlet,
    partner: person(bill.partner),
    referrerPartner: person(bill.referrerPartner),
    customer: bill.customer
      ? {
          id: bill.customer.id,
          name: bill.customer.name,
          mobile: bill.customer.mobile,
          email: bill.customer.email,
        }
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
        const currentOutlet = await tx.outlet.findUniqueOrThrow({
          where: { id: outlet.id },
        });
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
          where: {
            outletId_idempotencyKey: {
              outletId: outlet.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
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

        // Settings and the outlet's offers are read inside the transaction; this bill is calculated
        // and stored with exactly these values.
        const settings = await requireConfiguredSettings(tx);
        // Calculate before creating the customer so first-time status reflects prior bills only.
        const { ctx, customerPartnerId } = await buildContext(tx, settings, qr, input.customer, outlet.id);
        const calc = calculateBill(settings, ctx, input.billAmount, outletBillTerms(settings, currentOutlet));

        if (input.settingsVersion && input.settingsVersion !== calc.settingsVersion) {
          throw new HttpError(
            409,
            "Programme settings or this outlet's offers were updated. Please review the updated amounts and confirm again.",
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
            birthdayBonusPercentage: calc.birthdayBonusPercentage,
            // Using the reward takes one goal's worth of referrals off the partner's progress.
            referralRewardPercentage: calc.referralRewardPercentage,
            referralRewardReferrals: calc.referralRewardPercentage > 0 ? settings.referralRewardGoal : 0,
            discountAmount: calc.discountAmount,
            taxableAmount: calc.taxableAmount,
            gstPercentage: calc.gstPercentage,
            gstAmount: calc.gstAmount,
            finalAmount: calc.finalAmount,
            settingsVersion: new Date(settings.updatedAt),
            outletSettingsVersion: new Date(calc.outletSettingsVersion),
            partnerCategory: calc.partnerCategory,
            purchasePointsPercentage: calc.purchasePointsPercentage,
            referralPointsPercentage: calc.referralPointsPercentage,
            pointsRatioPoints: calc.pointsRatio.points,
            pointsRatioRupees: calc.pointsRatio.rupees,
            pointsBasis: calc.pointsBasis,
            purchasePoints: calc.purchasePoints,
            referralPoints: calc.referralPoints,
            cashRewardPurchasePercentage: calc.cashRewardPurchasePercentage,
            cashRewardPurchaseAmount: calc.cashRewardPurchaseAmount,
            cashRewardReferralPercentage: calc.cashRewardReferralPercentage,
            cashRewardReferralAmount: calc.cashRewardReferralAmount,
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

        // Cash reward, same transaction, into the same wallet: credited as points at the ratio
        // (the bill keeps the rupee amounts). The purchase reward follows the purchase points (held
        // for an unregistered customer), the referral reward goes to the referring partner.
        // It never expires, as the cash reward never did.
        const cashEntries: CashRewardCredit[] = [];
        const pointsPerRupee = new Decimal(calc.pointsRatio.points).div(calc.pointsRatio.rupees);
        const asPoints = (rupees: number) => roundMoney(new Decimal(rupees).mul(pointsPerRupee));
        const cashbackEntries: Prisma.PointsEntryCreateManyInput[] = [];
        if (calc.cashRewardPurchaseAmount > 0) {
          const partnerId = isDirect ? qr.partner.id : customerPartnerId;
          cashEntries.push({ type: 'PURCHASE', amount: calc.cashRewardPurchaseAmount, partnerId });
          cashbackEntries.push({
            type: 'CASHBACK_PURCHASE',
            points: asPoints(calc.cashRewardPurchaseAmount),
            billId: created.id,
            partnerId,
            customerId: isDirect ? null : customerId,
          });
        }
        if (calc.cashRewardReferralAmount > 0) {
          cashEntries.push({ type: 'REFERRAL', amount: calc.cashRewardReferralAmount, partnerId: qr.partner.id });
          cashbackEntries.push({
            type: 'CASHBACK_REFERRAL',
            points: asPoints(calc.cashRewardReferralAmount),
            billId: created.id,
            partnerId: qr.partner.id,
          });
        }
        if (cashbackEntries.length) await tx.pointsEntry.createMany({ data: cashbackEntries });

        // Activity feed (pushed after commit): the purchaser's receipt when they are a registered
        // partner, and what the bill credited to the referring partner.
        const notifications = billNotificationRows({
          billId: created.id,
          billNumber: created.billNumber,
          outletName: currentOutlet.name,
          customerName: input.customer?.name ?? null,
          purchaserPartnerId: isDirect ? qr.partner.id : customerPartnerId,
          calc,
          entries,
          cashEntries,
        });
        // This referral completed the goal: tell the partner their special discount is waiting.
        // (Referral bills of one QR are serialized above, so the goal is crossed exactly once.)
        if (!isDirect) {
          const progress = await referralProgress(tx, qr.partner.id, settings.referralRewardGoal);
          if (progress.successful === settings.referralRewardGoal) {
            notifications.push(
              referralRewardNotificationRow({
                partnerId: qr.partner.id,
                billId: created.id,
                goal: settings.referralRewardGoal,
                discount: settings.referralRewardDiscount,
              })
            );
          }
        }
        if (notifications.length) await tx.notification.createMany({ data: notifications });

        const bill = await tx.bill.findUniqueOrThrow({
          where: { id: created.id },
          include: billInclude,
        });
        return { bill: serializeBill(bill), replayed: false };
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
  } catch (error) {
    // A concurrent request with the same idempotency key won the insert: replay it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.bill.findUnique({
        where: {
          outletId_idempotencyKey: {
            outletId: outlet.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
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
      _sum: {
        billAmount: true,
        discountAmount: true,
        gstAmount: true,
        finalAmount: true,
        purchasePoints: true,
        referralPoints: true,
        cashRewardPurchaseAmount: true,
        cashRewardReferralAmount: true,
      },
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
      gstAmount: n(sums._sum.gstAmount),
      finalAmount: n(sums._sum.finalAmount),
      purchasePoints: n(sums._sum.purchasePoints),
      referralPoints: n(sums._sum.referralPoints),
      cashReward: new Decimal(sums._sum.cashRewardPurchaseAmount ?? 0).plus(sums._sum.cashRewardReferralAmount ?? 0).toNumber(),
    },
  };
}

export async function getOutletBill(outletId: string, billId: string) {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, outletId },
    include: billInclude,
  });
  if (!bill) throw new HttpError(404, 'Bill not found', 'BILL_NOT_FOUND');
  return bill;
}
