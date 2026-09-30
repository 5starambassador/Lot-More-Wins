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
  // TEST 2: ACHARIYA EMPLOYEE VALIDATION ACCEPTANCE TEST (Sections 12 & 13)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: ACHARIYA EMPLOYEE VALIDATION ---');
  {
    // Valid Staff ID
    const validStaff = await request('/partner/validate-employee', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'ACH-STF-101', role: 'STAFF' }),
    });
    assert(validStaff.ok && validStaff.data.success, 'Valid Staff Employee ID approved (ACH-STF-101)', validStaff.data);
    assert(validStaff.data.data.name === 'Rajesh Kumar', 'Authoritative Staff name verified: Rajesh Kumar');

    // Valid Teacher ID
    const validTeacher = await request('/partner/validate-employee', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'ACH-TCH-201', role: 'TEACHER' }),
    });
    assert(validTeacher.ok && validTeacher.data.success, 'Valid Teacher Employee ID approved (ACH-TCH-201)', validTeacher.data);
    assert(validTeacher.data.data.name === 'Anand Sundaram', 'Authoritative Teacher name verified: Anand Sundaram');

    // Invalid Employee ID
    const invalidEmp = await request('/partner/validate-employee', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'INVALID-999', role: 'STAFF' }),
    });
    assert(invalidEmp.status === 404 && !invalidEmp.data.success, 'Non-existent Employee ID rejected with 404', invalidEmp.data);

    // Mismatched role
    const mismatchedRole = await request('/partner/validate-employee', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'ACH-STF-101', role: 'TEACHER' }),
    });
    assert(mismatchedRole.status === 400 && !mismatchedRole.data.success, 'Mismatched role rejected (Staff queried as Teacher)', mismatchedRole.data);
  }

  // --------------------------------------------------------------------------
  // TEST 3: ACHARIYA ADMISSION VALIDATION ACCEPTANCE TEST (Section 14)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: ACHARIYA ADMISSION VALIDATION ---');
  {
    // Valid Admission Number
    const validAdm = await request('/partner/validate-admission', {
      method: 'POST',
      body: JSON.stringify({ admissionNumber: 'ACH-ADM-3001' }),
    });
    assert(validAdm.ok && validAdm.data.success, 'Valid Admission Number approved (ACH-ADM-3001)', validAdm.data);
    assert(validAdm.data.data.studentName === 'Aarav Sundaram', 'Authoritative Student name verified: Aarav Sundaram');

    // Invalid Admission Number
    const invalidAdm = await request('/partner/validate-admission', {
      method: 'POST',
      body: JSON.stringify({ admissionNumber: 'ADM-FAKE-000' }),
    });
    assert(invalidAdm.status === 404 && !invalidAdm.data.success, 'Non-existent Admission Number rejected with 404', invalidAdm.data);
  }

  // --------------------------------------------------------------------------
  // TEST 4: NON-ACHARIYA ONBOARDING FLOW (Section 30)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: NON-ACHARIYA ONBOARDING ---');
  const uniqueTime = Date.now().toString().slice(-6);
  const nonAchMobile = `98${uniqueTime}11`;
  const nonAchEmail = `nonach.${uniqueTime}@example.com`;
  let nonAchPartnerId = '';
  let nonAchDiscountQr = '';
  let nonAchReferralQr = '';
  let nonAchToken = '';

  {
    // 1. Send OTP
    const sendOtp = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: nonAchMobile, email: nonAchEmail, name: 'Vikram Malhotra' }),
    });
    assert(sendOtp.ok && sendOtp.data.success, 'Non-Achariya: OTP generated and sent', sendOtp.data);
    const otpCode = await otpFor(nonAchMobile, sendOtp);

    // 2. Verify OTP
    const verifyOtp = await request('/auth/otp', {
      method: 'PUT',
      body: JSON.stringify({ identifier: nonAchMobile, otp: otpCode }),
    });
    assert(verifyOtp.ok && verifyOtp.data.success, 'Non-Achariya: OTP verified', verifyOtp.data);

    // 3. Register Account + Generate 2 Permanent QR Codes
    const register = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: false,
        role: 'NON_ACHARIYA',
        name: 'Vikram Malhotra',
        mobile: nonAchMobile,
        email: nonAchEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: otpCode,
      }),
    });

    assert(register.status === 201 && register.data.success, 'Non-Achariya: Account created with HTTP 201', register.data);
    assert(register.data.data.partner.role === 'NON_ACHARIYA', 'Partner role is NON_ACHARIYA');
    assert(register.data.data.qrCodes.length === 2, 'Exactly TWO permanent QR codes returned');

    const disc = register.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT');
    const ref = register.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL');

    assert(!!disc && disc.code.startsWith('LMW-DISC-'), 'Default Discount QR generated with prefix LMW-DISC-');
    assert(!!ref && ref.code.startsWith('LMW-REF-'), 'Referral QR generated with prefix LMW-REF-');
    assert(disc?.code !== ref?.code, 'Both QR codes have distinct unique identities');

    nonAchPartnerId = register.data.data.partner.id;
    nonAchDiscountQr = disc?.code;
    nonAchReferralQr = ref?.code;
    nonAchToken = register.data.data.token;
  }

  // --------------------------------------------------------------------------
  // TEST 5: STAFF ONBOARDING FLOW (Section 31)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: ACHARIYA STAFF ONBOARDING ---');
  {
    const staffMobile = `98${uniqueTime}22`;
    const staffEmail = `staff.${uniqueTime}@example.com`;

    // 1. Send OTP
    const sendOtp = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: staffMobile, email: staffEmail, name: 'Rajesh Kumar' }),
    });
    const otpCode = await otpFor(staffMobile, sendOtp);

    // 2. Verify OTP
    await request('/auth/otp', {
      method: 'PUT',
      body: JSON.stringify({ identifier: staffMobile, otp: otpCode }),
    });

    // 3. Register Staff Account
    const register = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: true,
        role: 'STAFF',
        employeeId: 'ACH-STF-101',
        name: 'Rajesh Kumar',
        mobile: staffMobile,
        email: staffEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: otpCode,
      }),
    });

    assert(register.status === 201 && register.data.success, 'Staff: Account created with Employee ID ACH-STF-101', register.data);
    assert(register.data.data.partner.role === 'STAFF', 'Partner role is STAFF');
    assert(register.data.data.partner.employeeId === 'ACH-STF-101', 'Partner linked to Employee ID ACH-STF-101');
    assert(register.data.data.qrCodes.length === 2, 'Staff: Exactly two permanent QR codes created');
    assert(register.data.data.partner.isAchariyaAssociated === true, 'Staff: classified as Achariya by the server');

    // Duplicate check: trying to register same Employee ID again should fail
    const dupCheck = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: true,
        role: 'STAFF',
        employeeId: 'ACH-STF-101',
        name: 'Imposter',
        mobile: `98${uniqueTime}99`,
        email: `imposter.${uniqueTime}@example.com`,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: '123456',
      }),
    });
    assert(dupCheck.status === 409 || dupCheck.status === 400, 'Duplicate Employee ID registration blocked with 409/400');
  }

  // --------------------------------------------------------------------------
  // TEST 6: TEACHER ONBOARDING FLOW (Section 32)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: ACHARIYA TEACHER ONBOARDING ---');
  {
    const teacherMobile = `98${uniqueTime}33`;
    const teacherEmail = `teacher.${uniqueTime}@example.com`;

    const sendOtp = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: teacherMobile, email: teacherEmail, name: 'Anand Sundaram' }),
    });
    const otpCode = await otpFor(teacherMobile, sendOtp);

    await request('/auth/otp', {
      method: 'PUT',
      body: JSON.stringify({ identifier: teacherMobile, otp: otpCode }),
    });

    const register = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: true,
        role: 'TEACHER',
        employeeId: 'ACH-TCH-201',
        name: 'Anand Sundaram',
        mobile: teacherMobile,
        email: teacherEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: otpCode,
      }),
    });

    assert(register.status === 201 && register.data.success, 'Teacher: Account created with Employee ID ACH-TCH-201', register.data);
    assert(register.data.data.partner.role === 'TEACHER', 'Partner role is TEACHER');
    assert(register.data.data.qrCodes.length === 2, 'Teacher: Exactly two permanent QR codes created');
  }

  // --------------------------------------------------------------------------
  // TEST 7: PARENT ONBOARDING FLOW (Section 33)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 7: ACHARIYA PARENT ONBOARDING ---');
  {
    const parentMobile = `98${uniqueTime}44`;
    const parentEmail = `parent.${uniqueTime}@example.com`;

    const sendOtp = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: parentMobile, email: parentEmail, name: 'Sundaram Raman' }),
    });
    const otpCode = await otpFor(parentMobile, sendOtp);

    await request('/auth/otp', {
      method: 'PUT',
      body: JSON.stringify({ identifier: parentMobile, otp: otpCode }),
    });

    const register = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: true,
        role: 'PARENT',
        admissionNumber: 'ACH-ADM-3001',
        name: 'Sundaram Raman',
        mobile: parentMobile,
        email: parentEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: otpCode,
      }),
    });

    assert(register.status === 201 && register.data.success, 'Parent: Account created with Admission No ACH-ADM-3001', register.data);
    assert(register.data.data.partner.role === 'PARENT', 'Partner role is PARENT');
    assert(register.data.data.partner.admissionNumber === 'ACH-ADM-3001', 'Partner linked to Admission No ACH-ADM-3001');
    assert(register.data.data.qrCodes.length === 2, 'Parent: Exactly two permanent QR codes created');
  }

  // --------------------------------------------------------------------------
  // TEST 8: PERMANENT QR RETRIEVAL & IMMUTABILITY (Section 20 & 35)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 8: PERMANENT QR RETRIEVAL & IMMUTABILITY ---');
  {
    // Retrieve QR codes via /api/partner/qr (Call 1)
    const qrCall1 = await request('/partner/qr', { headers: { Authorization: `Bearer ${nonAchToken}` } });
    assert(qrCall1.ok && qrCall1.data.success, 'Retrieve partner QR codes (Call 1)', qrCall1.data);
    const disc1 = qrCall1.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT')?.code;
    const ref1 = qrCall1.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL')?.code;

    assert(disc1 === nonAchDiscountQr, 'Default Discount QR in Call 1 matches original creation');
    assert(ref1 === nonAchReferralQr, 'Referral QR in Call 1 matches original creation');

    // Retrieve QR codes via /api/partner/qr (Call 2 - Simulating App Restart / Reopen)
    const qrCall2 = await request('/partner/qr', { headers: { Authorization: `Bearer ${nonAchToken}` } });
    const disc2 = qrCall2.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT')?.code;
    const ref2 = qrCall2.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL')?.code;

    assert(disc1 === disc2, 'Default Discount QR is 100% IMMUTABLE (Call 1 === Call 2)');
    assert(ref1 === ref2, 'Referral QR is 100% IMMUTABLE (Call 1 === Call 2)');

    // Retrieve via /api/partner/me (Call 3 - Simulating Dashboard Profile Fetch)
    const meCall = await request('/partner/me', { headers: { Authorization: `Bearer ${nonAchToken}` } });
    assert(meCall.ok && meCall.data.success, 'Retrieve partner profile & QR via /api/partner/me', meCall.data);
    const disc3 = meCall.data.data.qrCodes.find((q: any) => q.type === 'DEFAULT_DISCOUNT')?.code;
    const ref3 = meCall.data.data.qrCodes.find((q: any) => q.type === 'REFERRAL')?.code;

    assert(disc1 === disc3, 'Default Discount QR in /partner/me matches original');
    assert(ref1 === ref3, 'Referral QR in /partner/me matches original');
  }

  // --------------------------------------------------------------------------
  // TEST 9: PHASE 2 SECURITY CORRECTIONS
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 9: IDENTITY & CLASSIFICATION ARE SERVER-AUTHORITATIVE ---');
  {
    const qrNoAuth = await request(`/partner/qr?partnerId=${nonAchPartnerId}`);
    assert(qrNoAuth.status === 401, 'partnerId query parameter without a token is rejected (401)', qrNoAuth.data);

    const meNoAuth = await request(`/partner/me?partnerId=${nonAchPartnerId}`);
    assert(meNoAuth.status === 401, '/partner/me without a token is rejected (401)', meNoAuth.data);

    const [h, body, sig] = nonAchToken.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), partnerId: 'someone-else' })
    ).toString('base64url');
    const forged = await request('/partner/me', { headers: { Authorization: `Bearer ${h}.${forgedBody}.${sig}` } });
    assert(forged.status === 401, 'Token with a tampered payload is rejected (401)', forged.data);

    const unsigned = await request('/partner/me', { headers: { Authorization: `Bearer ${h}.${body}.` } });
    assert(unsigned.status === 401, 'Unsigned token is rejected (401)', unsigned.data);

    const tamperMobile = `98${uniqueTime}55`;
    const tamperClass = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: true,
        role: 'NON_ACHARIYA',
        name: 'Class Tamper',
        mobile: tamperMobile,
        email: `tamper.${uniqueTime}@example.com`,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: '123456',
      }),
    });
    assert(tamperClass.status === 400, 'Client cannot claim Achariya classification with a NON_ACHARIYA role', tamperClass.data);

    // Verify an OTP first so the request reaches the employee-role check.
    const mismatchMobile = `98${uniqueTime}66`;
    const mismatchEmail = `mismatch.${uniqueTime}@example.com`;
    const mismatchOtp = await request('/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ identifier: mismatchMobile, email: mismatchEmail, name: 'Role Mismatch' }),
    });
    const mismatchCode = await otpFor(mismatchMobile, mismatchOtp);
    await request('/auth/otp', {
      method: 'PUT',
      body: JSON.stringify({ identifier: mismatchMobile, otp: mismatchCode }),
    });
    const roleMismatch = await request('/partner/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        isAchariyaAssociated: true,
        role: 'TEACHER',
        employeeId: 'ACH-STF-102',
        name: 'Role Mismatch',
        mobile: mismatchMobile,
        email: mismatchEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123',
        otp: mismatchCode,
      }),
    });
    assert(
      roleMismatch.status === 400 && /registered as STAFF/.test(roleMismatch.data.message),
      'Staff Employee ID cannot register as TEACHER',
      roleMismatch.data
    );
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
