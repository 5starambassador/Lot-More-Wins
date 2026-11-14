import { NextRequest } from 'next/server';
import type { PartnerLatestBill } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/bills/latest — the partner's newest own bill (Personal Discount QR or redeem QR),
 * or null. The QR pages poll it to notice the outlet completing a bill and go back home.
 */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const bill = await prisma.bill.findFirst({
      where: { partnerId, transactionType: { in: ['DIRECT_PARTNER', 'WALLET_REDEEM'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        billNumber: true,
        transactionType: true,
        finalAmount: true,
        createdAt: true,
        outlet: { select: { name: true } },
      },
    });
    const latest: PartnerLatestBill | null = bill
      ? {
          id: bill.id,
          billNumber: bill.billNumber,
          outletName: bill.outlet.name,
          transactionType: bill.transactionType,
          finalAmount: bill.finalAmount.toNumber(),
          createdAt: bill.createdAt.toISOString(),
        }
      : null;
    return ok(latest);
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/bills/latest');
  }
}
