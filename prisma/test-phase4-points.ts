import * as dotenv from 'dotenv';
import * as path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Never send real messages from tests: providers fall back to their logged dev mode.
// Blank (not deleted), because the Prisma client re-loads .env into unset variables.
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MSG91_AUTH_KEY', 'MSG91_INTEGRATED_NUMBER']) process.env[key] = '';

/**
 * LOT MORE WINS — PHASE 4 ACCEPTANCE TESTS (settings-driven billing, points, messaging)
 * Calls the billing engine directly against the database (no dev server needed).
 * Test records use the "lmw-p4.test" domain and are removed before and after the run;
 * the programme settings row is restored exactly.
 *
 *   npx tsx prisma/test-phase4-points.ts
 */

const TEST_DOMAIN = 'lmw-p4.test';

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

const rand = (n: number) => crypto.randomBytes(n).toString('hex').slice(0, n).toUpperCase();
const uniqueMobile = () => `9${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;
const key = (label: string) => `p4-${label}-${rand(8)}`;

async function main() {
  const { default: prisma } = await import('../apps/web/lib/prisma');
  const billing = await import('../apps/web/lib/billing');
  const { updateProgramSettings } = await import('../apps/web/lib/settings');
  const { claimPendingPoints, getPartnerWallet } = await import('../apps/web/lib/points');
  const { sendBillNotification } = await import('../apps/web/lib/bill-notifications');
  const { HttpError } = await import('../apps/web/lib/auth');

  const expectError = async (fn: () => Promise<unknown>, code: string, name: string) => {
    try {
      await fn();
      assert(false, name, 'no error thrown');
    } catch (e) {
      assert(e instanceof HttpError && e.code === code, name, e instanceof Error ? { code: (e as any).code, message: e.message } : e);
    }
  };

  async function cleanup() {
    const partners = await prisma.partner.findMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } }, select: { id: true } });
    const partnerIds = partners.map((p) => p.id);
    const outlets = await prisma.outlet.findMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } }, select: { id: true } });
    const outletIds = outlets.map((o) => o.id);
    await prisma.bill.deleteMany({ where: { outletId: { in: outletIds } } });
    await prisma.customer.deleteMany({ where: { OR: [{ name: { startsWith: 'P4 ' } }, { partnerId: { in: partnerIds } }] } });
    await prisma.outletAdmin.deleteMany({ where: { outletId: { in: outletIds } } });
    await prisma.outlet.deleteMany({ where: { id: { in: outletIds } } });
    await prisma.qRCode.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
  }

  async function createPartner(name: string, achariya: boolean, mobile = uniqueMobile()) {
    const partner = await prisma.partner.create({
      data: {
        partnerCode: `LMW-P-T${rand(5)}`,
        name,
        mobile,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}.${rand(6)}@${TEST_DOMAIN}`,
        passwordHash: 'x',
        isAchariyaAssociated: achariya,
        role: achariya ? 'STAFF' : 'NON_ACHARIYA',
      },
    });
    const disc = await prisma.qRCode.create({
      data: { partnerId: partner.id, code: `LMW-DISC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`, type: 'DEFAULT_DISCOUNT' },
    });
    const ref = await prisma.qRCode.create({
      data: { partnerId: partner.id, code: `LMW-REF-${crypto.randomBytes(8).toString('hex').toUpperCase()}`, type: 'REFERRAL' },
    });
    return { ...partner, discQr: disc.code, refQr: ref.code };
  }

  const baseSettings = {
    messagingMode: 'email' as const,
    firstTimeDiscount: { achariya: 20, nonAchariya: 15 },
    repeatDiscount: { achariya: 10, nonAchariya: 5 },
    referralDiscount: { achariya: 12, nonAchariya: 8 },
    pointsToRupees: { points: 10, rupees: 1 },
    referralPoints: { achariya: 3, nonAchariya: 2 },
    purchasePointsPercentage: 2,
    pointsBasis: 'PAYABLE_AMOUNT' as const,
    appDownloadUrl: 'https://play.google.com/store/apps/details?id=com.lotmorewins.partner',
  };

  const original = await prisma.programSetting.findUnique({ where: { id: 'GLOBAL' } });
  console.log('================================================================');
  console.log('LOT MORE WINS — PHASE 4 ACCEPTANCE TEST SUITE (points engine)');
  console.log('================================================================');

  await cleanup();
  try {
    const outlet = await prisma.outlet.create({
      data: { name: 'P4 Test Outlet', email: `outlet.${rand(6)}@${TEST_DOMAIN}`, mobile: uniqueMobile() },
    });
    const admin = await prisma.outletAdmin.create({
      data: { outletId: outlet.id, email: `admin.${rand(6)}@${TEST_DOMAIN}`, passwordHash: 'x' },
    });
    const ach = await createPartner('P4 Achariya Partner', true);
    const nonAch = await createPartner('P4 NonAchariya Partner', false);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 1: SETTINGS ARE THE ONLY SOURCE ---');
    // ------------------------------------------------------------------------
    await prisma.programSetting.deleteMany({ where: { id: 'GLOBAL' } });
    await expectError(() => billing.scanQr(outlet, nonAch.discQr), 'SETTINGS_NOT_CONFIGURED', 'Scan refused when settings were never saved');
    await expectError(
      () => billing.previewBill(outlet, { qrCode: nonAch.discQr, billAmount: 100 }),
      'SETTINGS_NOT_CONFIGURED',
      'Preview refused when settings were never saved'
    );
    await expectError(
      () => billing.createBill(outlet, admin.id, { qrCode: nonAch.discQr, billAmount: 100, idempotencyKey: key('noset') }),
      'SETTINGS_NOT_CONFIGURED',
      'Bill refused when settings were never saved (no silent defaults)'
    );
    assert((await prisma.bill.count({ where: { outletId: outlet.id } })) === 0, 'No bill was created without settings');

    let settings = await updateProgramSettings(baseSettings, 'p4-test');

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 2: DIRECT PARTNER QR ---');
    // ------------------------------------------------------------------------
    const scanDirect = await billing.scanQr(outlet, nonAch.discQr);
    assert(
      scanDirect.discount.isFirstTime === true && scanDirect.discount.discountPercentage === 15 && scanDirect.settingsVersion === settings.updatedAt,
      'Scan: first-time (register bonus) Non-Achariya discount 15% from settings',
      scanDirect
    );
    const d1 = await billing.createBill(outlet, admin.id, { qrCode: nonAch.discQr, billAmount: 1000, idempotencyKey: key('d1') });
    assert(
      d1.bill.discountAmount === 150 && d1.bill.finalAmount === 850 && d1.bill.purchasePoints === 170 && d1.bill.referralPoints === 0,
      'Direct first bill: ₹1000 − 15% = ₹850; purchase points 850 × 2% × 10 = 170',
      d1.bill
    );
    assert(d1.bill.purchasePointsRecipient === 'PARTNER', 'Direct bill purchase points go to the partner');
    const d2 = await billing.createBill(outlet, admin.id, { qrCode: nonAch.discQr, billAmount: 2000, idempotencyKey: key('d2') });
    assert(
      d2.bill.isFirstTime === false && d2.bill.discountPercentage === 5 && d2.bill.purchasePoints === 380,
      'Direct repeat bill: repeat discount 5%, points 1900 × 2% × 10 = 380',
      d2.bill
    );
    const replay = await billing.createBill(outlet, admin.id, {
      qrCode: nonAch.discQr,
      billAmount: 2000,
      idempotencyKey: (await prisma.bill.findUniqueOrThrow({ where: { id: d2.bill.id } })).idempotencyKey,
    });
    assert(replay.replayed === true, 'Retry with the same idempotency key replays the bill');
    let nonAchWallet = await getPartnerWallet(nonAch.id);
    assert(nonAchWallet.balancePoints === 550 && nonAchWallet.rupeeValue === 55, 'Partner wallet 170 + 380 = 550 pts = ₹55 (no double credit on replay)', nonAchWallet);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 3: REFERRAL QR, NEW CUSTOMER (PENDING POINTS) ---');
    // ------------------------------------------------------------------------
    const scanRef = await billing.scanQr(outlet, ach.refQr);
    assert(
      scanRef.qrType === 'REFERRAL' && scanRef.discount.isFirstTime === null && scanRef.discount.discountPercentage === 12,
      'Scan: referral discount 12% (referrer Achariya) known before customer entry',
      scanRef
    );
    const custMobile = uniqueMobile();
    const customer = { name: 'P4 Referred Customer', mobile: custMobile, email: `cust.${rand(6)}@${TEST_DOMAIN}` };
    const preview = await billing.previewBill(outlet, { qrCode: ach.refQr, billAmount: 500, customer });
    assert(
      preview.discountAmount === 60 && preview.finalAmount === 440 && preview.purchasePoints === 88 && preview.referralPoints === 132,
      'Referral preview: ₹500 − 12% = ₹440; customer 88 pts, referrer 440 × 3% × 10 = 132 pts',
      preview
    );
    assert(preview.purchasePointsRecipient === 'CUSTOMER_PENDING', 'Unregistered customer points are pending');
    const r1 = await billing.createBill(outlet, admin.id, {
      qrCode: ach.refQr,
      billAmount: 500,
      customer,
      idempotencyKey: key('r1'),
      settingsVersion: preview.settingsVersion,
    });
    assert(r1.bill.purchasePoints === 88 && r1.bill.referralPoints === 132, 'Referral bill stores both point amounts', r1.bill);
    const pending = await prisma.pointsEntry.findFirst({ where: { billId: r1.bill.id, type: 'PURCHASE' } });
    assert(!!pending && pending.partnerId === null && pending.customerId !== null, 'Customer purchase points held against the mobile (no partner yet)', pending);
    const achWallet = await getPartnerWallet(ach.id);
    assert(achWallet.balancePoints === 132 && achWallet.totals.referralPoints === 132, 'Referring partner wallet credited 132 referral points', achWallet);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 4: CUSTOMER REGISTERS AS PARTNER ---');
    // ------------------------------------------------------------------------
    const lookup = await billing.lookupCustomer(custMobile);
    assert(lookup?.name === customer.name && lookup?.isPartner === false, 'Customer lookup prefills a known customer', lookup);
    const newPartner = await createPartner('P4 Customer Turned Partner', false, custMobile);
    const claim = await prisma.$transaction((tx) => claimPendingPoints(tx, newPartner.id, custMobile));
    assert(claim.claimedPoints === 88 && claim.claimedEntries === 1, 'Registration claims the 88 pending points', claim);
    const newWallet = await getPartnerWallet(newPartner.id);
    assert(newWallet.balancePoints === 88 && newWallet.entries[0]?.claimedAt !== null, 'New partner wallet shows claimed points', newWallet);
    const linked = await prisma.customer.findUnique({ where: { mobile: custMobile } });
    assert(linked?.partnerId === newPartner.id, 'Customer linked to the new partner');
    const newScan = await billing.scanQr(outlet, newPartner.discQr);
    assert(
      newScan.discount.isFirstTime === true && newScan.discount.discountPercentage === 15,
      'Customer-turned-partner gets the Non-Achariya first-time (register bonus) discount',
      newScan.discount
    );

    const r2 = await billing.createBill(outlet, admin.id, {
      qrCode: ach.refQr,
      billAmount: 250,
      customer: { ...customer, email: null },
      idempotencyKey: key('r2'),
    });
    assert(r2.bill.purchasePointsRecipient === 'CUSTOMER_PARTNER', 'Later referral bill credits the registered partner directly');
    const direct = await prisma.pointsEntry.findFirst({ where: { billId: r2.bill.id, type: 'PURCHASE' } });
    assert(direct?.partnerId === newPartner.id && direct.claimedAt === null, 'Purchase points credited straight to the wallet', direct);
    await expectError(
      () => billing.previewBill(outlet, { qrCode: newPartner.refQr, billAmount: 100, customer: { name: 'Self', mobile: custMobile } }),
      'SELF_REFERRAL',
      'Partner cannot use their own referral QR'
    );

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 5: SETTINGS CHANGES ---');
    // ------------------------------------------------------------------------
    const before = await billing.previewBill(outlet, { qrCode: nonAch.discQr, billAmount: 3000 });
    await new Promise((r) => setTimeout(r, 20));
    settings = await updateProgramSettings({ ...baseSettings, purchasePointsPercentage: 4, pointsBasis: 'BILL_AMOUNT' }, 'p4-test');
    await expectError(
      () =>
        billing.createBill(outlet, admin.id, {
          qrCode: nonAch.discQr,
          billAmount: 3000,
          idempotencyKey: key('stale'),
          settingsVersion: before.settingsVersion,
        }),
      'SETTINGS_CHANGED',
      'Bill confirmed against an old preview is refused after a settings change'
    );
    const d3 = await billing.createBill(outlet, admin.id, {
      qrCode: nonAch.discQr,
      billAmount: 3000,
      idempotencyKey: key('d3'),
      settingsVersion: settings.updatedAt,
    });
    assert(
      d3.bill.purchasePointsPercentage === 4 && d3.bill.pointsBasis === 'BILL_AMOUNT' && d3.bill.purchasePoints === 1200,
      'New settings apply at once: 4% of the full ₹3000 bill × 10 = 1200 pts',
      d3.bill
    );
    const oldBill = await billing.getOutletBill(outlet.id, d1.bill.id);
    assert(
      oldBill.purchasePointsPercentage.toNumber() === 2 && oldBill.pointsBasis === 'PAYABLE_AMOUNT' && oldBill.purchasePoints.toNumber() === 170,
      'Earlier bills keep the settings they were made with'
    );

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 6: BILL MESSAGES ---');
    // ------------------------------------------------------------------------
    const reserved = await sendBillNotification(r1.bill.id);
    assert(
      reserved.notification.status === 'SKIPPED' && reserved.notification.channel === 'email' && reserved.notification.recipient === customer.email,
      'Email mode targets the customer email; reserved .test domain is never sent to',
      reserved.notification
    );
    const lead = await prisma.bill.findUniqueOrThrow({ where: { id: r2.bill.id }, include: { customer: true } });
    if (lead.customer) await prisma.customer.update({ where: { id: lead.customer.id }, data: { email: null } });
    const skipped = await sendBillNotification(r2.bill.id);
    assert(skipped.notification.status === 'SKIPPED' && !!skipped.notification.error, 'No email on file in email mode → SKIPPED with a reason', skipped.notification);
    await updateProgramSettings({ ...baseSettings, messagingMode: 'whatsapp' }, 'p4-test');
    const wa = await sendBillNotification(r2.bill.id);
    assert(
      wa.notification.status === 'SENT' && wa.notification.channel === 'whatsapp' && wa.notification.recipient === custMobile && wa.notification.attempts === 2,
      'Resend follows the current messaging mode (WhatsApp to the customer mobile)',
      wa.notification
    );
    const direct1 = await sendBillNotification(d1.bill.id);
    assert(direct1.notification.recipient === nonAch.mobile, 'Direct bill message goes to the partner', direct1.notification);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 7: HISTORY ---');
    // ------------------------------------------------------------------------
    const history = await billing.listOutletBills(outlet.id, 1, 50, 'today');
    assert(history.total === 5 && history.summary.purchasePoints === 170 + 380 + 88 + 1200 + history.bills.find((b) => b.id === r2.bill.id)!.purchasePoints, 'Today history counts bills and totals points', history.summary);
  } finally {
    await cleanup();
    if (original) {
      const { id, createdAt, updatedAt, ...rest } = original;
      void createdAt;
      void updatedAt;
      await prisma.programSetting.upsert({ where: { id }, create: { id, ...rest }, update: rest });
    } else {
      await prisma.programSetting.deleteMany({ where: { id: 'GLOBAL' } });
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`PHASE 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal Phase 4 test error:', e);
  process.exit(1);
});
