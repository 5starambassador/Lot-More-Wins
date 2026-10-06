import { NextRequest } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { claimPendingPoints } from '@/lib/points';
import { activeQrInclude, duplicatePartnerField, parseDateOnly, partnerSession } from '@/lib/partners';
import { claimedNotificationRow } from '@/lib/partner-notifications';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';
import { partnerOnboardingSchema } from '@lotmorewins/validation';
import type { PartnerOnboardingResponse } from '@lotmorewins/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/onboarding — register a partner. Every partner registers the same way
 * (contact, address, optional date of birth, verified OTP, password) and receives the two
 * permanent QR codes.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = partnerOnboardingSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { name, mobile, email, city, state, pincode, dateOfBirth, password, otp } = parsed.data;

    // 1. Check for duplicate account
    const existingPartner = await prisma.partner.findFirst({ where: { OR: [{ mobile }, { email }] } });
    if (existingPartner) {
      const field = existingPartner.mobile === mobile ? 'mobile number' : 'email address';
      return fail(409, `An account with this ${field} already exists. Please sign in instead.`, 'ACCOUNT_EXISTS');
    }

    // 2. Authoritative OTP verification check: a verified record within the last 15 minutes
    // for the mobile or email, or the submitted OTP matching the latest pending record.
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const verifiedOtpRecord = await prisma.otpVerification.findFirst({
      where: { identifier: { in: [mobile, email] }, verified: true, createdAt: { gte: fifteenMinutesAgo } },
      orderBy: { createdAt: 'desc' },
    });
    if (!verifiedOtpRecord) {
      const pendingRecord = await prisma.otpVerification.findFirst({
        where: { identifier: { in: [mobile, email] }, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (!pendingRecord || !bcrypt.compareSync(otp, pendingRecord.codeHash)) {
        return fail(400, 'OTP verification failed or expired. Please verify your OTP before proceeding.', 'OTP_INVALID');
      }
      await prisma.otpVerification.update({ where: { id: pendingRecord.id }, data: { verified: true } });
    }

    // 3. Password hash, partner code and EXACTLY TWO permanent unique QR tokens
    const passwordHash = bcrypt.hashSync(password, 10);
    const partnerCode = `LMW-P-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const defaultDiscountQrToken = `LMW-DISC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const referralQrToken = `LMW-REF-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // 4. Atomic creation in database
    const { partner, claimedPoints } = await prisma.$transaction(
      async (tx) => {
        const created = await tx.partner.create({
          data: {
            partnerCode,
            name,
            mobile,
            email,
            passwordHash,
            city,
            state,
            pincode,
            dateOfBirth: dateOfBirth ? parseDateOnly(dateOfBirth) : null,
            status: 'ACTIVE',
            qrCodes: {
              create: [
                { code: defaultDiscountQrToken, type: 'DEFAULT_DISCOUNT', status: 'ACTIVE' },
                { code: referralQrToken, type: 'REFERRAL', status: 'ACTIVE' },
              ],
            },
          },
          include: activeQrInclude,
        });

        // Consume the OTP so the verification cannot be replayed for another registration.
        await tx.otpVerification.deleteMany({ where: { identifier: { in: [mobile, email] } } });

        // A referred customer registering with the same mobile: their purchase points move
        // into this wallet. Their first direct bill then gets the first-time (register bonus)
        // discount from the Super Admin settings, since they have no direct bill yet.
        const pendingClaim = await claimPendingPoints(tx, created.id, mobile);
        if (pendingClaim.claimedPoints > 0) {
          await tx.notification.create({ data: claimedNotificationRow(created.id, pendingClaim.claimedPoints) });
        }

        return { partner: created, claimedPoints: pendingClaim.claimedPoints };
      },
      { maxWait: 10_000, timeout: 20_000 }
    );

    const session: PartnerOnboardingResponse = { ...partnerSession(partner), claimedPoints };
    return ok(session, 201, 'Partner registered successfully. Permanent QR codes generated.');
  } catch (error) {
    const field = duplicatePartnerField(error);
    if (field) return fail(409, `An account with this ${field} already exists. Please sign in instead.`, 'ACCOUNT_EXISTS');
    return handleRouteError(error, 'POST /api/partner/onboarding');
  }
}
