import type { Outlet as OutletRow, Prisma } from '@prisma/client';
import type { AdminOutlet, Outlet } from '@lotmorewins/types';

export function serializeOutlet(outlet: OutletRow): Outlet {
  return {
    id: outlet.id,
    name: outlet.name,
    email: outlet.email,
    mobile: outlet.mobile,
    logoUrl: outlet.logoUrl,
    images: outlet.images,
    status: outlet.status,
    createdAt: outlet.createdAt.toISOString(),
    updatedAt: outlet.updatedAt.toISOString(),
  };
}

export const adminOutletInclude = {
  admins: { select: { email: true }, orderBy: { createdAt: 'asc' }, take: 1 },
  _count: { select: { bills: true } },
} satisfies Prisma.OutletInclude;

export function serializeAdminOutlet(
  outlet: Prisma.OutletGetPayload<{ include: typeof adminOutletInclude }>
): AdminOutlet {
  return {
    ...serializeOutlet(outlet),
    adminEmail: outlet.admins[0]?.email ?? null,
    billCount: outlet._count.bills,
  };
}
