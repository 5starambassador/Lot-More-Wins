/**
 * LOT MORE WINS — BILL ROUNDING (pure calculation, no database or server needed)
 * The customer pays a whole-rupee amount, rounded half-up; discount + payable = bill.
 *
 *   npx tsx prisma/test-bill-rounding.ts
 */
import type { ConfiguredProgramSettings } from '../apps/web/lib/settings';
import { calculateBill, type BillContext } from '../apps/web/lib/billing';

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
  walletDisplay: 'POINTS',
  isPersisted: true,
  updatedAt: new Date().toISOString(),
} satisfies ConfiguredProgramSettings;

const direct = (isFirstTime: boolean): BillContext => ({
  qrType: 'DEFAULT_DISCOUNT',
  isFirstTime,
  birthdayBonus: 0,
  referralReward: 0,
  customerIsPartner: false,
});

const cases: { bill: number; first: boolean; pays: number; discount: number }[] = [
  { bill: 413.38, first: true, pays: 331, discount: 82.38 }, // 330.704 → 331 (not 330)
  { bill: 413, first: true, pays: 330, discount: 83 }, // 330.40 → 330
  { bill: 367.5, first: false, pays: 331, discount: 36.5 }, // 330.75 → 331
  { bill: 999.99, first: true, pays: 800, discount: 199.99 }, // 799.992 → 800
  { bill: 1000, first: true, pays: 800, discount: 200 }, // already whole
  { bill: 0.5, first: false, pays: 0, discount: 0.5 }, // 0.45 → 0
];

console.log('Bill rounding');
for (const c of cases) {
  const r = calculateBill(settings, direct(c.first), c.bill);
  assert(
    r.finalAmount === c.pays && r.discountAmount === c.discount && r.finalAmount + r.discountAmount === c.bill,
    `₹${c.bill} at ${r.discountPercentage}% → pays ₹${c.pays}, ₹${c.discount} off`,
    r
  );
}

// Points use the rounded payable amount: 2% of ₹331 × 10 points per rupee = 66.2 points.
const p = calculateBill(settings, direct(true), 413.38);
assert(p.pointsBaseAmount === 331 && p.purchasePoints === 66.2, 'Purchase points are calculated on the rounded payable amount', p);

console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
process.exit(failed ? 1 : 0);
