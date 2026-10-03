import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient, type ProgramSetting } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * LOT MORE WINS — PHASE 3 ACCEPTANCE TESTS
 * Runs against a live API (NEXT_PUBLIC_API_URL). Test records use the "lmw-p3.test" domain,
 * are removed before and after the run, and the programme settings row is restored.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const TEST_DOMAIN = 'lmw-p3.test';
const prisma = new PrismaClient();

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

interface Res {
  status: number;
  data: any;
  headers: Headers;
}

async function request(
  endpoint: string,
  opts: { method?: string; body?: unknown; token?: string; cookie?: string; headers?: Record<string, string> } = {}
): Promise<Res> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  Object.assign(headers, opts.headers);
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // non-JSON (e.g. media)
  }
  return { status: res.status, data, headers: res.headers };
}

const rand = (digits: number) => Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join('');
const uniqueMobile = () => `7${rand(9)}`;
const hex16 = () => Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
const key = (label: string) => `p3-${label}-${Date.now()}-${rand(6)}`;

async function cleanup() {
  const outlets = await prisma.outlet.findMany({
    where: { admins: { some: { email: { endsWith: `@${TEST_DOMAIN}` } } } },
    select: { id: true, images: true, logoUrl: true },
  });
  const outletIds = outlets.map((o) => o.id);
  const mediaIds = outlets
    .flatMap((o) => [o.logoUrl, ...o.images])
    .map((u) => /^\/api\/media\/(.+)$/.exec(u ?? '')?.[1])
    .filter((id): id is string => !!id);

  await prisma.bill.deleteMany({ where: { outletId: { in: outletIds } } });
  await prisma.customer.deleteMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: 'P3 ' } } });
  await prisma.outletAdmin.deleteMany({ where: { outletId: { in: outletIds } } });
  await prisma.outlet.deleteMany({ where: { id: { in: outletIds } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
  await prisma.qRCode.deleteMany({ where: { partner: { email: { endsWith: `@${TEST_DOMAIN}` } } } });
  await prisma.partner.deleteMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } } });
  await prisma.superAdmin.deleteMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } } });
  await prisma.loginAttempt.deleteMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } } });
}

async function createPartner(name: string) {
  const mobile = uniqueMobile();
  const partner = await prisma.partner.create({
    data: {
      partnerCode: `LMW-P-T${rand(5)}`,
      name,
      mobile,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}.${rand(6)}@${TEST_DOMAIN}`,
      passwordHash: bcrypt.hashSync('Password@123', 4),
      city: 'Puducherry',
      state: 'Puducherry',
      pincode: '605001',
      status: 'ACTIVE',
      qrCodes: {
        create: [
          { code: `LMW-DISC-${hex16()}`, type: 'DEFAULT_DISCOUNT' },
          { code: `LMW-REF-${hex16()}`, type: 'REFERRAL' },
        ],
      },
    },
    include: { qrCodes: true },
  });
  return {
    ...partner,
    discQr: partner.qrCodes.find((q) => q.type === 'DEFAULT_DISCOUNT')!.code,
    refQr: partner.qrCodes.find((q) => q.type === 'REFERRAL')!.code,
  };
}

async function run() {
  console.log('================================================================');
  console.log('LOT MORE WINS — PHASE 3 ACCEPTANCE TEST SUITE');
  console.log('Target API:', BASE_URL);
  console.log('================================================================\n');

  // Retry the first connection (serverless database cold starts / transient resets).
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch (error) {
      if (attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  await cleanup();
  const originalSettings: ProgramSetting | null = await prisma.programSetting.findUnique({ where: { id: 'GLOBAL' } });

  try {
    // ------------------------------------------------------------------------
    // Fixtures
    // ------------------------------------------------------------------------
    const adminEmail = `super.${rand(6)}@${TEST_DOMAIN}`;
    const adminPassword = `P3-${rand(8)}-pass`;
    await prisma.superAdmin.create({
      data: { name: 'P3 Super Admin', email: adminEmail, passwordHash: bcrypt.hashSync(adminPassword, 10) },
    });

    const partnerA = await createPartner('P3 First Partner');
    const partnerB = await createPartner('P3 Second Partner');
    const revokedPartner = await createPartner('P3 Revoked Partner');
    const suspendedPartner = await createPartner('P3 Suspended Partner');
    await prisma.qRCode.updateMany({ where: { partnerId: revokedPartner.id }, data: { status: 'REVOKED' } });
    await prisma.partner.update({ where: { id: suspendedPartner.id }, data: { status: 'SUSPENDED' } });

    // ------------------------------------------------------------------------
    console.log('--- SUITE 1: SUPER ADMIN AUTHENTICATION ---');
    // ------------------------------------------------------------------------
    const badLogin = await request('/admin/auth/login', { method: 'POST', body: { email: adminEmail, password: 'wrong-password' } });
    assert(badLogin.status === 401, 'Wrong Super Admin password rejected', badLogin.data);

    const login = await request('/admin/auth/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
    const setCookie = login.headers.get('set-cookie') ?? '';
    const adminCookie = setCookie.split(';')[0];
    assert(login.status === 200 && adminCookie.startsWith('lmw_admin_session='), 'Super Admin login issues session cookie', login.data);
    assert(/httponly/i.test(setCookie), 'Session cookie is httpOnly');
    assert(!JSON.stringify(login.data).includes('passwordHash'), 'Login response never includes a password hash');

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 2: SETTINGS ---');
    // ------------------------------------------------------------------------
    const read = await request('/admin/settings', { cookie: adminCookie });
    assert(read.status === 200 && typeof read.data.data.messagingMode === 'string', 'Super Admin can read settings', read.data);

    const validSettings = {
      messagingMode: 'email',
      firstTimeDiscount: 20,
      repeatDiscount: 10,
      birthdayBonusDiscount: 5,
      pointsToRupees: { points: 10, rupees: 1 },
      referralDiscount: 12,
      // A goal these suites never reach, so no bill here is given the referral reward discount.
      referralRewardGoal: 1000,
      referralRewardDiscount: 20,
      referralPointsPercentage: 3,
      purchasePointsPercentage: 1.5,
      pointsBasis: 'PAYABLE_AMOUNT',
      appDownloadUrl: 'https://play.google.com/store/apps/details?id=com.lotmorewins.partner',
    };
    const update = await request('/admin/settings', { method: 'PUT', cookie: adminCookie, body: validSettings });
    assert(update.status === 200 && update.data.data.isPersisted === true, 'Super Admin can update settings', update.data);
    const reread = await request('/admin/settings', { cookie: adminCookie });
    const s = reread.data.data;
    assert(
      s.firstTimeDiscount === 20 && s.repeatDiscount === 10 && s.birthdayBonusDiscount === 5,
      'First-time, repeat and birthday bonus discounts persisted',
      s
    );
    assert(s.pointsToRupees.points === 10 && s.pointsToRupees.rupees === 1, 'Points-to-rupees ratio persisted (10 : ₹1)', s);
    assert(s.referralPointsPercentage === 3, 'Referral points percentage persisted', s);
    assert(s.purchasePointsPercentage === 1.5, 'Purchase points percentage persisted', s);
    assert(s.referralDiscount === 12, 'Referral discount persisted', s);
    assert(s.pointsBasis === 'PAYABLE_AMOUNT', 'Points basis persisted', s);
    assert(s.appDownloadUrl === validSettings.appDownloadUrl, 'App download link persisted', s);

    const noAuth = await request('/admin/settings', { method: 'PUT', body: validSettings });
    assert(noAuth.status === 401, 'Unauthenticated settings update rejected (401)', noAuth.data);

    const invalid = async (body: unknown, name: string) => {
      const r = await request('/admin/settings', { method: 'PUT', cookie: adminCookie, body });
      assert(r.status === 400, name, r.data);
    };
    await invalid({ ...validSettings, firstTimeDiscount: 101 }, 'Percentage above 100 rejected');
    await invalid({ ...validSettings, repeatDiscount: -1 }, 'Negative percentage rejected');
    await invalid({ ...validSettings, firstTimeDiscount: { achariya: 20, nonAchariya: 15 } }, 'Per-classification percentages are no longer accepted');
    await invalid({ ...validSettings, pointsToRupees: { points: 0, rupees: 1 } }, 'Zero points ratio rejected');
    await invalid({ ...validSettings, pointsToRupees: { points: 10, rupees: -5 } }, 'Negative rupees ratio rejected');
    await invalid({ ...validSettings, messagingMode: 'sms' }, 'Invalid messaging mode rejected');
    await invalid({ ...validSettings, referralDiscount: 150 }, 'Referral discount above 100 rejected');
    await invalid({ ...validSettings, pointsBasis: 'NET' }, 'Invalid points basis rejected');
    await invalid({ ...validSettings, appDownloadUrl: 'javascript:alert(1)' }, 'Non-http app download link rejected');
    await invalid({ ...validSettings, role: 'SUPER_ADMIN' }, 'Unknown fields (e.g. client-supplied role) rejected');

    // Messaging mode persists and drives runtime OTP routing (env stays "email")
    const toWhatsApp = await request('/admin/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: { ...validSettings, messagingMode: 'whatsapp' },
    });
    assert(toWhatsApp.status === 200 && toWhatsApp.data.data.messagingMode === 'whatsapp', 'Messaging mode set to WhatsApp', toWhatsApp.data);
    const persistedMode = await prisma.programSetting.findUnique({ where: { id: 'GLOBAL' } });
    assert(persistedMode?.messagingMode === 'WHATSAPP', 'Messaging mode persisted in the database');
    const waOtp = await request('/auth/otp', {
      method: 'POST',
      body: { identifier: uniqueMobile(), email: `otp.${rand(6)}@example.com`, name: 'P3 OTP' },
    });
    assert(waOtp.status === 200 && waOtp.data.channel === 'whatsapp', 'OTP routed via WhatsApp from the database setting', waOtp.data);

    const backToEmail = await request('/admin/settings', { method: 'PUT', cookie: adminCookie, body: validSettings });
    assert(backToEmail.data.data.messagingMode === 'email', 'Messaging mode switched back to Email', backToEmail.data);
    const emailOtp = await request('/auth/otp', {
      method: 'POST',
      body: { identifier: uniqueMobile(), email: `otp.${rand(6)}@example.com`, name: 'P3 OTP' },
    });
    assert(emailOtp.status === 200 && emailOtp.data.channel === 'email', 'OTP routed via Email from the database setting', emailOtp.data);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 3: OUTLET MANAGEMENT ---');
    // ------------------------------------------------------------------------
    const outletBody = (name: string, adminLogin: string) => ({
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@${TEST_DOMAIN}`,
      mobile: `+91 ${uniqueMobile()}`,
      adminEmail: adminLogin,
      adminPassword: 'OutletPass#123',
    });
    const adminAEmail = `outlet.a.${rand(6)}@${TEST_DOMAIN}`;
    const adminBEmail = `outlet.b.${rand(6)}@${TEST_DOMAIN}`;
    const adminCEmail = `outlet.c.${rand(6)}@${TEST_DOMAIN}`;

    const createA = await request('/admin/outlets', { method: 'POST', cookie: adminCookie, body: outletBody('P3 Outlet A', adminAEmail) });
    assert(createA.status === 201 && createA.data.data.status === 'ACTIVE', 'Outlet can be created (active by default)', createA.data);
    assert(/^[6-9]\d{9}$/.test(createA.data.data.mobile), 'Outlet mobile normalised to 10 digits', createA.data.data);
    const outletA = createA.data.data;
    const outletB = (await request('/admin/outlets', { method: 'POST', cookie: adminCookie, body: outletBody('P3 Outlet B', adminBEmail) })).data.data;
    const outletC = (await request('/admin/outlets', { method: 'POST', cookie: adminCookie, body: outletBody('P3 Outlet C', adminCEmail) })).data.data;

    const dupAdmin = await request('/admin/outlets', { method: 'POST', cookie: adminCookie, body: outletBody('P3 Dup', adminAEmail) });
    assert(dupAdmin.status === 409, 'Duplicate Outlet Admin login email rejected', dupAdmin.data);

    const nonAdminCreate = await request('/admin/outlets', { method: 'POST', body: outletBody('P3 Hack', `hack.${rand(4)}@${TEST_DOMAIN}`) });
    assert(nonAdminCreate.status === 401, 'Unauthenticated outlet creation rejected', nonAdminCreate.data);

    const list = await request('/admin/outlets', { cookie: adminCookie });
    assert(list.status === 200 && list.data.data.some((o: any) => o.id === outletA.id), 'Outlets can be listed', list.data);

    const view = await request(`/admin/outlets/${outletA.id}`, { cookie: adminCookie });
    assert(view.status === 200 && view.data.data.adminEmail === adminAEmail, 'Outlet can be viewed with its admin login', view.data);

    const renamed = await request(`/admin/outlets/${outletA.id}`, { method: 'PATCH', cookie: adminCookie, body: { name: 'P3 Outlet A Renamed' } });
    assert(renamed.status === 200 && renamed.data.data.name === 'P3 Outlet A Renamed', 'Outlet can be updated', renamed.data);

    const deactivateB = await request(`/admin/outlets/${outletB.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'INACTIVE' } });
    assert(deactivateB.data.data?.status === 'INACTIVE', 'Outlet can be deactivated', deactivateB.data);
    const deactivateC = await request(`/admin/outlets/${outletC.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'INACTIVE' } });
    assert(deactivateC.data.data?.status === 'INACTIVE', 'Second outlet deactivated for inactive-outlet checks');

    // Partner App listing (partner-authenticated)
    const partnerToken = await loginPartnerToken(partnerB.id);
    const partnerList = await request('/outlets', { token: partnerToken });
    const listedIds = (partnerList.data.data ?? []).map((o: any) => o.id);
    assert(partnerList.status === 200 && listedIds.includes(outletA.id), 'Active outlets are returned to the Partner App', partnerList.data);
    assert(!listedIds.includes(outletB.id) && !listedIds.includes(outletC.id), 'Inactive outlets are excluded from the Partner App');
    const partnerListNoAuth = await request('/outlets');
    assert(partnerListNoAuth.status === 401, 'Partner outlet listing requires a partner session', partnerListNoAuth.data);

    const activateB = await request(`/admin/outlets/${outletB.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'ACTIVE' } });
    assert(activateB.data.data?.status === 'ACTIVE', 'Outlet can be activated', activateB.data);
    const afterActivate = await request('/outlets', { token: partnerToken });
    assert(afterActivate.data.data.some((o: any) => o.id === outletB.id), 'Re-activated outlet appears in the Partner App');

    // Outlet Admin sessions
    const outletLogin = async (email: string) =>
      (await request('/outlet/auth/login', { method: 'POST', body: { email, password: 'OutletPass#123' } })).data.data?.token as string;
    const tokenA = await outletLogin(adminAEmail);
    const tokenB = await outletLogin(adminBEmail);
    const tokenC = await outletLogin(adminCEmail);
    assert(!!tokenA && !!tokenB && !!tokenC, 'Outlet Admins can sign in');
    const badOutletLogin = await request('/outlet/auth/login', { method: 'POST', body: { email: adminAEmail, password: 'nope-nope' } });
    assert(badOutletLogin.status === 401, 'Wrong Outlet Admin password rejected');

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 4: QR VALIDATION ---');
    // ------------------------------------------------------------------------
    const scanDisc = await request('/outlet/scan', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr } });
    const sd = scanDisc.data.data;
    assert(scanDisc.status === 200 && sd.qrType === 'DEFAULT_DISCOUNT' && sd.transactionType === 'DIRECT_PARTNER', 'DEFAULT_DISCOUNT recognised', scanDisc.data);
    assert(
      sd?.partner.name === partnerA.name && sd.partner.mobile === partnerA.mobile && sd.partner.email === partnerA.email,
      'Partner name, mobile and email retrieved from the database',
      sd
    );
    assert(!('classification' in (sd?.partner ?? {})), 'Scan result carries no partner classification', sd);
    assert(
      sd?.discount.isFirstTime === true && sd.discount.discountPercentage === 20 && sd.discount.birthdayBonusPercentage === 0,
      'First-time status and discount resolved on scan (no birthday bonus)',
      sd
    );

    const scanRef = await request('/outlet/scan', { method: 'POST', token: tokenA, body: { qrCode: partnerB.refQr } });
    assert(
      scanRef.status === 200 && scanRef.data.data.qrType === 'REFERRAL' && scanRef.data.data.partner.name === partnerB.name,
      'REFERRAL recognised with referring partner',
      scanRef.data
    );

    const scanUrl = await request('/outlet/scan', {
      method: 'POST',
      token: tokenA,
      body: { qrCode: `https://lotmorewins.example/q/${partnerA.discQr.toLowerCase()}?src=share` },
    });
    assert(scanUrl.status === 200, 'QR embedded in a URL / lowercase is still resolved by the server', scanUrl.data);

    const garbage = await request('/outlet/scan', { method: 'POST', token: tokenA, body: { qrCode: 'hello world' } });
    assert(garbage.status === 404 && garbage.data.code === 'INVALID_QR', 'Invalid QR rejected', garbage.data);
    const unknown = await request('/outlet/scan', { method: 'POST', token: tokenA, body: { qrCode: `LMW-DISC-${hex16()}` } });
    assert(unknown.status === 404 && unknown.data.code === 'INVALID_QR', 'Well-formed but unknown QR rejected', unknown.data);
    const revoked = await request('/outlet/scan', { method: 'POST', token: tokenA, body: { qrCode: revokedPartner.discQr } });
    assert(revoked.status === 422 && revoked.data.code === 'QR_INACTIVE', 'Inactive QR rejected', revoked.data);
    const suspended = await request('/outlet/scan', { method: 'POST', token: tokenA, body: { qrCode: suspendedPartner.discQr } });
    assert(suspended.status === 422 && suspended.data.code === 'PARTNER_INACTIVE', 'Invalid (inactive) partner rejected', suspended.data);
    const noToken = await request('/outlet/scan', { method: 'POST', body: { qrCode: partnerA.discQr } });
    assert(noToken.status === 401, 'Scanning requires an Outlet Admin session', noToken.data);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 5: DIRECT PARTNER BILLING ---');
    // ------------------------------------------------------------------------
    const preview = await request('/outlet/bills/preview', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr, billAmount: 1000 } });
    const p = preview.data.data;
    assert(
      preview.status === 200 && p.discountPercentage === 20 && p.discountAmount === 200 && p.finalAmount === 800,
      'Preview: first-time 20% of ₹1000 = ₹200 off, ₹800 final',
      preview.data
    );
    const billsBefore = await prisma.bill.count({ where: { outletId: outletA.id } });
    assert(billsBefore === 0, 'Preview persists nothing');

    const k1 = key('direct1');
    const bill1 = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr, billAmount: 1000, idempotencyKey: k1 } });
    const b1 = bill1.data.data?.bill;
    assert(bill1.status === 201 && bill1.data.data.replayed === false, 'Direct bill completed (201)', bill1.data);
    assert(b1?.isFirstTime === true && b1.discountPercentage === 20 && b1.finalAmount === 800, 'First-time discount applied server-side', b1);
    assert(b1?.transactionType === 'DIRECT_PARTNER' && b1.qrType === 'DEFAULT_DISCOUNT', 'Transaction type DIRECT_PARTNER / QR type DEFAULT_DISCOUNT', b1);
    const dbBill1 = await prisma.bill.findUnique({ where: { id: b1?.id ?? '' } });
    assert(
      !!dbBill1 &&
        dbBill1.outletId === outletA.id &&
        dbBill1.partnerId === partnerA.id &&
        dbBill1.referrerPartnerId === null &&
        dbBill1.customerId === null &&
        dbBill1.billAmount.toNumber() === 1000 &&
        dbBill1.discountAmount.toNumber() === 200 &&
        dbBill1.finalAmount.toNumber() === 800 &&
        /^LMW-B-\d{8}-[0-9A-F]{8}$/.test(dbBill1.billNumber),
      'Direct transaction persisted with outlet, partner, amounts and bill ID',
      dbBill1
    );

    // Duplicate protection
    const replay = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr, billAmount: 1000, idempotencyKey: k1 } });
    assert(replay.status === 200 && replay.data.data.replayed === true && replay.data.data.bill.id === b1?.id, 'Retry with the same key replays the original bill', replay.data);
    const doubleScan = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr, billAmount: 1000, idempotencyKey: key('dup') } });
    assert(doubleScan.status === 409 && doubleScan.data.code === 'DUPLICATE_BILL', 'Identical bill from a double scan rejected (409)', doubleScan.data);
    const keyReuse = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr, billAmount: 1234, idempotencyKey: k1 } });
    assert(keyReuse.status === 409 && keyReuse.data.code === 'IDEMPOTENCY_CONFLICT', 'Reusing a key for a different bill rejected', keyReuse.data);

    const kConcurrent = key('concurrent');
    const burst = await Promise.all(
      Array.from({ length: 5 }, () =>
        request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr, billAmount: 1500, idempotencyKey: kConcurrent } })
      )
    );
    const burstIds = new Set(burst.map((r) => r.data.data?.bill?.id).filter(Boolean));
    const burstCount = await prisma.bill.count({ where: { outletId: outletA.id, idempotencyKey: kConcurrent } });
    assert(burstCount === 1 && burstIds.size === 1, '5 concurrent submits (double tap / mobile retry) create exactly one bill', burst.map((r) => r.status));
    const b2 = burst.find((r) => r.data.data?.bill)?.data.data.bill;
    assert(b2?.isFirstTime === false && b2.discountPercentage === 10 && b2.discountAmount === 150 && b2.finalAmount === 1350, 'Repeat discount (10%) applied to second bill', b2);

    const secondBill = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerB.discQr, billAmount: 999.99, idempotencyKey: key('second1') } });
    const nb = secondBill.data.data?.bill;
    assert(
      nb?.isFirstTime && nb.discountPercentage === 20 && nb.discountAmount === 199.99 && nb.finalAmount === 800,
      'Every partner gets the same first-time 20%, payable rounded half-up to the rupee (₹999.99 → pays ₹800, ₹199.99 off)',
      nb
    );
    const secondRepeat = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerB.discQr, billAmount: 200, idempotencyKey: key('second2') } });
    assert(secondRepeat.data.data?.bill.discountPercentage === 10, 'Every partner gets the same repeat discount 10%', secondRepeat.data);

    // Client cannot override authoritative values
    const override = async (extra: Record<string, unknown>, name: string) => {
      const before = await prisma.bill.count();
      const r = await request('/outlet/bills', {
        method: 'POST',
        token: tokenA,
        body: { qrCode: partnerA.discQr, billAmount: 50, idempotencyKey: key('override'), ...extra },
      });
      const after = await prisma.bill.count();
      assert(r.status === 400 && after === before, name, r.data);
    };
    await override({ discountPercentage: 90 }, 'Client cannot override discount');
    await override({ discountAmount: 49, finalAmount: 1 }, 'Client cannot override discount/final amounts');
    await override({ partnerType: 'ACHARIYA', classification: 'ACHARIYA' }, 'Client cannot override partner type');
    await override({ isFirstTime: true }, 'Client cannot override first-time status');
    await override({ outletId: outletB.id }, 'Client cannot choose the outlet');
    await override({ partnerId: partnerB.id }, 'Client cannot choose the partner');

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 6: REFERRAL BILLING ---');
    // ------------------------------------------------------------------------
    const customerMobile = uniqueMobile();
    const customer = { name: 'P3 Referred Customer', mobile: `+91-${customerMobile.slice(0, 5)} ${customerMobile.slice(5)}`, email: `cust.${rand(6)}@${TEST_DOMAIN}` };

    const noCustomer = await request('/outlet/bills/preview', { method: 'POST', token: tokenA, body: { qrCode: partnerA.refQr, billAmount: 500 } });
    assert(noCustomer.status === 400 && noCustomer.data.code === 'CUSTOMER_REQUIRED', 'Referral bill requires customer details', noCustomer.data);

    const refPreview = await request('/outlet/bills/preview', { method: 'POST', token: tokenA, body: { qrCode: partnerA.refQr, billAmount: 500, customer } });
    assert(
      refPreview.status === 200 && refPreview.data.data.transactionType === 'REFERRAL' && refPreview.data.data.discountPercentage === 12,
      'Referral discount from settings (12%)',
      refPreview.data
    );

    const refBill = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerA.refQr, billAmount: 500, customer, idempotencyKey: key('ref1') } });
    const rb = refBill.data.data?.bill;
    assert(refBill.status === 201 && rb.referrerPartner?.id === partnerA.id && rb.partner === null, 'Referring partner recorded on the transaction', refBill.data);
    assert(rb?.qrType === 'REFERRAL' && rb.transactionType === 'REFERRAL' && rb.discountAmount === 60 && rb.finalAmount === 440, 'Referral transaction amounts persisted', rb);
    const dbCustomer = await prisma.customer.findUnique({ where: { mobile: customerMobile } });
    assert(!!dbCustomer && dbCustomer.name === customer.name && dbCustomer.email === customer.email, 'Customer persisted with normalised 10-digit mobile', dbCustomer);
    const dbRefBill = await prisma.bill.findUnique({ where: { id: rb?.id ?? '' } });
    assert(dbRefBill?.customerId === dbCustomer?.id && dbRefBill?.referrerPartnerId === partnerA.id, 'Referral bill linked to customer and referrer');

    const refRepeat = await request('/outlet/bills', {
      method: 'POST',
      token: tokenA,
      body: { qrCode: partnerB.refQr, billAmount: 300, customer: { ...customer, mobile: customerMobile }, idempotencyKey: key('ref2') },
    });
    assert(
      refRepeat.data.data?.bill.isFirstTime === false && refRepeat.data.data.bill.discountPercentage === 12,
      'Returning referred customer: not first-time, same referral discount whoever referred them (12%)',
      refRepeat.data
    );
    assert((await prisma.customer.count({ where: { mobile: customerMobile } })) === 1, 'Same mobile reuses one customer identity');

    const selfRef = await request('/outlet/bills/preview', {
      method: 'POST',
      token: tokenA,
      body: { qrCode: partnerA.refQr, billAmount: 100, customer: { name: 'Self', mobile: partnerA.mobile } },
    });
    assert(selfRef.status === 422 && selfRef.data.code === 'SELF_REFERRAL', 'Partner cannot use their own referral QR', selfRef.data);
    const directWithCustomer = await request('/outlet/bills/preview', { method: 'POST', token: tokenA, body: { qrCode: partnerA.discQr, billAmount: 100, customer } });
    assert(directWithCustomer.status === 400, 'Customer details rejected on a direct partner QR', directWithCustomer.data);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 7: OUTLET ISOLATION & AUTHORIZATION ---');
    // ------------------------------------------------------------------------
    const historyA = await request('/outlet/transactions?limit=50', { token: tokenA });
    const aBills = historyA.data.data ?? [];
    assert(historyA.status === 200 && aBills.length === 6 && historyA.data.meta.total === 6, 'Outlet A billing history lists its 6 bills', historyA.data.meta);
    const sample = aBills.find((b: any) => b.transactionType === 'REFERRAL');
    assert(
      !!sample && sample.billNumber && sample.createdAt && sample.customer?.mobile && sample.referrerPartner?.name && sample.qrType === 'REFERRAL',
      'History items include bill ID, date, customer, partner, amounts, QR and transaction type',
      sample
    );

    const historyB = await request(`/outlet/transactions?outletId=${outletA.id}`, { token: tokenB });
    assert(historyB.status === 200 && historyB.data.data.length === 0, 'Outlet B cannot see Outlet A bills (even with ?outletId=A)', historyB.data);

    const profileHijack = await request('/outlet/profile', { method: 'PATCH', token: tokenB, body: { id: outletA.id, name: 'Hijacked' } });
    assert(profileHijack.status === 400, 'Outlet Admin cannot target another outlet via the body', profileHijack.data);
    const statusHijack = await request('/outlet/profile', { method: 'PATCH', token: tokenB, body: { status: 'ACTIVE' } });
    assert(statusHijack.status === 400, 'Outlet Admin cannot change outlet status', statusHijack.data);
    const aStill = await prisma.outlet.findUnique({ where: { id: outletA.id } });
    assert(aStill?.name === 'P3 Outlet A Renamed', 'Outlet A unchanged by Outlet B');

    const outletAsAdmin = await request('/admin/outlets', { token: tokenA });
    assert(outletAsAdmin.status === 401, 'Outlet Admin token cannot access Super Admin APIs', outletAsAdmin.data);
    const outletSettings = await request('/admin/settings', { method: 'PUT', token: tokenA, body: validSettings });
    assert(outletSettings.status === 401, 'Non-admin (Outlet Admin) cannot update settings', outletSettings.data);
    const partnerSettings = await request('/admin/settings', { method: 'PUT', token: partnerToken, body: validSettings });
    assert(partnerSettings.status === 401, 'Non-admin (Partner) cannot update settings', partnerSettings.data);
    const partnerOnOutlet = await request('/outlet/transactions', { token: partnerToken });
    assert(partnerOnOutlet.status === 401, 'Partner token cannot access Outlet Admin APIs', partnerOnOutlet.data);

    const [h, body, sig] = tokenB.split('.');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
    const adminAId = (await prisma.outletAdmin.findUnique({ where: { email: adminAEmail } }))!.id;
    const forgedBody = Buffer.from(JSON.stringify({ ...claims, sub: adminAId })).toString('base64url');
    const forged = await request('/outlet/transactions', { token: `${h}.${forgedBody}.${sig}` });
    assert(forged.status === 401, 'Forged Outlet Admin token (swapped identity) rejected', forged.data);

    const inactiveScan = await request('/outlet/scan', { method: 'POST', token: tokenC, body: { qrCode: partnerA.discQr } });
    assert(inactiveScan.status === 403 && inactiveScan.data.code === 'OUTLET_INACTIVE', 'Inactive outlet cannot scan', inactiveScan.data);
    const inactiveBill = await request('/outlet/bills', { method: 'POST', token: tokenC, body: { qrCode: partnerA.discQr, billAmount: 10, idempotencyKey: key('inactive') } });
    assert(inactiveBill.status === 403 && inactiveBill.data.code === 'OUTLET_INACTIVE', 'Inactive outlet cannot bill', inactiveBill.data);

    await request(`/admin/outlets/${outletA.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'INACTIVE' } });
    const deactivatedMidSession = await request('/outlet/bills', { method: 'POST', token: tokenA, body: { qrCode: partnerB.discQr, billAmount: 10, idempotencyKey: key('mid') } });
    assert(deactivatedMidSession.status === 403, 'Deactivation takes effect immediately for an existing session', deactivatedMidSession.data);
    await request(`/admin/outlets/${outletA.id}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'ACTIVE' } });

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 8: OUTLET PROFILE & MEDIA ---');
    // ------------------------------------------------------------------------
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    ).toString('base64');
    const upload = await request('/media', { method: 'POST', token: tokenB, body: { mimeType: 'image/png', base64: png } });
    assert(upload.status === 201 && /^\/api\/media\/[0-9a-f-]{36}$/.test(upload.data.data.url), 'Outlet Admin can upload an image', upload.data);
    const spoofed = await request('/media', { method: 'POST', token: tokenB, body: { mimeType: 'image/jpeg', base64: png } });
    assert(spoofed.status === 415, 'Upload whose bytes do not match the declared type rejected', spoofed.data);
    const anonUpload = await request('/media', { method: 'POST', body: { mimeType: 'image/png', base64: png } });
    assert(anonUpload.status === 401, 'Anonymous upload rejected', anonUpload.data);

    const media = await fetch(`${BASE_URL.replace(/\/api$/, '')}${upload.data.data.url}`);
    assert(media.status === 200 && media.headers.get('content-type') === 'image/png', 'Uploaded image is served');

    const profileUpdate = await request('/outlet/profile', {
      method: 'PATCH',
      token: tokenB,
      body: { name: 'P3 Outlet B Cafe', logoUrl: upload.data.data.url, images: [upload.data.data.url], mobile: '09876543210' },
    });
    const pb = profileUpdate.data.data;
    assert(
      profileUpdate.status === 200 && pb.name === 'P3 Outlet B Cafe' && pb.logoUrl === upload.data.data.url && pb.images.length === 1 && pb.mobile === '9876543210',
      'Outlet Admin can edit name, mobile, logo and images of their own outlet',
      profileUpdate.data
    );
    const profileGet = await request('/outlet/profile', { token: tokenB });
    assert(profileGet.data.data.id === outletB.id, 'Profile always resolves to the authenticated outlet');
    const badImage = await request('/outlet/profile', { method: 'PATCH', token: tokenB, body: { images: ['javascript:alert(1)'] } });
    assert(badImage.status === 400, 'Non-http image URLs rejected', badImage.data);

    // ------------------------------------------------------------------------
    console.log('\n--- SUITE 9: LOGIN RATE LIMITING ---');
    // ------------------------------------------------------------------------
    // Each scenario uses its own simulated client IP so scenarios do not share counters.
    const ipHeader = (n: number) => ({ 'X-Forwarded-For': `203.0.113.${n}` });
    const attempt = (endpoint: string, email: string, password: string, n: number) =>
      request(endpoint, { method: 'POST', body: { email, password }, headers: ipHeader(n) });

    // Super Admin: 5 failures from one IP block further attempts for that email, even with the right password
    const saFailures = [];
    for (let i = 0; i < 5; i++) saFailures.push((await attempt('/admin/auth/login', adminEmail, 'wrong-password', 10)).status);
    assert(saFailures.every((st) => st === 401), 'First 5 wrong Super Admin passwords return 401', saFailures);
    const saBlocked = await attempt('/admin/auth/login', adminEmail, adminPassword, 10);
    assert(saBlocked.status === 429 && saBlocked.data.code === 'RATE_LIMITED', 'Super Admin login rate limited after repeated failures', saBlocked.data);
    assert(saBlocked.headers.get('retry-after') === '900', 'Rate-limited response includes Retry-After');
    const saOtherIp = await attempt('/admin/auth/login', adminEmail, adminPassword, 11);
    assert(saOtherIp.status === 200, 'Limit is per email + IP: correct password from another IP still signs in', saOtherIp.data);

    // Unknown account behaves identically, so a block does not reveal whether an account exists
    const ghost = `ghost.${rand(6)}@${TEST_DOMAIN}`;
    const ghostStatuses = [];
    for (let i = 0; i < 6; i++) ghostStatuses.push((await attempt('/admin/auth/login', ghost, 'wrong-password', 12)).status);
    const ghostBlocked = await attempt('/admin/auth/login', ghost, 'wrong-password', 12);
    assert(
      JSON.stringify(ghostStatuses) === JSON.stringify([401, 401, 401, 401, 401, 429]) && ghostBlocked.data.message === saBlocked.data.message,
      'Non-existent account: same 401s and same 429 message as a real account',
      { ghostStatuses, ghost: ghostBlocked.data }
    );

    // A successful sign-in clears earlier failures, so occasional typos never lock a real user out
    for (let i = 0; i < 4; i++) await attempt('/outlet/auth/login', adminAEmail, 'typo-typo', 13);
    const oaOk = await attempt('/outlet/auth/login', adminAEmail, 'OutletPass#123', 13);
    assert(oaOk.status === 200, 'Outlet Admin signs in after 4 typos', oaOk.data);
    const afterReset = [];
    for (let i = 0; i < 4; i++) afterReset.push((await attempt('/outlet/auth/login', adminAEmail, 'typo-typo', 13)).status);
    assert(afterReset.every((st) => st === 401), 'Failures were reset by the successful sign-in', afterReset);

    // Outlet Admin: repeated failures are blocked
    const oaStatuses = [];
    for (let i = 0; i < 6; i++) oaStatuses.push((await attempt('/outlet/auth/login', adminBEmail, 'wrong-password', 14)).status);
    assert(oaStatuses[5] === 429, 'Outlet Admin login rate limited after repeated failures', oaStatuses);
    const oaBlockedGood = await attempt('/outlet/auth/login', adminBEmail, 'OutletPass#123', 14);
    assert(oaBlockedGood.status === 429, 'Blocked Outlet Admin cannot sign in from the same IP until the window passes', oaBlockedGood.data);

    // Per-IP limit across many emails (credential stuffing)
    const stuffing = [];
    for (let i = 0; i < 21; i++) stuffing.push((await attempt('/outlet/auth/login', `stuff${i}.${rand(4)}@${TEST_DOMAIN}`, 'x-password', 15)).status);
    assert(stuffing.slice(0, 20).every((st) => st === 401) && stuffing[20] === 429, 'Per-IP limit blocks attempts across many emails', stuffing);
  } finally {
    // Restore settings exactly as they were and remove all test data.
    if (originalSettings) {
      const { id, createdAt, updatedAt, ...rest } = originalSettings;
      void createdAt;
      void updatedAt;
      await prisma.programSetting.update({ where: { id }, data: rest });
    } else {
      await prisma.programSetting.deleteMany({ where: { id: 'GLOBAL' } });
    }
    await cleanup();
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`PHASE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

/** Partner sessions are issued at onboarding; tests mint one via the same signing path. */
async function loginPartnerToken(partnerId: string): Promise<string> {
  const { signToken, PARTNER_TOKEN_TTL_SEC } = await import('../apps/web/lib/auth');
  return signToken({ typ: 'partner', partnerId }, PARTNER_TOKEN_TTL_SEC);
}

run().catch(async (err) => {
  console.error('Fatal Phase 3 test error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
