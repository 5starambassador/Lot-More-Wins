import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { adminOutletListQuerySchema, outletCreateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/auth';
import { adminOutletInclude, serializeAdminOutlet } from '@/lib/outlets';
import { listOutlets, outletsCsv } from '@/lib/admin-insights';
import { csvResponse } from '@/lib/admin-csv';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/outlets?search&status&from&to — outlets of any status; `from` / `to` filter
 * by the date the outlet was added. `format=csv` downloads the filtered list.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const parsed = adminOutletListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    if (parsed.data.format === 'csv') return csvResponse('outlets', await outletsCsv(parsed.data));
    return ok(await listOutlets(parsed.data));
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
        description: fields.description ?? null,
        address: fields.address ?? null,
        mapUrl: fields.mapUrl ?? null,
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
