import { NextRequest } from 'next/server';
import { outletProfileUpdateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requireOutletAdmin } from '@/lib/auth';
import { serializeOutlet } from '@/lib/outlets';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/outlet/profile — the authenticated admin's own outlet. */
export async function GET(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    return ok(serializeOutlet(outlet));
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlet/profile');
  }
}

/**
 * PATCH /api/outlet/profile — edit name, email, mobile, logo and images of the admin's own outlet.
 * The outlet is taken from the verified session; the body cannot name an outlet or change status.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const parsed = outletProfileUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.outlet.update({ where: { id: outlet.id }, data: parsed.data });
    return ok(serializeOutlet(updated), 200, 'Outlet profile updated');
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/outlet/profile');
  }
}
