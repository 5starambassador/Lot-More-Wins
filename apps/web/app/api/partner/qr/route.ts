import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { HttpError, requirePartnerId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // A partner can only retrieve their own QR codes; identity comes from the verified token.
    const partnerId = requirePartnerId(req);

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        qrCodes: {
          where: { status: 'ACTIVE' },
          orderBy: { type: 'asc' },
        },
      },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, message: 'Partner not found' },
        { status: 404 }
      );
    }

    const formattedQrCodes = partner.qrCodes.map((qr) => ({
      id: qr.id,
      code: qr.code,
      type: qr.type,
      title: qr.type === 'DEFAULT_DISCOUNT' ? 'Default Discount QR' : 'Referral QR',
      description:
        qr.type === 'DEFAULT_DISCOUNT'
          ? 'Show at checkout to redeem your exclusive partner discount.'
          : 'Share with friends & family to earn points whenever they shop.',
      status: qr.status,
      createdAt: qr.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          partner: {
            id: partner.id,
            partnerCode: partner.partnerCode,
            name: partner.name,
            role: partner.role,
          },
          qrCodes: formattedQrCodes,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error('Error in /api/partner/qr:', error);
    return NextResponse.json(
      { success: false, message: 'Server error retrieving partner QR codes' },
      { status: 500 }
    );
  }
}
