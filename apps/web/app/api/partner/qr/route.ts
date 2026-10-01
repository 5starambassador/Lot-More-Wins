import { NextRequest } from 'next/server';
import type { PartnerQrResponse } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { activeQrInclude, serializeQrCodes } from '@/lib/partners';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/partner/qr — the partner's own permanent QR codes; identity comes from the verified token. */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const partner = await prisma.partner.findUnique({ where: { id: partnerId }, include: activeQrInclude });
    if (!partner) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');

    const data: PartnerQrResponse = {
      partner: { id: partner.id, partnerCode: partner.partnerCode, name: partner.name },
      qrCodes: serializeQrCodes(partner.qrCodes),
    };
    return ok(data);
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/qr');
  }
}
