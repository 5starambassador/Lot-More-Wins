/**
 * LOT MORE WINS — REVISED FLOW ACCEPTANCE TESTS (outlet offers, GST, cash reward, Achariya,
 * payouts and the Finance sheet, outlet offer editing, older app compatibility).
 * Calls the libraries and route handlers directly. It WRITES DATA (and overwrites the programme
 * settings), so it runs only against the test database (TEST_DATABASE_URL in .env) or a local one,
 * and never against the live DATABASE_URL:
 *
 *   npx tsx --tsconfig apps/web/tsconfig.json prisma/test-revised-flow.ts         (TEST_DATABASE_URL)
 *   DATABASE_URL=postgresql://…@localhost:54329/lmw_dev npx tsx --tsconfig apps/web/tsconfig.json prisma/test-revised-flow.ts
 */
import crypto from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';

const env = dotenv.config({ path: path.resolve(__dirname, '../.env'), processEnv: {} }).parsed ?? {};
const LIVE_URL = env.DATABASE_URL ?? '';
const TEST_URL = process.env.TEST_DATABASE_URL ?? env.TEST_DATABASE_URL ?? '';
const isLocal = (u: string) => /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(u);
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return '';
  }
};
// Without an explicit local DATABASE_URL, the test database is used.
if (!isLocal(process.env.DATABASE_URL ?? '')) process.env.DATABASE_URL = TEST_URL;
const url = process.env.DATABASE_URL ?? '';
if (!url || (hostOf(LIVE_URL) !== '' && hostOf(url) === hostOf(LIVE_URL)) || !(isLocal(url) || hostOf(url) === hostOf(TEST_URL))) {
  console.error('Refusing to run: the target must be TEST_DATABASE_URL or a localhost database, never the live DATABASE_URL.');
  process.exit(1);
}
process.env.JWT_SECRET ||= 'revised-flow-test-secret-0123456789abcdef';
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MSG91_AUTH_KEY', 'MSG91_INTEGRATED_NUMBER']) process.env[key] = '';

let passed = 0;
let failed = 0;
function assert(condition: boolean, name: string, details?: unknown) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    if (details !== undefined) console.error('     Details:', JSON.stringify(details, null, 2));
    failed++;
  }
}

const rand = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const uniqueMobile = () => `9${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;
const key = (label: string) => `rf-${label}-${rand()}${rand()}`;

async function main() {
  const { default: prisma } = await import('../apps/web/lib/prisma');
  const billing = await import('../apps/web/lib/billing');
  const { updateProgramSettings, requireConfiguredSettings } = await import('../apps/web/lib/settings');
  const { applyOfferChanges } = await import('../apps/web/lib/outlet-offers');
  const cash = await import('../apps/web/lib/cash-wallet');
  const finance = await import('../apps/web/lib/finance');
  const { signToken, HttpError } = await import('../apps/web/lib/auth');
  const { legacyCalculateBill } = await import('./fixtures/legacy-calculate-bill');
  const { NextRequest } = await import('next/server');
  const ExcelJS = (await import('exceljs')).default;

  const expectError = async (fn: () => Promise<unknown>, code: string, name: string) => {
    try {
      await fn();
      assert(false, name, 'no error thrown');
    } catch (e) {
      assert(e instanceof HttpError && e.code === code, name, e instanceof HttpError ? e.code : String(e));
    }
  };

  // --------------------------------------------------------------------------
  // Fixtures
  // --------------------------------------------------------------------------
  const baseSettings = {
    messagingMode: 'email' as const,
    firstTimeDiscount: 30,
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
    pointsBasis: 'PAYABLE_AMOUNT' as const,
    appDownloadUrl: 'https://lotmorewins.com/download',
    achariyaFirstTimeDiscount: 50,
    achariyaReferralPointsPercentage: 7,
    cashRewardPurchasePercentage: 2,
    cashRewardReferralPercentage: 1,
    weeklyPayoutEnabled: true,
    payoutMinimumAmount: 100,
    payoutWeekday: 1,
    redeemQrEnabled: false,
  };
  await updateProgramSettings(baseSettings, 'revised-flow-test');

  const superActor = {
    type: 'SUPER_ADMIN' as const,
    id: 'test-super',
    email: 'super@lmw-rf.test',
  };
  const makeOutlet = async (label: string, offers: Parameters<typeof applyOfferChanges>[2]) => {
    const outlet = await prisma.outlet.create({
      data: {
        name: `RF ${label} ${rand()}`,
        email: `${label.toLowerCase()}-${rand()}@lmw-rf.test`,
        mobile: uniqueMobile(),
        admins: {
          create: {
            email: `admin-${label.toLowerCase()}-${rand()}@lmw-rf.test`,
            passwordHash: 'x',
          },
        },
      },
      include: { admins: true },
    });
    await prisma.$transaction((tx) => applyOfferChanges(tx, outlet.id, offers, superActor));
    return prisma.outlet.findUniqueOrThrow({
      where: { id: outlet.id },
      include: { admins: true },
    });
  };
  const makePartner = async (
    category: 'ACHARIYA' | 'NON_ACHARIYA' = 'NON_ACHARIYA',
    upiId: string | null = `p${rand().toLowerCase()}@okaxis`
  ) => {
    const id = rand();
    return prisma.partner.create({
      data: {
        partnerCode: `LMW-P-${id.slice(0, 6)}`,
        name: `RF Partner ${id}`,
        mobile: uniqueMobile(),
        email: `p-${id.toLowerCase()}@lmw-rf.test`,
        passwordHash: 'x',
        category,
        upiId,
        qrCodes: {
          create: [
            { code: `LMW-DISC-${rand()}${rand()}`, type: 'DEFAULT_DISCOUNT' },
            { code: `LMW-REF-${rand()}${rand()}`, type: 'REFERRAL' },
          ],
        },
      },
      include: { qrCodes: true },
    });
  };
  const qrOf = (p: Awaited<ReturnType<typeof makePartner>>, type: 'DEFAULT_DISCOUNT' | 'REFERRAL') =>
    p.qrCodes.find((q) => q.type === type)!.code;
  const bill = (outlet: Awaited<ReturnType<typeof makeOutlet>>, input: Omit<Parameters<typeof billing.createBill>[2], 'idempotencyKey'>) =>
    billing.createBill(outlet, outlet.admins[0]!.id, {
      ...input,
      idempotencyKey: key('bill'),
    });

  // --------------------------------------------------------------------------
  console.log('\n1. 10% discount + 5% GST on ₹100');
  const gstOutlet = await makeOutlet('GST', {
    firstTimeDiscount: 10,
    achariyaFirstTimeDiscount: 10,
    repeatDiscount: 10,
    referralDiscount: 10,
    gstPercentage: 5,
  });
  const p1 = await makePartner();
  const r1 = await bill(gstOutlet, {
    qrCode: qrOf(p1, 'DEFAULT_DISCOUNT'),
    billAmount: 100,
  });
  assert(
    r1.bill.discountAmount === 10 && r1.bill.taxableAmount === 90 && r1.bill.gstAmount === 4.5 && r1.bill.finalAmount === 94.5,
    'discount ₹10, amount after discount ₹90, GST ₹4.50, payable ₹94.50',
    r1.bill
  );
  const row1 = await prisma.bill.findUniqueOrThrow({
    where: { id: r1.bill.id },
  });
  assert(
    row1.discountPercentage.toNumber() === 10 &&
      row1.gstPercentage.toNumber() === 5 &&
      row1.gstAmount.toNumber() === 4.5 &&
      row1.taxableAmount?.toNumber() === 90 &&
      row1.finalAmount.toNumber() === 94.5 &&
      row1.outletSettingsVersion?.getTime() === gstOutlet.offersUpdatedAt.getTime() &&
      row1.partnerCategory === 'NON_ACHARIYA',
    'bill snapshot stores discount %, GST %, GST amount, taxable, payable, outlet settings version and category'
  );
  assert(row1.purchasePoints.toNumber() === 18, 'points use the pre-GST amount (₹90 × 2% × 10 = 18 points)', row1.purchasePoints);

  // --------------------------------------------------------------------------
  console.log('\n2. GST 0 and no overrides = the previous calculation');
  const settings = await requireConfiguredSettings();
  const plainOutlet = await makeOutlet('Plain', {});
  const terms = billing.outletBillTerms(settings, plainOutlet);
  const legacySettings = {
    ...settings,
    firstTimeDiscount: settings.firstTimeDiscount,
  };
  let mismatches = 0;
  let first: unknown = null;
  for (let i = 0; i < 2000; i++) {
    const ctx = {
      qrType: (i % 2 ? 'REFERRAL' : 'DEFAULT_DISCOUNT') as 'REFERRAL' | 'DEFAULT_DISCOUNT',
      isFirstTime: i % 3 === 0,
      birthdayBonus: i % 7 === 0 ? 5 : 0,
      referralReward: i % 11 === 0 ? 20 : 0,
      customerIsPartner: i % 5 === 0,
    };
    const amount = Number((crypto.randomInt(1, 5_000_000) / 100).toFixed(2));
    const legacy = legacyCalculateBill(legacySettings, ctx, amount) as Record<string, unknown>;
    for (const calc of [billing.calculateBill(settings, ctx, amount), billing.calculateBill(settings, ctx, amount, terms)]) {
      const now = calc as unknown as Record<string, unknown>;
      // The pricing version of an outlet bill includes the outlet's own version by design.
      const diff = Object.keys(legacy).filter((k) => k !== 'settingsVersion' && JSON.stringify(legacy[k]) !== JSON.stringify(now[k]));
      if (diff.length || now.gstAmount !== 0 || now.cashRewardPurchaseAmount !== 0 || now.taxableAmount !== now.finalAmount) {
        mismatches++;
        first ??= { amount, ctx, diff, legacy, now };
      }
    }
  }
  assert(mismatches === 0, '4,000 calculations match the previous calculateBill exactly (no GST, no cash)', first);
  const p2 = await makePartner();
  const r2 = await bill(plainOutlet, {
    qrCode: qrOf(p2, 'DEFAULT_DISCOUNT'),
    billAmount: 413.38,
  });
  const legacy2 = legacyCalculateBill(
    legacySettings,
    {
      qrType: 'DEFAULT_DISCOUNT',
      isFirstTime: true,
      birthdayBonus: 0,
      referralReward: 0,
      customerIsPartner: false,
    },
    413.38
  );
  assert(
    r2.bill.finalAmount === legacy2.finalAmount &&
      r2.bill.discountAmount === legacy2.discountAmount &&
      r2.bill.purchasePoints === legacy2.purchasePoints,
    'a real bill at a GST-0 outlet without overrides equals the previous calculation',
    { now: r2.bill, legacy2 }
  );

  // --------------------------------------------------------------------------
  console.log('\n3. Cash reward only at cash-reward outlets, to the right person');
  const cashOutlet = await makeOutlet('Cash', { givesCashReward: true });
  const p3 = await makePartner();
  const r3 = await bill(cashOutlet, {
    qrCode: qrOf(p3, 'DEFAULT_DISCOUNT'),
    billAmount: 1000,
  });
  const p3Cash = await cash.cashBalance(prisma, p3.id);
  assert(
    r3.bill.cashRewardPurchaseAmount === 14 && p3Cash.balance.toNumber() === 14,
    'Personal QR: purchaser credited 2% of ₹700 = ₹14',
    r3.bill
  );
  const r3b = await bill(plainOutlet, {
    qrCode: qrOf(p3, 'DEFAULT_DISCOUNT'),
    billAmount: 1000,
  });
  assert(
    r3b.bill.cashRewardPurchaseAmount === 0 && (await cash.cashBalance(prisma, p3.id)).balance.toNumber() === 14,
    'no cash reward at an outlet without it'
  );
  const friend = { name: 'RF Friend', mobile: uniqueMobile() };
  const r3c = await bill(cashOutlet, {
    qrCode: qrOf(p3, 'REFERRAL'),
    billAmount: 1000,
    customer: friend,
  });
  const held = await prisma.cashRewardEntry.findFirst({
    where: { billId: r3c.bill.id, type: 'PURCHASE' },
  });
  assert(
    r3c.bill.cashRewardReferralAmount === 9 && (await cash.cashBalance(prisma, p3.id)).balance.toNumber() === 23,
    'Referral QR: referrer credited 1% of ₹900 = ₹9',
    r3c.bill
  );
  assert(
    held?.partnerId === null && held?.amount.toNumber() === 18,
    "the friend's own ₹18 is held against their mobile until they register",
    held
  );
  const r3d = await bill(plainOutlet, {
    qrCode: qrOf(p3, 'REFERRAL'),
    billAmount: 1000,
    customer: { name: 'RF Friend 2', mobile: uniqueMobile() },
  });
  assert(
    r3d.bill.cashRewardReferralAmount === 0 && r3d.bill.cashRewardPurchaseAmount === 0,
    'referral at an outlet without cash reward credits no cash'
  );
  const receipt = await prisma.notification.findFirst({
    where: { billId: r1.bill.id, type: 'BILL_RECEIPT' },
  });
  assert(
    !!receipt && receipt.body.includes('₹4.50 GST') && receipt.body.includes('₹94.50'),
    'receipt notification has the GST breakdown and final amount',
    receipt?.body
  );

  // --------------------------------------------------------------------------
  console.log('\n4. Achariya vs Non-Achariya');
  const ach = await makePartner('ACHARIYA');
  const non = await makePartner('NON_ACHARIYA');
  const ra = await bill(plainOutlet, {
    qrCode: qrOf(ach, 'DEFAULT_DISCOUNT'),
    billAmount: 1000,
  });
  const rn = await bill(plainOutlet, {
    qrCode: qrOf(non, 'DEFAULT_DISCOUNT'),
    billAmount: 1000,
  });
  assert(ra.bill.discountPercentage === 50 && rn.bill.discountPercentage === 30, 'first-time discount: Achariya 50%, Non-Achariya 30%', [
    ra.bill.discountPercentage,
    rn.bill.discountPercentage,
  ]);
  const rra = await bill(plainOutlet, {
    qrCode: qrOf(ach, 'REFERRAL'),
    billAmount: 1000,
    customer: { name: 'RF A', mobile: uniqueMobile() },
  });
  const rrn = await bill(plainOutlet, {
    qrCode: qrOf(non, 'REFERRAL'),
    billAmount: 1000,
    customer: { name: 'RF N', mobile: uniqueMobile() },
  });
  assert(
    rra.bill.referralPointsPercentage === 7 &&
      rrn.bill.referralPointsPercentage === 5 &&
      rra.bill.referralPoints === 630 &&
      rrn.bill.referralPoints === 450,
    'referral points: Achariya 7% (630 pts), Non-Achariya 5% (450 pts) of ₹900',
    [rra.bill.referralPoints, rrn.bill.referralPoints]
  );

  // --------------------------------------------------------------------------
  console.log('\n5. Payout request, Finance sheet upload, idempotency, bad rows');
  const payee = await makePartner();
  await bill(cashOutlet, {
    qrCode: qrOf(payee, 'DEFAULT_DISCOUNT'),
    billAmount: 10000,
  }); // 2% of ₹7,000 = ₹140
  const noUpi = await makePartner('NON_ACHARIYA', null);
  await bill(cashOutlet, {
    qrCode: qrOf(noUpi, 'DEFAULT_DISCOUNT'),
    billAmount: 10000,
  });
  await expectError(() => cash.requestPayout(noUpi.id), 'UPI_REQUIRED', 'payout without a UPI ID is blocked');
  const requested = await cash.requestPayout(payee.id);
  assert(
    requested.payout.status === 'PENDING' && requested.payout.amount === 140,
    'Request Payout creates a Pending payout of the available ₹140',
    requested.payout
  );
  assert(requested.wallet.available === 0 && requested.wallet.balance === 140, 'the Pending amount is held, not debited', requested.wallet);
  await expectError(() => cash.requestPayout(payee.id), 'PAYOUT_PENDING', 'a second request while one is Pending is refused');

  const workbook = await finance.financeWorkbook({
    page: 1,
    limit: 100,
    status: 'PENDING',
    partnerId: payee.id,
  });
  // A reward earned after the export, before the upload.
  await bill(cashOutlet, {
    qrCode: qrOf(payee, 'DEFAULT_DISCOUNT'),
    billAmount: 1000,
  }); // repeat 10% → ₹900 × 2% = ₹18

  const fill = async (edit: (row: Record<string, string | number>) => void) => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(workbook as unknown as ArrayBuffer);
    const sheet = book.getWorksheet('Payouts')!;
    const headers = (sheet.getRow(1).values as string[]).slice(1);
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      const values: Record<string, string | number> = {};
      headers.forEach((h, i) => (values[h] = row.getCell(i + 1).value as string | number));
      edit(values);
      headers.forEach((h, i) => (row.getCell(i + 1).value = values[h] ?? null));
    });
    return Buffer.from(await book.xlsx.writeBuffer()).toString('base64');
  };
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const txnRef = `UPI${rand()}${rand()}`;
  const good = await fill((r) => Object.assign(r, { upi_txn_ref: txnRef, paid_on: today, status: 'PAID' }));
  const admin = {
    id: 'test-finance',
    email: 'finance@lmw-rf.test',
    name: 'Finance',
    role: 'ADMIN' as const,
    position: null,
    pages: ['finance' as const],
    canDelete: false,
  };

  const bad = await fill((r) =>
    Object.assign(r, {
      upi_txn_ref: '',
      paid_on: today,
      status: 'PAID',
      amount: 999,
    })
  );
  const badResult = await finance.uploadPayoutSheet({ fileName: 'bad.xlsx', base64: bad, apply: true }, admin);
  assert(
    !badResult.applied && badResult.errorCount === 1 && badResult.rows[0]!.errors.length >= 2,
    'a bad row rejects the whole file with row-level errors',
    badResult.rows
  );
  assert(
    (
      await prisma.payout.findUniqueOrThrow({
        where: { id: requested.payout.id },
      })
    ).status === 'PENDING',
    'nothing changed after the rejected file'
  );

  const preview = await finance.uploadPayoutSheet({ fileName: 'paid.xlsx', base64: good, apply: false }, admin);
  assert(!preview.applied && preview.paidCount === 1 && preview.errorCount === 0, 'preview validates without changing anything', preview);
  const before = await cash.cashBalance(prisma, payee.id);
  const applied = await finance.uploadPayoutSheet({ fileName: 'paid.xlsx', base64: good, apply: true }, admin);
  const after = await cash.cashBalance(prisma, payee.id);
  const paidRow = await prisma.payout.findUniqueOrThrow({
    where: { id: requested.payout.id },
  });
  assert(
    applied.applied && applied.paidCount === 1 && paidRow.status === 'PAID' && paidRow.upiTxnRef === txnRef,
    'upload marks the payout Paid',
    applied
  );
  assert(before.balance.minus(after.balance).toNumber() === 140, 'balance went down by exactly the amount paid (₹140)', {
    before: before.balance,
    after: after.balance,
  });
  assert(
    after.balance.toNumber() === 18 && after.available.toNumber() === 18,
    'the ₹18 earned between export and upload is still in the wallet',
    after
  );
  const again = await finance.uploadPayoutSheet({ fileName: 'paid.xlsx', base64: good, apply: true }, admin);
  const afterAgain = await cash.cashBalance(prisma, payee.id);
  assert(
    again.paidCount === 0 && again.unchangedCount === 1 && afterAgain.balance.equals(after.balance),
    'uploading the same sheet again changes nothing',
    again
  );
  const uploads = await prisma.payoutUpload.findMany({
    where: { id: { in: [applied.uploadId!, again.uploadId!] } },
  });
  assert(
    uploads.length === 2 && uploads.every((u) => u.uploadedByEmail === admin.email && u.fileHash.length === 64),
    'every applied file is logged with who uploaded it'
  );
  assert(
    !!(await prisma.notification.findFirst({
      where: { partnerId: payee.id, type: 'PAYOUT_PAID' },
    })),
    'partner gets a Payout paid notification'
  );

  const weekly = await cash.runWeeklyPayouts({ force: true });
  const weeklyAgain = await cash.runWeeklyPayouts({ force: true });
  const noUpiPayouts = await prisma.payout.count({
    where: { partnerId: noUpi.id },
  });
  assert(weekly.ran && weekly.skippedNoUpi >= 1 && noUpiPayouts === 0, 'weekly run skips balances without a UPI ID', weekly);
  assert(weeklyAgain.created === 0, 'a second weekly run in the same week creates nothing', weeklyAgain);

  // --------------------------------------------------------------------------
  console.log('\n6. Outlet Admin offer editing permission and audit log');
  const { PATCH } = await import('../apps/web/app/api/outlet/settings/route');
  const outletAdmin = plainOutlet.admins[0]!;
  const token = signToken({ typ: 'outlet_admin', sub: outletAdmin.id }, 600);
  const patchOffers = (body: unknown) =>
    PATCH(
      new NextRequest('http://localhost/api/outlet/settings', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    );
  const denied = await patchOffers({ repeatDiscount: 15 });
  const deniedBody = (await denied.json()) as { code?: string };
  assert(
    denied.status === 403 && deniedBody.code === 'OFFERS_EDIT_FORBIDDEN',
    'outlet admin cannot edit offers unless allowed',
    deniedBody
  );
  await prisma.$transaction((tx) => applyOfferChanges(tx, plainOutlet.id, { canEditOffers: true }, superActor));
  const allowed = await patchOffers({ repeatDiscount: 15, gstPercentage: 12 });
  assert(allowed.status === 200, 'allowed outlet admin can edit offers', await allowed.clone().json());
  const audit = await prisma.outletOfferChange.findMany({
    where: { outletId: plainOutlet.id },
    orderBy: { createdAt: 'asc' },
  });
  const byAdmin = audit.filter((a) => a.actorType === 'OUTLET_ADMIN');
  assert(
    byAdmin.length === 2 &&
      byAdmin.some(
        (a) => a.field === 'repeatDiscount' && a.oldValue === null && a.newValue === '15' && a.actorEmail === outletAdmin.email
      ) &&
      byAdmin.some((a) => a.field === 'gstPercentage' && a.oldValue === '0' && a.newValue === '12') &&
      audit.some((a) => a.actorType === 'SUPER_ADMIN' && a.field === 'canEditOffers'),
    'every edit is audit-logged with who, old value, new value and when',
    audit
  );
  const oldBill = await prisma.bill.findUniqueOrThrow({
    where: { id: r2.bill.id },
  });
  assert(
    oldBill.finalAmount.equals(r2.bill.finalAmount) && oldBill.gstAmount.toNumber() === 0,
    'earlier bills at that outlet are unchanged'
  );

  // --------------------------------------------------------------------------
  console.log('\n7. Partner on the previous app version');
  const { POST: register } = await import('../apps/web/app/api/partner/onboarding/route');
  const mobile = uniqueMobile();
  const email = `old-${rand().toLowerCase()}@lmw-rf.test`;
  await prisma.otpVerification.create({
    data: {
      identifier: mobile,
      channel: 'email',
      codeHash: 'x',
      expiresAt: new Date(Date.now() + 600_000),
      verified: true,
    },
  });
  // Exactly the payload the previous Partner App sends: no upiId.
  const res = await register(
    new NextRequest('http://localhost/api/partner/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Old App User',
        mobile,
        email,
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        password: 'secret12',
        confirmPassword: 'secret12',
        otp: '123456',
      }),
    })
  );
  const registered = (await res.json()) as {
    data?: {
      partner: { id: string; upiId: string | null };
      qrCodes: { code: string; type: string }[];
    };
  };
  assert(res.status === 201 && registered.data?.partner.upiId === null, 'registration without a UPI ID still works', registered);
  const oldQr = registered.data!.qrCodes.find((q) => q.type === 'DEFAULT_DISCOUNT')!.code;
  // The previous Outlet Admin app: preview, then create with the version it was given.
  const preview2 = await billing.previewBill(gstOutlet, {
    qrCode: oldQr,
    billAmount: 200,
  });
  const oldBillRes = await billing.createBill(gstOutlet, gstOutlet.admins[0]!.id, {
    qrCode: oldQr,
    billAmount: 200,
    idempotencyKey: key('old'),
    settingsVersion: preview2.settingsVersion,
  });
  assert(
    oldBillRes.bill.finalAmount === 189 && !oldBillRes.replayed,
    'that partner can be billed (₹200 → ₹180 + ₹9 GST = ₹189)',
    oldBillRes.bill
  );
  await expectError(
    () =>
      billing.createBill(gstOutlet, gstOutlet.admins[0]!.id, {
        qrCode: oldQr,
        billAmount: 300,
        idempotencyKey: key('stale'),
        settingsVersion: settings.updatedAt,
      }),
    'SETTINGS_CHANGED',
    'a preview made before an outlet offer change is refused (settings-changed check covers outlet offers)'
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
