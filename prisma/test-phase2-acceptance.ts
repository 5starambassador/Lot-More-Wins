import * as dotenv from 'dotenv';
import * as path from 'path';

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

/**
 * Returns an OTP the test can submit. When the API exposes dev OTPs, that value is used;
 * otherwise (ENABLE_DEV_OTP=false) a known code is registered for the identifier directly in
 * the database, so verification and onboarding are still exercised through the real API.
 */
async function otpFor(identifier: string, sendRes: { data: any }): Promise<string> {
  if (sendRes.data.devOtp) return sendRes.data.devOtp;
  const code = String(100000 + Math.floor(Math.random() * 900000));
  const data = {
    identifier,
    channel: 'TEST',
    codeHash: bcrypt.hashSync(code, 10),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
  // Retry transient connection failures (serverless database cold starts / resets).
  for (let attempt = 1; ; attempt++) {
    try {
      await otpDb.otpVerification.create({ data });
      return code;
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

const otpDb = new PrismaClient();

async function runTests() {
  console.log('================================================================');
  console.log('LOT MORE WINS — PHASE 2 COMPREHENSIVE ACCEPTANCE TEST SUITE');
  console.log('Target API:', BASE_URL);
  console.log('================================================================\n');

  // Clean up any test runs with @example.com to ensure complete test idempotence
  const prisma = new PrismaClient();
  try {
    await prisma.qRCode.deleteMany({
      where: { partner: { email: { contains: 'example.com' } } },
    });
    await prisma.partner.deleteMany({
      where: { email: { contains: 'example.com' } },
    });
  } catch (e) {
    // non-fatal cleanup
  } finally {
    await prisma.$disconnect();
  }

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error('     Details:', JSON.stringify(details, null, 2));
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: MESSAGING MODE ROUTING ACCEPTANCE TEST (Section 34)
  // --------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: MESSAGING MODE ROUTING ---');
  {
    // The runtime mode comes from the Super Admin setting (env var only as fallback).
    // A mobile identifier plus email lets the server deliver on either channel.
    const otpRes = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: `97${Date.now().toString().slice(-8)}`, email: 'test.user@example.com', name: 'Test User' }),
    });

    assert(otpRes.ok && otpRes.data.success, 'Send OTP via configured mode', otpRes.data);
    assert(
      otpRes.data.channel === otpRes.data.mode && ['email', 'whatsapp'].includes(otpRes.data.mode),
      `Routing is strictly the runtime messaging mode (${otpRes.data.mode})`,
      otpRes.data
    );
    assert(typeof otpRes.data.expiresAt === 'string', 'OTP has valid expiration timestamp');
    if (process.env.ENABLE_DEV_OTP !== 'true') {
      assert(otpRes.data.devOtp === undefined, 'OTP is not returned in the API response (ENABLE_DEV_OTP=false)', otpRes.data);
    }
    assert(!JSON.stringify(otpRes.data).includes('codeHash'), 'OTP hash is never returned');
  }

  // --------------------------------------------------------------------------
  // TEST 2: PARTNER ONBOARDING FLOW (single partner role)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: PARTNER ONBOARDING ---');
  const uniqueTime = Date.now().toString().slice(-6);
  const partnerMobile = `98${uniqueTime}11`;
  const partnerEmail = `partner.${uniqueTime}@example.com`;
  let partnerId = '';
  let partnerDiscountQr = '';
  let partnerReferralQr = '';
  let partnerToken = '';

  {
    // 1. Send OTP
    const sendOtp = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: partnerMobile, email: partnerEmail, name: 'Vikram Malhotra' }),
    });
    assert(sendOtp.ok && sendOtp.data.success, 'OTP generated and sent', sendOtp.data);
    const otpCode = await otpFor(partnerMobile, sendOtp);

    // 2. Verify OTP
    const verifyOtp = await request('/auth/otp', {
      method: 'PUT',
      body: JSON.stringify({ identifier: partnerMobile, otp: otpCode }),
    });
    assert(verifyOtp.ok && verifyOtp.data.success, 'OTP verified', verifyOtp.data);

    // 3. Register Account + Generate 2 Permanent QR Codes
    const register = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Vikram Malhotra',
        mobile: partnerMobile,
        email: partnerEmail,
        city: 'Puducherry',
        state: 'Puducherry',
        pincode: '605001',
        dateOfBirth: '1990-04-15',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: otpCode,
      }),
    });

    assert(register.status === 201 && register.data.success, 'Account created with HTTP 201', register.data);
    const profile = register.data.data.partner;
    assert(
      profile.city === 'Puducherry' && profile.state === 'Puducherry' && profile.pincode === '605001' && profile.dateOfBirth === '1990-04-15',
      'City, state, pincode and date of birth stored on the profile',
      profile
    );
    assert(!('role' in profile) && !('isAchariyaAssociated' in profile), 'Profile carries no role or classification', profile);
    assert(register.data.data.qrCodes.length === 2, 'Exactly TWO permanent QR codes returned');

    const disc = register.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT');
    const ref = register.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL');

    assert(!!disc && disc.code.startsWith('LMW-DISC-'), 'Default Discount QR generated with prefix LMW-DISC-');
    assert(!!ref && ref.code.startsWith('LMW-REF-'), 'Referral QR generated with prefix LMW-REF-');
    assert(disc?.code !== ref?.code, 'Both QR codes have distinct unique identities');

    partnerId = register.data.data.partner.id;
    partnerDiscountQr = disc?.code;
    partnerReferralQr = ref?.code;
    partnerToken = register.data.data.token;
  }

  // --------------------------------------------------------------------------
  // TEST 3: BIRTHDAY STEP SKIPPED, DUPLICATES AND REQUIRED DETAILS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: OPTIONAL BIRTHDAY, DUPLICATES & REQUIRED DETAILS ---');
  {
    const skipMobile = `98${uniqueTime}22`;
    const skipEmail = `skip.${uniqueTime}@example.com`;

    const sendOtp = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: skipMobile, email: skipEmail, name: 'Rajesh Kumar' }),
    });
    const otpCode = await otpFor(skipMobile, sendOtp);
    await request('/auth/otp', {
      method: 'PUT',
      body: JSON.stringify({ identifier: skipMobile, otp: otpCode }),
    });

    const details = {
      name: 'Rajesh Kumar',
      mobile: skipMobile,
      email: skipEmail,
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600040',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      otp: otpCode,
    };

    const noPincode = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({ ...details, pincode: undefined }),
    });
    assert(noPincode.status === 400, 'Registration without a pincode is rejected (400)', noPincode.data);

    const badDob = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({ ...details, dateOfBirth: '2999-01-01' }),
    });
    assert(badDob.status === 400, 'Date of birth in the future is rejected (400)', badDob.data);

    const register = await request('/partner/onboarding', { method: 'POST', body: JSON.stringify(details) });
    assert(register.status === 201 && register.data.success, 'Account created without a date of birth (step skipped)', register.data);
    assert(register.data.data.partner.dateOfBirth === null, 'Skipped date of birth is stored as null');
    assert(register.data.data.qrCodes.length === 2, 'Exactly two permanent QR codes created');

    // Profile edit: the skipped birthday can be added later.
    const addDob = await request('/partner/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${register.data.data.token}` },
      body: JSON.stringify({ dateOfBirth: '1988-11-02', city: 'Coimbatore' }),
    });
    assert(
      addDob.ok && addDob.data.data.partner.dateOfBirth === '1988-11-02' && addDob.data.data.partner.city === 'Coimbatore',
      'Profile edit updates date of birth and city',
      addDob.data
    );

    // A new mobile number needs a verified OTP for that number.
    const mobileNoOtp = await request('/partner/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${register.data.data.token}` },
      body: JSON.stringify({ mobile: `98${uniqueTime}77` }),
    });
    assert(mobileNoOtp.status === 403 && mobileNoOtp.data.code === 'OTP_REQUIRED', 'Changing the mobile number without an OTP is refused', mobileNoOtp.data);

    // Duplicate check: the same mobile cannot register twice.
    const dupCheck = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({ ...details, name: 'Imposter', email: `imposter.${uniqueTime}@example.com`, otp: '123456' }),
    });
    assert(dupCheck.status === 409, 'Duplicate mobile registration blocked with 409', dupCheck.data);
  }

  // --------------------------------------------------------------------------
  // TEST 4: PERMANENT QR RETRIEVAL & IMMUTABILITY (Section 20 & 35)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: PERMANENT QR RETRIEVAL & IMMUTABILITY ---');
  {
    // Retrieve QR codes via /api/partner/qr (Call 1)
    const qrCall1 = await request('/partner/qr', { headers: { Authorization: `Bearer ${partnerToken}` } });
    assert(qrCall1.ok && qrCall1.data.success, 'Retrieve partner QR codes (Call 1)', qrCall1.data);
    const disc1 = qrCall1.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT')?.code;
    const ref1 = qrCall1.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL')?.code;

    assert(disc1 === partnerDiscountQr, 'Default Discount QR in Call 1 matches original creation');
    assert(ref1 === partnerReferralQr, 'Referral QR in Call 1 matches original creation');

    // Retrieve QR codes via /api/partner/qr (Call 2 - Simulating App Restart / Reopen)
    const qrCall2 = await request('/partner/qr', { headers: { Authorization: `Bearer ${partnerToken}` } });
    const disc2 = qrCall2.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT')?.code;
    const ref2 = qrCall2.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL')?.code;

    assert(disc1 === disc2, 'Default Discount QR is 100% IMMUTABLE (Call 1 === Call 2)');
    assert(ref1 === ref2, 'Referral QR is 100% IMMUTABLE (Call 1 === Call 2)');

    // Retrieve via /api/partner/me (Call 3 - Simulating Dashboard Profile Fetch)
    const meCall = await request('/partner/me', { headers: { Authorization: `Bearer ${partnerToken}` } });
    assert(meCall.ok && meCall.data.success, 'Retrieve partner profile & QR via /api/partner/me', meCall.data);
    const disc3 = meCall.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT')?.code;
    const ref3 = meCall.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL')?.code;

    assert(disc1 === disc3, 'Default Discount QR in /partner/me matches original');
    assert(ref1 === ref3, 'Referral QR in /partner/me matches original');
  }

  // --------------------------------------------------------------------------
  // TEST 5: PHASE 2 SECURITY CORRECTIONS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: IDENTITY IS SERVER-AUTHORITATIVE ---');
  {
    const qrNoAuth = await request(`/partner/qr?partnerId=${partnerId}`);
    assert(qrNoAuth.status === 401, 'partnerId query parameter without a token is rejected (401)', qrNoAuth.data);

    const meNoAuth = await request(`/partner/me?partnerId=${partnerId}`);
    assert(meNoAuth.status === 401, '/partner/me without a token is rejected (401)', meNoAuth.data);

    const [h, body, sig] = partnerToken.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), partnerId: 'someone-else' })
    ).toString('base64url');
    const forged = await request('/partner/me', { headers: { Authorization: `Bearer ${h}.${forgedBody}.${sig}` } });
    assert(forged.status === 401, 'Token with a tampered payload is rejected (401)', forged.data);

    const unsigned = await request('/partner/me', { headers: { Authorization: `Bearer ${h}.${body}.` } });
    assert(unsigned.status === 401, 'Unsigned token is rejected (401)', unsigned.data);

    // The retired classification fields are not accepted any more.
    const legacyFields = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: true,
        role: 'STAFF',
        employeeId: 'ACH-STF-101',
        name: 'Legacy Client',
        mobile: `98${uniqueTime}55`,
        email: `legacy.${uniqueTime}@example.com`,
        city: 'Puducherry',
        state: 'Puducherry',
        pincode: '605001',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: '123456',
      }),
    });
    assert(legacyFields.status === 400, 'Registration carrying role / classification fields is rejected (400)', legacyFields.data);

    const noValidateRoute = await fetch(`${BASE_URL}/partner/validate-employee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'ACH-STF-101' }),
    });
    assert(noValidateRoute.status === 404 || noValidateRoute.status === 405, 'Employee validation endpoint no longer exists');
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
