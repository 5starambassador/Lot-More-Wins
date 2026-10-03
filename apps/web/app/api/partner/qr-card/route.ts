import { NextRequest } from 'next/server';
import type { PartnerQrCardResponse } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { renderQrCard } from '@/lib/qr-card';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const LABELS = { DEFAULT_DISCOUNT: 'Personal Discount QR', REFERRAL: 'Referral QR' } as const;

/**
 * GET /api/partner/qr-card?type=DEFAULT_DISCOUNT|REFERRAL — the partner's own QR as a branded
 * PNG card (logo, title, QR and code on the app's red gradient), for download and sharing.
 */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const type = req.nextUrl.searchParams.get('type');
    if (type !== 'DEFAULT_DISCOUNT' && type !== 'REFERRAL') {
      return fail(400, 'type must be DEFAULT_DISCOUNT or REFERRAL', 'VALIDATION_ERROR');
    }

    const qr = await prisma.qRCode.findFirst({ where: { partnerId, type, status: 'ACTIVE' }, select: { code: true } });
    if (!qr) return fail(404, 'QR code not found', 'QR_NOT_FOUND');

    const png = await renderQrCard({ code: qr.code, label: LABELS[type] });
    const data: PartnerQrCardResponse = { mimeType: 'image/png', base64: png.toString('base64') };
    return ok(data);
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/qr-card');
  }
}
