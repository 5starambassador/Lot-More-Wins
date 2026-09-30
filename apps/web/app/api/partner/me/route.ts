import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { HttpError, requirePartnerId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Identity comes only from a verified partner token.
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
        { success: false, message: 'Partner account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          partner: {
            id: partner.id,
            partnerCode: partner.partnerCode,
            name: partner.name,
            mobile: partner.mobile,
            email: partner.email,
            role: partner.role,
            isAchariyaAssociated: partner.isAchariyaAssociated,
            employeeId: partner.employeeId,
            admissionNumber: partner.admissionNumber,
            status: partner.status,
            createdAt: partner.createdAt.toISOString(),
          },
          qrCodes: partner.qrCodes.map((qr) => ({
            id: qr.id,
            code: qr.code,
            type: qr.type,
            title: qr.type === 'DEFAULT_DISCOUNT' ? 'Default Discount QR' : 'Referral QR',
            description:
              qr.type === 'DEFAULT_DISCOUNT'
                ? 'Permanent QR code for personal discounts'
                : 'Permanent QR code for referring family & friends',
            status: qr.status,
            createdAt: qr.createdAt.toISOString(),
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error('Error in GET /api/partner/me:', error);
    return NextResponse.json(
      { success: false, message: 'Server error retrieving partner profile' },
      { status: 500 }
    );
  }
}
