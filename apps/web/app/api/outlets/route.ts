import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { serializeOutlet } from '@/lib/outlets';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/outlets — active outlets for the Partner App (managed by the Super Admin). */
export async function GET(req: NextRequest) {
  try {
    requirePartnerId(req);
    const outlets = await prisma.outlet.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } });
    return ok(outlets.map(serializeOutlet));
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlets');
  }
}
