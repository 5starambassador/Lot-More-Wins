/**
 * The bill calculation as it was before per-outlet offers, GST and cash reward (commit 9ee008f,
 * apps/web/lib/billing.ts), kept verbatim so prisma/test-revised-flow.ts can prove that an outlet
 * with GST 0 and no overrides bills exactly as before. Do not edit.
 */
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

export interface LegacySettings {
  firstTimeDiscount: number;
  repeatDiscount: number;
  referralDiscount: number;
  referralPointsPercentage: number;
  purchasePointsPercentage: number;
  pointsBasis: 'BILL_AMOUNT' | 'PAYABLE_AMOUNT';
  pointsToRupees: { points: number; rupees: number };
  updatedAt: string;
}

export interface LegacyBillContext {
  qrType: 'DEFAULT_DISCOUNT' | 'REFERRAL';
  isFirstTime: boolean;
  birthdayBonus: number;
  referralReward: number;
  customerIsPartner: boolean;
}

/** Discount before any birthday bonus. */
export function legacyDiscountPercentageFor(settings: LegacySettings, qrType: LegacyBillContext['qrType'], isFirstTime: boolean): number {
  return qrType === 'REFERRAL' ? settings.referralDiscount : isFirstTime ? settings.firstTimeDiscount : settings.repeatDiscount;
}

/**
 * Total discount on a bill and what it is made of. Both extras apply only to the partner's
 * own (direct QR) bill:
 * - a waiting referral reward replaces the usual discount when it is the larger of the two
 *   (so it is never spent on a bill where it would not help);
 * - the birthday bonus is added on top and never pushes the discount past 100%.
 */
export function legacyDiscountWithBonus(
  settings: LegacySettings,
  qrType: LegacyBillContext['qrType'],
  isFirstTime: boolean,
  birthdayBonus: number,
  referralReward = 0
) {
  const isDirect = qrType === 'DEFAULT_DISCOUNT';
  const usual = new Decimal(legacyDiscountPercentageFor(settings, qrType, isFirstTime));
  const useReward = isDirect && usual.lt(referralReward);
  const base = useReward ? new Decimal(referralReward) : usual;
  const bonus = isDirect ? Decimal.min(new Decimal(birthdayBonus), new Decimal(100).minus(base)) : new Decimal(0);
  return {
    discountPercentage: base.plus(bonus).toNumber(),
    birthdayBonusPercentage: bonus.toNumber(),
    referralRewardPercentage: useReward ? base.toNumber() : 0,
  };
}

const roundMoney = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/**
 * Pure calculation of a bill from the saved settings.
 * points = base × percentage ÷ 100 × (ratio points ÷ ratio rupees),
 * where base is the bill or payable amount according to settings.pointsBasis.
 */
export function legacyCalculateBill(settings: LegacySettings, ctx: LegacyBillContext, billAmount: number) {
  const { discountPercentage, birthdayBonusPercentage, referralRewardPercentage } = legacyDiscountWithBonus(
    settings,
    ctx.qrType,
    ctx.isFirstTime,
    ctx.birthdayBonus,
    ctx.referralReward
  );
  const amount = new Decimal(billAmount).toDecimalPlaces(2);
  // The customer pays a whole-rupee amount, rounded half-up (₹330.70 → ₹331, ₹330.40 → ₹330);
  // the discount is what remains, so discount + payable always equals the bill.
  const finalAmount = amount.minus(amount.mul(discountPercentage).div(100)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const discountAmount = amount.minus(finalAmount);

  const pointsBase = settings.pointsBasis === 'BILL_AMOUNT' ? amount : finalAmount;
  const pointsPerRupee = new Decimal(settings.pointsToRupees.points).div(settings.pointsToRupees.rupees);
  const pointsFor = (percentage: number) => roundMoney(pointsBase.mul(percentage).div(100).mul(pointsPerRupee));

  const isReferral = ctx.qrType === 'REFERRAL';
  const referralPointsPercentage = isReferral ? settings.referralPointsPercentage : 0;
  const purchasePointsRecipient = !isReferral ? 'PARTNER' : ctx.customerIsPartner ? 'CUSTOMER_PARTNER' : 'CUSTOMER_PENDING';

  return {
    transactionType: isReferral ? 'REFERRAL' : 'DIRECT_PARTNER',
    isFirstTime: ctx.isFirstTime,
    billAmount: amount.toNumber(),
    discountPercentage,
    birthdayBonusPercentage,
    referralRewardPercentage,
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
