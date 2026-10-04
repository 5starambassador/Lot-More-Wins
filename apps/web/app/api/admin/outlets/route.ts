import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { AdminOutletOption } from '@lotmorewins/types';
import { adminOutletListQuerySchema, outletCreateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
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
    // `view=options`: outlet ids and names only, for the outlet filters on the Partners and
    // Transactions pages, so admins without the Outlets page can still filter by outlet.
    if (req.nextUrl.searchParams.get('view') === 'options') {
      const admin = await requireAdmin(req);
      if (!(['outlets', 'partners', 'transactions', 'dashboard'] as const).some((page) => admin.pages.includes(page))) {
        return fail(403, 'You do not have access to outlets', 'PAGE_FORBIDDEN');
      }
      const options: AdminOutletOption[] = await prisma.outlet.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
      return ok(options);
    }

    await requireAdmin(req, 'outlets');
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
    await requireAdmin(req, 'outlets');
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
