import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signToken, PARTNER_TOKEN_TTL_SEC } from '@/lib/auth';
import { claimPendingPoints } from '@/lib/points';
import { partnerOnboardingSchema } from '@lotmorewins/validation';
import type { PartnerRole, QRCodeType } from '@lotmorewins/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = partnerOnboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || 'Validation error in onboarding form',
          errors: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const {
      role,
      name,
      mobile,
      email,
      employeeId,
      admissionNumber,
      password,
      otp,
    } = parsed.data;

    // Classification is derived from the validated role on the server, never taken from the client.
    const isAchariyaAssociated = role !== 'NON_ACHARIYA';
    const cleanMobile = mobile.trim();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check for duplicate account
    const existingPartner = await prisma.partner.findFirst({
      where: {
        OR: [{ mobile: cleanMobile }, { email: cleanEmail }],
      },
    });

    if (existingPartner) {
      const field = existingPartner.mobile === cleanMobile ? 'mobile number' : 'email address';
      return NextResponse.json(
        {
          success: false,
          message: `An account with this ${field} already exists. Please sign in instead.`,
        },
        { status: 409 }
      );
    }

    // 2. Authoritative OTP verification check
    // Look for verified OTP record within the last 15 minutes for mobile or email
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const verifiedOtpRecord = await prisma.otpVerification.findFirst({
      where: {
        identifier: { in: [cleanMobile, cleanEmail] },
        verified: true,
        createdAt: { gte: fifteenMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    // In production, require prior verified record or compare the submitted OTP directly
    if (!verifiedOtpRecord) {
      // Check if the current OTP matches the latest unverified record
      const pendingRecord = await prisma.otpVerification.findFirst({
        where: {
          identifier: { in: [cleanMobile, cleanEmail] },
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!pendingRecord || !bcrypt.compareSync(otp, pendingRecord.codeHash)) {
        return NextResponse.json(
          {
            success: false,
            message: 'OTP verification failed or expired. Please verify your OTP before proceeding.',
          },
          { status: 400 }
        );
      }
      // Mark as verified
      await prisma.otpVerification.update({
        where: { id: pendingRecord.id },
        data: { verified: true },
      });
    }

    // 3. Authoritative Achariya association validation
    let cleanEmployeeId: string | null = null;
    let cleanAdmissionNumber: string | null = null;

    if (isAchariyaAssociated) {
      if (role === 'STAFF' || role === 'TEACHER') {
        if (!employeeId) {
          return NextResponse.json(
            { success: false, message: 'Employee ID is required for Achariya Staff / Teachers' },
            { status: 400 }
          );
        }
        cleanEmployeeId = employeeId.trim().toUpperCase();

        const employee = await prisma.achariyaEmployee.findUnique({
          where: { employeeId: cleanEmployeeId },
        });

        if (!employee || !employee.isActive) {
          return NextResponse.json(
            { success: false, message: `Invalid Employee ID "${cleanEmployeeId}". Not found in Achariya records.` },
            { status: 400 }
          );
        }

        if (employee.role !== role) {
          return NextResponse.json(
            { success: false, message: `Employee ID "${cleanEmployeeId}" is registered as ${employee.role}, not ${role}.` },
            { status: 400 }
          );
        }

        const employeeAlreadyLinked = await prisma.partner.findFirst({
          where: { employeeId: cleanEmployeeId },
        });
        if (employeeAlreadyLinked) {
          return NextResponse.json(
            { success: false, message: `Employee ID "${cleanEmployeeId}" is already linked to an existing account.` },
            { status: 409 }
          );
        }
      } else if (role === 'PARENT') {
        if (!admissionNumber) {
          return NextResponse.json(
            { success: false, message: "Child's Admission Number is required for Achariya Parents" },
            { status: 400 }
          );
        }
        cleanAdmissionNumber = admissionNumber.trim().toUpperCase();

        const student = await prisma.achariyaStudent.findUnique({
          where: { admissionNumber: cleanAdmissionNumber },
        });

        if (!student || !student.isActive) {
          return NextResponse.json(
            { success: false, message: `Invalid Admission Number "${cleanAdmissionNumber}". Not found in Achariya records.` },
            { status: 400 }
          );
        }

        const studentAlreadyLinked = await prisma.partner.findFirst({
          where: { admissionNumber: cleanAdmissionNumber },
        });
        if (studentAlreadyLinked) {
          return NextResponse.json(
            { success: false, message: `Admission Number "${cleanAdmissionNumber}" is already linked to an existing account.` },
            { status: 409 }
          );
        }
      }
    }

    // 4. Secure password hashing
    const passwordHash = bcrypt.hashSync(password, 10);

    // 5. Generate unique partner code
    const uniqueSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const partnerCode = `LMW-P-${uniqueSuffix}`;

    // 6. Generate EXACTLY TWO permanent unique QR tokens
    const defaultDiscountQrToken = `LMW-DISC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const referralQrToken = `LMW-REF-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // 7. Atomic creation in database
    const newPartner = await prisma.$transaction(async (tx) => {
      const created = await tx.partner.create({
        data: {
          partnerCode,
          name,
          mobile: cleanMobile,
          email: cleanEmail,
          passwordHash,
          isAchariyaAssociated,
          role: role as PartnerRole,
          employeeId: cleanEmployeeId,
          admissionNumber: cleanAdmissionNumber,
          status: 'ACTIVE',
        },
      });

      // Create permanent QR 1: DEFAULT_DISCOUNT
      await tx.qRCode.create({
        data: {
          partnerId: created.id,
          code: defaultDiscountQrToken,
          type: 'DEFAULT_DISCOUNT' as QRCodeType,
          status: 'ACTIVE',
        },
      });

      // Create permanent QR 2: REFERRAL
      await tx.qRCode.create({
        data: {
          partnerId: created.id,
          code: referralQrToken,
          type: 'REFERRAL' as QRCodeType,
          status: 'ACTIVE',
        },
      });

      // Consume the OTP so the verification cannot be replayed for another registration.
      await tx.otpVerification.deleteMany({
        where: { identifier: { in: [cleanMobile, cleanEmail] } },
      });

      // A referred customer registering with the same mobile: their purchase points move
      // into this wallet. Their first direct bill then gets the first-time (register bonus)
      // discount from the Super Admin settings, since they have no direct bill yet.
      const pendingClaim = await claimPendingPoints(tx, created.id, cleanMobile);

      return { ...created, pendingClaim };
    }, { maxWait: 10_000, timeout: 20_000 });

    // 8. Generate authentication JWT
    const token = signToken(
      {
        typ: 'partner',
        partnerId: newPartner.id,
        partnerCode: newPartner.partnerCode,
        role: newPartner.role,
        mobile: newPartner.mobile,
      },
      PARTNER_TOKEN_TTL_SEC
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Partner registered successfully. Permanent QR codes generated.',
        data: {
          partner: {
            id: newPartner.id,
            partnerCode: newPartner.partnerCode,
            name: newPartner.name,
            mobile: newPartner.mobile,
            email: newPartner.email,
            role: newPartner.role,
            isAchariyaAssociated: newPartner.isAchariyaAssociated,
            employeeId: newPartner.employeeId,
            admissionNumber: newPartner.admissionNumber,
            status: newPartner.status,
            createdAt: newPartner.createdAt.toISOString(),
          },
          qrCodes: [
            {
              id: 'qr-default-discount',
              type: 'DEFAULT_DISCOUNT',
              code: defaultDiscountQrToken,
              title: 'Default Discount QR',
              description: 'Your permanent QR code to redeem personal partner discounts at participating outlets.',
              status: 'ACTIVE',
              createdAt: newPartner.createdAt.toISOString(),
            },
            {
              id: 'qr-referral',
              type: 'REFERRAL',
              code: referralQrToken,
              title: 'Referral QR',
              description: 'Your permanent QR code to refer friends and family. Earn rewards on every visit.',
              status: 'ACTIVE',
              createdAt: newPartner.createdAt.toISOString(),
            },
          ],
          claimedPoints: newPartner.pendingClaim.claimedPoints,
          token,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error in POST /api/partner/onboarding:', error);
    return NextResponse.json(
      { success: false, message: 'Server error during partner registration' },
      { status: 500 }
    );
  }
}
