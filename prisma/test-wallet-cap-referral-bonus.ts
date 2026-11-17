/**
 * LOT MORE WINS — MAXIMUM WALLET REDEMPTION + FIRST REFERRAL BONUS (pure calculation, no database)
 *
 *   npx tsx prisma/test-wallet-cap-referral-bonus.ts
 */
import { Prisma } from '@prisma/client';
import type { ConfiguredProgramSettings } from '../apps/web/lib/settings';
import {
  calculateBill,
  calculateRedeemBill,
  programmeBillTerms,
  type BillContext,
  type OutletBillTerms,
} from '../apps/web/lib/billing';

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


const D = (n: number) => new Prisma.Decimal(n);
// 10 points = ₹1; a wallet worth ₹1,000.
const wallet = { qrMaxPoints: D(10000), balancePoints: D(10000), partnerCategory: 'NON_ACHARIYA' as const };
const terms = (cap: OutletBillTerms['walletRedeemCap']): OutletBillTerms => ({ ...programmeBillTerms(settings), walletRedeemCap: cap });

console.log('\nMaximum wallet redemption');
let r = calculateRedeemBill(settings, wallet, 1000, programmeBillTerms(settings));
assert(r.walletRedeemAmount === 500 && r.finalAmount === 500, 'default: half the bill (₹1,000 QR, ₹1,000 bill → wallet ₹500, pay ₹500)', r);
r = calculateRedeemBill(settings, wallet, 1000, terms({ type: 'PERCENTAGE', value: 100 }));
assert(r.walletRedeemAmount === 1000 && r.finalAmount === 0 && r.walletRedeemPoints === 10000, '100%: the whole bill, ₹0 to pay', r);
r = calculateRedeemBill(settings, wallet, 1000, terms({ type: 'PERCENTAGE', value: 0 }));
assert(r.walletRedeemAmount === 0 && r.finalAmount === 1000, '0%: no wallet payment', r);
r = calculateRedeemBill(settings, wallet, 1000, terms({ type: 'PERCENTAGE', value: 30 }));
assert(r.walletRedeemAmount === 300 && r.finalAmount === 700, '30%: ₹300', r);
r = calculateRedeemBill(settings, wallet, 1000, terms({ type: 'FIXED', value: 200 }));
assert(r.walletRedeemAmount === 200 && r.finalAmount === 800, 'flat ₹200', r);
r = calculateRedeemBill(settings, wallet, 150, terms({ type: 'FIXED', value: 200 }));
assert(r.walletRedeemAmount === 150 && r.finalAmount === 0, 'flat ₹200 on a ₹150 bill: never more than the bill', r);
r = calculateRedeemBill(settings, wallet, 3000, terms({ type: 'PERCENTAGE', value: 100 }));
assert(r.walletRedeemAmount === 1000 && r.finalAmount === 2000, '100% but the QR is worth only ₹1,000', r);
r = calculateRedeemBill(settings, { ...wallet, requestedRupees: D(100) }, 1000, terms({ type: 'PERCENTAGE', value: 100 }));
assert(r.walletRedeemAmount === 100, 'old apps: requested amount still caps it', r);

console.log('\nFirst referral bonus');
const ref = (over: Partial<BillContext> = {}): BillContext => ({
  qrType: 'REFERRAL',
  isFirstTime: true,
  birthdayBonus: 0,
  referralReward: 0,
  customerIsPartner: false,
  firstReferralAtOutlet: true,
  ...over,
});
const tdg: OutletBillTerms = { ...programmeBillTerms(settings), firstReferralBonus: { amount: 300, percentage: 10 } };
let c = calculateBill(settings, ref(), 1000, tdg);
assert(c.firstReferralBonus === true && c.cashRewardReferralAmount === 400 && c.firstReferralBonusAmount === 300, 'first referral: ₹300 + 10% of ₹1,000 = ₹400', c);
assert(c.cashRewardReferralPercentage === 10, 'bonus % recorded', c.cashRewardReferralPercentage);
assert(c.referralPoints > 0, 'referral points unchanged', c.referralPoints);
c = calculateBill(settings, ref({ firstReferralAtOutlet: false }), 1000, tdg);
assert(!c.firstReferralBonus && c.cashRewardReferralAmount === 0, 'later referral: no bonus (outlet gives no cash reward)', c);
c = calculateBill(settings, ref(), 1000, programmeBillTerms(settings));
assert(!c.firstReferralBonus && c.cashRewardReferralAmount === 0, 'outlet without a bonus: nothing', c);
c = calculateBill(settings, ref(), 500, { ...tdg, minBillAmount: 600 });
assert(!c.firstReferralBonus && c.cashRewardReferralAmount === 0, 'under the minimum bill: no bonus', c);
c = calculateBill(settings, { ...ref(), qrType: 'DEFAULT_DISCOUNT' }, 1000, tdg);
assert(!c.firstReferralBonus && c.cashRewardReferralAmount === 0, 'direct bill: no bonus', c);
c = calculateBill(settings, ref(), 1000, { ...tdg, givesCashReward: true, rewards: { ...tdg.rewards, cashRewardPurchasePercentage: 0, cashRewardReferralPercentage: 5 } });
assert(c.cashRewardReferralAmount === 400, 'replaces the usual referral cash reward (5% → ₹300 + 10%)', c);
c = calculateBill(settings, ref({ firstReferralAtOutlet: false }), 1000, { ...tdg, givesCashReward: true, rewards: { ...tdg.rewards, cashRewardPurchasePercentage: 0, cashRewardReferralPercentage: 5 } });
assert(!c.firstReferralBonus && c.cashRewardReferralAmount === 45, 'later referral: the usual 5% referral cash reward (of the ₹900 payable)', c);

if (failed) {
  console.error(failed + " check(s) failed");
  process.exit(1);
}
console.log("All checks passed");
