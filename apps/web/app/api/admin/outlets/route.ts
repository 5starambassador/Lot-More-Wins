import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { outletCreateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/auth';
import { adminOutletInclude, serializeAdminOutlet } from '@/lib/outlets';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/outlets — all outlets, any status. */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const outlets = await prisma.outlet.findMany({ include: adminOutletInclude, orderBy: { createdAt: 'desc' } });
    return ok(outlets.map(serializeAdminOutlet));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/outlets');
  }
}

/** POST /api/admin/outlets — create an outlet together with its Outlet Admin login. */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const parsed = outletCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { adminEmail, adminPassword, ...fields } = parsed.data;

    const outlet = await prisma.outlet.create({
      data: {
        name: fields.name,
        email: fields.email,
        mobile: fields.mobile,
        logoUrl: fields.logoUrl ?? null,
        images: fields.images ?? [],
        status: fields.status ?? 'ACTIVE',
        admins: { create: { email: adminEmail, passwordHash: bcrypt.hashSync(adminPassword, 10) } },
      },
      include: adminOutletInclude,
    });
    return ok(serializeAdminOutlet(outlet), 201, 'Outlet created');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(409, 'An Outlet Admin with this login email already exists', 'ADMIN_EMAIL_TAKEN');
    }
    return handleRouteError(error, 'POST /api/admin/outlets');
  }
}
