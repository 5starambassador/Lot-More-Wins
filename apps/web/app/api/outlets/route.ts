import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { serializeOutlet } from '@/lib/outlets';
import { getProgramSettings } from '@/lib/settings';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/outlets — active outlets for the Partner App (managed by the Super Admin). */
export async function GET(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const [outlets, settings, partner] = await Promise.all([
      prisma.outlet.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      }),
      getProgramSettings(),
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: { category: true },
      }),
    ]);
    // Each outlet carries its own discount label ("Flat 5% discount" / "Up to 20% discount").
    return ok(outlets.map((o) => serializeOutlet(o, settings, partner?.category ?? null)));
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlets');
  }
}
