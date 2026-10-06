import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { partnerProfileUpdateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { activeQrInclude, duplicatePartnerField, parseDateOnly, partnerSession, toDateOnly } from '@/lib/partners';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/me — the signed-in partner's profile and permanent QR codes. */
export async function GET(req: NextRequest) {
  try {
    // Identity comes only from a verified partner token.
    const partnerId = requirePartnerId(req);
    const partner = await prisma.partner.findUnique({ where: { id: partnerId }, include: activeQrInclude });
    if (!partner) return fail(404, 'Partner account not found', 'PARTNER_NOT_FOUND');
    return ok(partnerSession(partner));
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/me');
  }
}

/**
 * PATCH /api/partner/me — edit the details collected at registration (name, mobile, email,
 * city, state, pincode, date of birth) and the profile photo.
 * Mobile and email are sign-in identifiers: a new value must be unused, and the change must
 * be confirmed with an OTP (POST then PUT /api/auth/otp) within the last 15 minutes. The OTP
 * identifier is the new mobile when the mobile changes, otherwise the partner's current mobile.
 */
export async function PATCH(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = partnerProfileUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) return fail(404, 'Partner account not found', 'PARTNER_NOT_FOUND');

    const data: Prisma.PartnerUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.city !== undefined) data.city = input.city;
    if (input.state !== undefined) data.state = input.state;
    if (input.pincode !== undefined) data.pincode = input.pincode;
    if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl;

    if (input.dateOfBirth !== undefined && input.dateOfBirth !== toDateOnly(partner.dateOfBirth)) {
      data.dateOfBirth = input.dateOfBirth ? parseDateOnly(input.dateOfBirth) : null;
      // Stamped so a freshly edited birthday cannot be used for the birthday bonus straight away.
      data.dobChangedAt = input.dateOfBirth ? new Date() : null;
    }

    const newMobile = input.mobile !== undefined && input.mobile !== partner.mobile ? input.mobile : null;
    const newEmail = input.email !== undefined && input.email !== partner.email ? input.email : null;
    const changedIdentifiers = [newMobile, newEmail].filter((v): v is string => v !== null);

    if (changedIdentifiers.length > 0) {
      const taken = await prisma.partner.findFirst({
        where: {
          id: { not: partnerId },
          OR: [...(newMobile ? [{ mobile: newMobile }] : []), ...(newEmail ? [{ email: newEmail }] : [])],
        },
        select: { mobile: true },
      });
      if (taken) {
        const field = newMobile && taken.mobile === newMobile ? 'mobile number' : 'email address';
        return fail(409, `Another account already uses this ${field}.`, 'ACCOUNT_EXISTS');
      }

      // The code is requested for the new mobile when it changes (WhatsApp mode delivers it there),
      // otherwise for the current mobile; in email mode it is delivered to the new email address.
      const otpIdentifiers = [newMobile ?? partner.mobile, ...(newEmail ? [newEmail] : [])];
      const verified = await prisma.otpVerification.findFirst({
        where: {
          identifier: { in: otpIdentifiers },
          verified: true,
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (!verified) {
        return fail(403, 'Please verify your new contact details with the code we send you.', 'OTP_REQUIRED');
      }
      if (newMobile) data.mobile = newMobile;
      if (newEmail) data.email = newEmail;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Consume the OTP so the verification cannot be replayed.
      if (changedIdentifiers.length > 0) {
        await tx.otpVerification.deleteMany({
          where: { identifier: { in: [partner.mobile, ...changedIdentifiers] } },
        });
      }
      return tx.partner.update({ where: { id: partnerId }, data, include: activeQrInclude });
    });
    return ok(partnerSession(updated), 200, 'Profile updated');
  } catch (error) {
    const field = duplicatePartnerField(error);
    if (field) return fail(409, `Another account already uses this ${field}.`, 'ACCOUNT_EXISTS');
    return handleRouteError(error, 'PATCH /api/partner/me');
  }
}
