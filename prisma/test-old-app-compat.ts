/**
 * LOT MORE WINS — OLD APP COMPATIBILITY + WALLET RULES (test database only).
 * - Partner App v1.0.0: password sign-in, registration with a password.
 * - Outlet Admin app v1.0.0: wallet redemption ({ qrCode, rupees, billAmount }) as a redeem bill.
 * - Redeem QR worth the whole wallet; the bill takes at most half; the rest stays in the wallet.
 * - One transfer sends at most half the wallet.
 * It WRITES DATA, so it runs only against TEST_DATABASE_URL and never the LIVE_DATABASE_URL host:
 *
 *   node node_modules/tsx/dist/cli.mjs --tsconfig apps/web/tsconfig.json prisma/test-old-app-compat.ts
 */
import crypto from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';

const env = dotenv.config({ path: path.resolve(__dirname, '../.env'), processEnv: {} }).parsed ?? {};
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace('-pooler', '');
  } catch {
    return '';
  }
};
const TEST_URL = env.TEST_DATABASE_URL ?? '';
const LIVE_URL = env.LIVE_DATABASE_URL ?? '';
if (!TEST_URL || !LIVE_URL || hostOf(TEST_URL) === hostOf(LIVE_URL)) {
  console.error('Refusing to run: TEST_DATABASE_URL and LIVE_DATABASE_URL must both be set and differ.');
  process.exit(1);
}
process.env.DATABASE_URL = TEST_URL;
process.env.JWT_SECRET ||= env.JWT_SECRET || 'old-app-compat-test-secret-0123456789abcdef';
for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MSG91_AUTH_KEY', 'MSG91_INTEGRATED_NUMBER', 'RESEND_API_KEY']) process.env[key] = '';

let passed = 0;
let failed = 0;
function assert(condition: boolean, name: string, details?: unknown) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${name}`, details === undefined ? '' : JSON.stringify(details, null, 2));
    failed++;
  }
}
const rand = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const uniqueMobile = () => `9${String(crypto.randomInt(0, 999_999_999)).padStart(9, '0')}`;

async function main() {
  const { default: prisma } = await import('../apps/web/lib/prisma');
  const bcrypt = (await import('bcryptjs')).default;
  const { signToken, HttpError } = await import('../apps/web/lib/auth');
  const { requireConfiguredSettings } = await import('../apps/web/lib/settings');
  const { availablePoints, rupeeValueOf, getPartnerWallet } = await import('../apps/web/lib/points');
  const redemptions = await import('../apps/web/lib/redemptions');
  const transfers = await import('../apps/web/lib/wallet-transfers');
  const { POST: login } = await import('../apps/web/app/api/partner/auth/login/route');
  const { POST: register } = await import('../apps/web/app/api/partner/onboarding/route');
  const { POST: legacyRedeem } = await import('../apps/web/app/api/outlet/redemptions/route');
  const { NextRequest } = await import('next/server');

  const call = async (handler: (req: InstanceType<typeof NextRequest>) => Promise<Response>, url: string, body: unknown, token?: string) => {
    const res = await handler(
      new NextRequest(`http://localhost${url}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': `10.9.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`,
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
    );
    return { status: res.status, json: (await res.json()) as { data?: any; code?: string; message?: string; error?: any } };
  };
  const expectError = async (fn: () => Promise<unknown>, code: string, name: string) => {
    try {
      await fn();
      assert(false, name, 'no error thrown');
    } catch (e) {
      assert(e instanceof HttpError && e.code === code, name, e instanceof HttpError ? { code: e.code, message: e.message } : String(e));
    }
  };

  const makePartner = async (password?: string) => {
    const id = rand();
    return prisma.partner.create({
      data: {
        partnerCode: `LMW-P-${id.slice(0, 6)}`,
        name: `Compat Partner ${id}`,
        mobile: uniqueMobile(),
        email: `c-${id.toLowerCase()}@lmw-compat.test`,
        passwordHash: await bcrypt.hash(password ?? crypto.randomBytes(32).toString('hex'), 10),
        qrCodes: {
          create: [
            { code: `LMW-DISC-${rand()}${rand()}`, type: 'DEFAULT_DISCOUNT' },
            { code: `LMW-REF-${rand()}${rand()}`, type: 'REFERRAL' },
          ],
        },
      },
    });
  };

  // --------------------------------------------------------------------------
  console.log('\n1. Partner App v1.0.0: password sign-in');
  const oldUser = await makePartner('secret12');
  let r = await call(login, '/api/partner/auth/login', { identifier: oldUser.mobile, password: 'secret12' });
  assert(r.status === 200 && typeof r.json.data?.token === 'string' && r.json.data?.partner?.id === oldUser.id, 'mobile + password signs in', r);
  r = await call(login, '/api/partner/auth/login', { identifier: oldUser.email.toUpperCase(), password: 'secret12' });
  assert(r.status === 200, 'email (any case) + password signs in', r);
  r = await call(login, '/api/partner/auth/login', { identifier: oldUser.mobile, password: 'wrong-pass' });
  assert(r.status === 401 && r.json.code === 'INVALID_CREDENTIALS', 'a wrong password is refused (401)', r);
  r = await call(login, '/api/partner/auth/login', { identifier: '9999999998', password: 'secret12' });
  assert(r.status === 401, 'an unknown account is refused the same way', r);
  const codeOnly = await makePartner();
  r = await call(login, '/api/partner/auth/login', { identifier: codeOnly.mobile, password: 'anything' });
  assert(r.status === 401, 'a partner registered without a password cannot use one', r);
  r = await call(login, '/api/partner/auth/login', { identifier: codeOnly.mobile, otp: '000000' });
  assert(r.status === 400 && ['OTP_INVALID', 'OTP_EXPIRED'].includes(r.json.code ?? ''), 'code sign-in (current app) still goes through the code check', r);

  // --------------------------------------------------------------------------
  console.log('\n2. Partner App v1.0.0: registration with a password');
  const mobile = uniqueMobile();
  const email = `old-${rand().toLowerCase()}@lmw-compat.test`;
  await prisma.otpVerification.create({
    data: { identifier: mobile, channel: 'email', codeHash: 'x', expiresAt: new Date(Date.now() + 600_000), verified: true },
  });
  r = await call(register, '/api/partner/onboarding', {
    name: 'Old App User',
    mobile,
    email,
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    password: 'mypass99',
    confirmPassword: 'mypass99',
    otp: '123456',
  });
  assert(r.status === 201, 'old registration payload is accepted', r);
  r = await call(login, '/api/partner/auth/login', { identifier: mobile, password: 'mypass99' });
  assert(r.status === 200, 'that partner signs in with the password they chose', r);
  const mobile2 = uniqueMobile();
  await prisma.otpVerification.create({
    data: { identifier: mobile2, channel: 'email', codeHash: 'x', expiresAt: new Date(Date.now() + 600_000), verified: true },
  });
  r = await call(register, '/api/partner/onboarding', {
    name: 'Old App User',
    mobile: mobile2,
    email: `old-${rand().toLowerCase()}@lmw-compat.test`,
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    password: 'mypass99',
    confirmPassword: 'other999',
    otp: '123456',
  });
  assert(r.status === 400, 'mismatched passwords are refused', r);

  // --------------------------------------------------------------------------
  // Wallet fixtures: redeem QR on for the run (restored after).
  const settingsRow = await prisma.programSetting.findFirstOrThrow();
  await prisma.programSetting.update({ where: { id: settingsRow.id }, data: { redeemQrEnabled: true } });
  try {
    const settings = await requireConfiguredSettings();
    const ratio = settings.pointsToRupees;
    const pointsFor = (rupees: number) => (rupees * ratio.points) / ratio.rupees;
    const rupeesOf = async (partnerId: string) => rupeeValueOf(await availablePoints(prisma, partnerId), ratio).toNumber();

    const outlet = await prisma.outlet.create({
      data: {
        name: `Compat Outlet ${rand()}`,
        email: `o-${rand().toLowerCase()}@lmw-compat.test`,
        mobile: uniqueMobile(),
        admins: { create: { email: `oa-${rand().toLowerCase()}@lmw-compat.test`, passwordHash: 'x' } },
      },
      include: { admins: true },
    });
    const adminId = outlet.admins[0]!.id;
    const fund = async (rupees: number) => {
      const p = await makePartner();
      await prisma.pointsEntry.create({ data: { type: 'PURCHASE', points: pointsFor(rupees), partnerId: p.id } });
      return p;
    };

    // ------------------------------------------------------------------------
    console.log('\n3. Redeem QR worth the whole wallet; the bill takes half; the rest stays');
    const payer = await fund(400);
    const qr = await redemptions.createRedeemQr(payer.id);
    assert(qr.maxRupees === 400, 'a ₹400 wallet generates a QR worth ₹400', qr);
    const wallet = await getPartnerWallet(payer.id);
    assert(wallet.redeemMaxRupees === 400 && wallet.transferMaxRupees === 200, 'wallet: redeem up to ₹400, send up to ₹200', {
      redeemMaxRupees: wallet.redeemMaxRupees,
      transferMaxRupees: wallet.transferMaxRupees,
    });
    const scan = await redemptions.scanRedeemQr(outlet, qr.code);
    assert(scan.maxRupees === 400, 'the outlet sees the QR worth ₹400', scan);
    const preview = await redemptions.previewRedeemBill(outlet, { qrCode: qr.code, billAmount: 200 });
    assert(preview.walletRedeemAmount === 100 && preview.finalAmount === 100, '₹200 bill: wallet pays ₹100, customer pays ₹100', preview);
    const done = await redemptions.createRedeemBill(outlet, adminId, {
      qrCode: qr.code,
      billAmount: 200,
      idempotencyKey: `compat-${rand()}`,
      settingsVersion: preview.settingsVersion,
    });
    assert(done.bill.walletRedeemAmount === 100 && done.bill.transactionType === 'WALLET_REDEEM', 'the redeem bill is completed', done.bill);
    assert((await rupeesOf(payer.id)) === 300, '₹300 is left in the wallet', await rupeesOf(payer.id));
    await expectError(
      () => redemptions.createRedeemBill(outlet, adminId, { qrCode: qr.code, billAmount: 200, idempotencyKey: `compat-${rand()}` }),
      'REDEEM_QR_USED',
      'the same QR cannot be used twice'
    );
    const small = await fund(60);
    const smallQr = await redemptions.createRedeemQr(small.id);
    const smallPreview = await redemptions.previewRedeemBill(outlet, { qrCode: smallQr.code, billAmount: 200 });
    assert(smallPreview.walletRedeemAmount === 60 && smallPreview.finalAmount === 140, 'a ₹60 wallet on a ₹200 bill pays all ₹60', smallPreview);

    // ------------------------------------------------------------------------
    console.log('\n4. Outlet Admin app v1.0.0: old redemption becomes a redeem bill');
    const oldPayer = await fund(400);
    const oldQr = await redemptions.createRedeemQr(oldPayer.id);
    const token = signToken({ typ: 'outlet_admin', sub: adminId });
    r = await call(legacyRedeem, '/api/outlet/redemptions', { qrCode: oldQr.code, rupees: 150, billAmount: 200 }, token);
    assert(r.status === 422 && r.json.code === 'REDEEM_OVER_LIMIT' && /₹100\.00/.test(r.json.message ?? ''), 'more than half the bill is refused with the most allowed (₹100)', r);
    r = await call(legacyRedeem, '/api/outlet/redemptions', { qrCode: oldQr.code, rupees: 80, billAmount: 200 }, token);
    assert(
      r.status === 201 && r.json.data?.rupeeValue === 80 && r.json.data?.payableAmount === 120 && r.json.data?.billAmount === 200,
      '₹80 of a ₹200 bill: receipt in the old shape, customer pays ₹120',
      r
    );
    assert(r.json.data?.balanceRupeeValue === 320 && r.json.data?.replayed === false, 'receipt shows ₹320 left in the wallet', r.json.data);
    const receiptId = r.json.data?.id;
    r = await call(legacyRedeem, '/api/outlet/redemptions', { qrCode: oldQr.code, rupees: 80, billAmount: 200 }, token);
    assert(r.status === 200 && r.json.data?.replayed === true && r.json.data?.id === receiptId, 'a retry replays the same receipt', r);
    assert((await rupeesOf(oldPayer.id)) === 320, 'nothing extra was taken by the retry', await rupeesOf(oldPayer.id));
    const bill = await prisma.bill.findUniqueOrThrow({ where: { id: receiptId } });
    assert(bill.transactionType === 'WALLET_REDEEM' && bill.walletRedeemAmount.toNumber() === 80, 'it is recorded as a redeem bill', bill);

    // ------------------------------------------------------------------------
    console.log('\n5. Transfers: at most half the wallet');
    const sender = await fund(400);
    const recipient = await makePartner();
    await expectError(
      () => transfers.requestTransferOtp(sender.id, recipient.mobile, pointsFor(250)),
      'TRANSFER_LIMIT',
      'sending ₹250 of a ₹400 wallet is refused'
    );
    await expectError(
      () => transfers.requestTransferOtp(sender.id, recipient.mobile, pointsFor(500)),
      'INSUFFICIENT_POINTS',
      'more than the wallet holds is still "not enough"'
    );
    // Within the limit the check passes and a code is sent (or sending fails without SMTP, after the checks).
    try {
      await transfers.requestTransferOtp(sender.id, recipient.mobile, pointsFor(200));
      assert(true, 'sending exactly half (₹200) passes the checks');
    } catch (e) {
      assert(!(e instanceof HttpError && ['TRANSFER_LIMIT', 'INSUFFICIENT_POINTS'].includes(e.code ?? '')), 'sending exactly half (₹200) passes the checks', String(e));
    }
  } finally {
    await prisma.programSetting.update({ where: { id: settingsRow.id }, data: { redeemQrEnabled: settingsRow.redeemQrEnabled } });
  }

  // --------------------------------------------------------------------------
  console.log('\n6. App store review login (fixed code for one account)');
  const { POST: requestCode } = await import('../apps/web/app/api/partner/auth/otp/route');
  const reviewer = await makePartner();
  const other = await makePartner();
  process.env.REVIEW_LOGIN_EMAIL = reviewer.email;
  process.env.REVIEW_LOGIN_OTP = '246810';
  r = await call(requestCode, '/api/partner/auth/otp', { identifier: reviewer.email });
  assert(r.status === 200, 'the review account can request a code (no email is sent)', r);
  r = await call(login, '/api/partner/auth/login', { identifier: reviewer.email, otp: '246810' });
  assert(r.status === 200 && r.json.data?.partner?.id === reviewer.id, 'it signs in with the fixed code', r);
  r = await call(requestCode, '/api/partner/auth/otp', { identifier: other.mobile });
  r = await call(login, '/api/partner/auth/login', { identifier: other.mobile, otp: '246810' });
  assert(r.status === 400 && r.json.code === 'OTP_INVALID', 'the fixed code does not work for any other partner', r);
  process.env.REVIEW_LOGIN_OTP = '';
  r = await call(requestCode, '/api/partner/auth/otp', { identifier: reviewer.email });
  r = await call(login, '/api/partner/auth/login', { identifier: reviewer.email, otp: '246810' });
  assert(r.status === 400, 'without REVIEW_LOGIN_OTP set, the fixed code is off', r);

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
