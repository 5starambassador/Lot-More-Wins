import type { OutletOption } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/outlets/options — public. Names of the active outlets, for the "Referred by" list
 * a new partner chooses from while registering (no session yet).
 */
export async function GET() {
  try {
    const outlets: OutletOption[] = await prisma.outlet.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return ok(outlets);
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlets/options');
  }
}
