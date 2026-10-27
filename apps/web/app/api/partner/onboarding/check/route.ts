import { NextRequest } from 'next/server';
import { partnerRegistrationCheckSchema } from '@lotmorewins/validation';
import type { PartnerRegistrationCheckResponse } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/onboarding/check — registration step 1. Reports whether the mobile number or
 * email is already used by a partner, so the app can stop before the remaining steps.
 * POST /api/partner/onboarding still rejects duplicates on its own.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = partnerRegistrationCheckSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { mobile, email } = parsed.data;

    const existing = await prisma.partner.findMany({
      where: { OR: [{ mobile }, { email }] },
      select: { mobile: true, email: true },
    });
    const result: PartnerRegistrationCheckResponse = {
      mobileTaken: existing.some((p) => p.mobile === mobile),
      emailTaken: existing.some((p) => p.email === email),
    };
    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/onboarding/check');
  }
}
