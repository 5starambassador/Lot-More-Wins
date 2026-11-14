/**
 * LOT MORE WINS — FLAT (₹) OUTLET DISCOUNTS (pure calculation, no database or server needed)
 * A FIXED outlet's slab is the most ₹ off a bill; the Outlet Admin picks the amount per bill,
 * held to the slab and to half the bill. Birthday bonus and referral reward still apply.
 *
 *   npx tsx prisma/test-flat-discount.ts
 */
import type { ConfiguredProgramSettings } from '../apps/web/lib/settings';
import { calculateBill, programmeBillTerms, type BillContext, type OutletBillTerms } from '../apps/web/lib/billing';
import { NO_FLAT_VALUES, offerSummary, PERCENT_SLAB_TYPES } from '../apps/web/lib/outlet-offers';

let failed = 0;
function assert(condition: boolean, name: string, details?: unknown) {
  if (condition) console.log(`  ✅ PASS: ${name}`);
  else {
    failed++;
    console.error(`  ❌ FAIL: ${name}`, details ?? '');
  }
}

const settings = {
  messagingMode: 'email',
  firstTimeDiscount: 20,
  firstTimeValidityDays: 0,
  repeatDiscount: 10,
  birthdayBonusDiscount: 5,
  referralDiscount: 10,
  referralRewardGoal: 10,
  referralRewardDiscount: 20,
  pointsToRupees: { points: 10, rupees: 1 },
  referralPointsPercentage: 5,
  purchasePointsPercentage: 2,
  purchasePointsValidityDays: 0,
  referralPointsValidityDays: 0,
  pointsBasis: 'PAYABLE_AMOUNT',
  appDownloadUrl: null,
  inviteImageUrl: null,
  homePopupEnabled: false,
  latestAppVersion: null,
  walletDisplay: 'POINTS',
  androidAppUrl: null,
  androidAppLinkType: 'DIRECT',
  iosAppUrl: null,
  iosAppLinkType: 'DIRECT',
  isPersisted: true,
  updatedAt: new Date().toISOString(),
} satisfies ConfiguredProgramSettings;

const FLAT_DISCOUNTS = { firstTimeDiscount: 'FIXED', repeatDiscount: 'FIXED', referralDiscount: 'FIXED' } as const;
const flatOutlet: OutletBillTerms = {
  ...programmeBillTerms(settings),
  types: { ...PERCENT_SLAB_TYPES, ...FLAT_DISCOUNTS },
  flat: { ...NO_FLAT_VALUES, firstTimeDiscount: 500, repeatDiscount: 200, referralDiscount: 300 },
  gstPercentage: 5,
};

const ctx = (over: Partial<BillContext> = {}): BillContext => ({
  qrType: 'DEFAULT_DISCOUNT',
  isFirstTime: true,
  birthdayBonus: 0,
  referralReward: 0,
  customerIsPartner: false,
  ...over,
});

console.log('\nFlat discount bills');
let c = calculateBill(settings, ctx(), 2000, flatOutlet);
assert(c.discountAmount === 500 && c.flatDiscountCap === 500, 'no amount picked: full first-bill slab', c);
assert(c.discountType === 'FIXED' && c.discountPercentage === 25, 'discount % recorded as share of the bill', c.discountPercentage);
assert(c.taxableAmount === 1500 && c.gstAmount === 75 && c.finalAmount === 1575, 'GST on the discounted amount', c);

c = calculateBill(settings, ctx(), 2000, flatOutlet, 120);
assert(c.discountAmount === 120 && c.flatDiscountAmount === 120, 'picked ₹120 is applied', c);

c = calculateBill(settings, ctx(), 2000, flatOutlet, 900);
assert(c.discountAmount === 500, 'picked more than the slab: held to the slab', c.discountAmount);

c = calculateBill(settings, ctx(), 600, flatOutlet);
assert(c.discountAmount === 300 && c.finalAmount === 315, 'never more than half the bill', c);

c = calculateBill(settings, ctx({ isFirstTime: false }), 2000, flatOutlet);
assert(c.discountAmount === 200 && c.flatDiscountCap === 200, 'repeat bill uses the repeat slab', c);

c = calculateBill(settings, ctx({ qrType: 'REFERRAL', isFirstTime: true, birthdayBonus: 5 }), 2000, flatOutlet);
assert(c.discountAmount === 300 && c.birthdayBonusPercentage === 0, 'referral bill: guest slab, no birthday bonus', c);

c = calculateBill(settings, ctx({ birthdayBonus: 5 }), 2000, flatOutlet, 100);
assert(c.discountAmount === 200 && c.birthdayBonusPercentage === 5, 'birthday bonus adds 5% of the bill on top', c);

c = calculateBill(settings, ctx({ referralReward: 20 }), 2000, flatOutlet, 100);
assert(c.discountAmount === 400 && c.referralRewardPercentage === 20 && c.flatDiscountAmount === 0, 'larger referral reward replaces the picked amount', c);

c = calculateBill(settings, ctx({ referralReward: 20 }), 2000, flatOutlet, 500);
assert(c.discountAmount === 500 && c.referralRewardPercentage === 0, 'picked amount larger than the reward: reward kept for later', c);

c = calculateBill(settings, ctx(), 333.33, flatOutlet, 0);
assert(c.discountAmount === 0.33 && c.taxableAmount === 333, '₹0 picked: only the whole-rupee rounding', c);

c = calculateBill(settings, ctx(), 2000, programmeBillTerms(settings), 300);
assert(c.discountAmount === 400 && c.discountType === 'PERCENTAGE', 'percentage outlets ignore a picked amount', c);

console.log('\nPer-slab types (mixed % and ₹)');
const mixed: OutletBillTerms = {
  ...programmeBillTerms(settings),
  types: { ...PERCENT_SLAB_TYPES, firstTimeDiscount: 'FIXED' },
  flat: { ...NO_FLAT_VALUES, firstTimeDiscount: 150 },
};
c = calculateBill(settings, ctx(), 2000, mixed);
assert(c.discountType === 'FIXED' && c.discountAmount === 150, 'first bill uses its flat slab', c);
c = calculateBill(settings, ctx({ isFirstTime: false }), 2000, mixed, 150);
assert(c.discountType === 'PERCENTAGE' && c.discountAmount === 200 && c.flatDiscountCap === 0, 'repeat bill stays a % (picked amount ignored)', c);

console.log('\nFlat rewards');
const flatRewards: OutletBillTerms = {
  ...programmeBillTerms(settings),
  givesCashReward: true,
  types: { ...PERCENT_SLAB_TYPES, purchasePoints: 'FIXED', referralPoints: 'FIXED', cashRewardPurchase: 'FIXED', cashRewardReferral: 'FIXED' },
  flat: { ...NO_FLAT_VALUES, purchasePoints: 50, referralPoints: 30, cashRewardPurchase: 20, cashRewardReferral: 10 },
};
c = calculateBill(settings, ctx({ isFirstTime: false }), 2000, flatRewards);
// 10 points per ₹1: ₹50 = 500 points; the taxable ₹1800 is the points base.
assert(c.purchasePoints === 500 && c.cashRewardPurchaseAmount === 20, 'flat cashback: ₹50 = 500 points, ₹20 cash reward', c);
assert(c.purchasePointsPercentage === 2.78, 'flat cashback stored as its % of the points base', c.purchasePointsPercentage);
c = calculateBill(settings, ctx(), 2000, flatRewards);
assert(c.purchasePoints === 0 && c.cashRewardPurchaseAmount === 0, 'first bill still earns no cashback', c);
c = calculateBill(settings, ctx({ qrType: 'REFERRAL', isFirstTime: true }), 2000, flatRewards);
assert(c.referralPoints === 300 && c.cashRewardReferralAmount === 10 && c.purchasePoints === 500, 'referral bill: flat referrer reward and guest cashback', c);
c = calculateBill(settings, ctx({ isFirstTime: false }), 30, flatRewards);
assert(c.purchasePoints === 270 && c.purchasePointsPercentage === 100, 'flat reward never more than the points base', c);

console.log('\nMinimum bill');
const minBill: OutletBillTerms = { ...flatOutlet, minBillAmount: 1000 };
c = calculateBill(settings, ctx({ birthdayBonus: 5, referralReward: 20 }), 999, minBill, 100);
assert(
  c.belowMinimumBill === true && c.discountAmount === 0 && c.referralRewardPercentage === 0 && c.birthdayBonusPercentage === 0,
  'under the minimum: no discount, referral reward kept for later',
  c
);
c = calculateBill(settings, ctx(), 1000, minBill);
assert(c.belowMinimumBill === false && c.discountAmount === 500, 'at the minimum: discount applies', c);
c = calculateBill(settings, ctx(), 999, { ...programmeBillTerms(settings), minBillAmount: 1000 });
assert(c.discountAmount === 0 && c.purchasePoints > 0, 'first bill under the minimum: no discount, so cashback is earned', c);

console.log('\nOutlet offer summary');
const pctDiscounts = { firstTimeDiscount: 20, achariyaFirstTimeDiscount: 25, repeatDiscount: 10, referralDiscount: 10 };
let s = offerSummary(pctDiscounts, false, null, {
  types: { ...PERCENT_SLAB_TYPES, ...FLAT_DISCOUNTS },
  flat: { ...NO_FLAT_VALUES, firstTimeDiscount: 500, repeatDiscount: 200, referralDiscount: 300 },
});
assert(s.label === 'Up to ₹500 discount' && s.badge === 'Upto ₹500' && s.maxDiscount === 0 && s.maxFlatDiscount === 500, 'flat outlet summary', s);
s = offerSummary(pctDiscounts, false, null, null);
assert(s.label === 'Up to 25% discount' && s.badge === 'Upto 25%' && s.discountType === 'PERCENTAGE', 'percentage outlet summary', s);
s = offerSummary(pctDiscounts, false, null, {
  types: { ...PERCENT_SLAB_TYPES, firstTimeDiscount: 'FIXED' },
  flat: { ...NO_FLAT_VALUES, firstTimeDiscount: 500 },
});
assert(s.label === 'Up to 10% or ₹500 discount' && s.badge === 'Upto 10%' && s.maxDiscount === 10, 'mixed outlet summary', s);

console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
