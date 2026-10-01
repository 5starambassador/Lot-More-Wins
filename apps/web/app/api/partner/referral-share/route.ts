import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/partner/referral-share — record one tap of "Share QR" on the referral QR page. */
export async function POST(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    await prisma.referralShare.create({ data: { partnerId } });
    return ok({ recorded: true }, 201);
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/referral-share');
  }
}
