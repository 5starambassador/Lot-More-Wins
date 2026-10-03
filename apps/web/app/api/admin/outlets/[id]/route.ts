import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { outletUpdateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requireAdmin, requireAdminDelete } from '@/lib/auth';
import { deleteOutlet } from '@/lib/admin-deletions';
import { adminOutletInclude, serializeAdminOutlet } from '@/lib/outlets';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/outlets/:id */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin(req, 'outlets');
    const { id } = await params;
    const outlet = await prisma.outlet.findUnique({ where: { id }, include: adminOutletInclude });
    if (!outlet) return fail(404, 'Outlet not found', 'NOT_FOUND');
    return ok(serializeAdminOutlet(outlet));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/outlets/:id');
  }
}

/** PATCH /api/admin/outlets/:id — update details, activate/deactivate, or reset the admin password. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin(req, 'outlets');
    const { id } = await params;
    const parsed = outletUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { adminPassword, ...fields } = parsed.data;

    const existing = await prisma.outlet.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return fail(404, 'Outlet not found', 'NOT_FOUND');

    const outlet = await prisma.$transaction(async (tx) => {
      if (adminPassword) {
        await tx.outletAdmin.updateMany({
          where: { outletId: id },
          data: { passwordHash: bcrypt.hashSync(adminPassword, 10) },
        });
      }
      return tx.outlet.update({ where: { id }, data: fields, include: adminOutletInclude });
    }, { maxWait: 10_000, timeout: 20_000 });
    return ok(serializeAdminOutlet(outlet), 200, 'Outlet updated');
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/admin/outlets/:id');
  }
}

/** DELETE /api/admin/outlets/:id — permanently delete the outlet with its bills, redemptions and admin login. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAdminDelete(req, 'outlets');
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail(404, 'Outlet not found', 'NOT_FOUND');
    return ok(await deleteOutlet(id), 200, 'Outlet deleted');
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/admin/outlets/:id');
  }
}
