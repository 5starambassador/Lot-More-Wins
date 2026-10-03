import bcrypt from 'bcryptjs';
import { Prisma, type SuperAdmin } from '@prisma/client';
import type { AdminAccount, CreateAdminAccountPayload, UpdateAdminAccountPayload } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError, toAdminProfile } from './auth';

/**
 * Admin accounts managed by the Super Admin on the Admins page. Admins sign in on the same
 * login page; their pages and delete permission are enforced by requireAdmin on every request.
 * Super Admin accounts are listed but never changed or deleted here.
 */

function serialize(admin: SuperAdmin): AdminAccount {
  return {
    ...toAdminProfile(admin),
    mobile: admin.mobile,
    isActive: admin.isActive,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  };
}

const emailTaken = () => new HttpError(409, 'Another admin already uses this email address', 'EMAIL_TAKEN');

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const admins = await prisma.superAdmin.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] });
  return admins.map(serialize);
}

export async function createAdminAccount(input: CreateAdminAccountPayload, createdById: string): Promise<AdminAccount> {
  try {
    const admin = await prisma.superAdmin.create({
      data: {
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        position: input.position,
        role: 'ADMIN',
        pages: input.pages,
        canDelete: input.canDelete,
        isActive: input.isActive ?? true,
        passwordHash: bcrypt.hashSync(input.password, 10),
        createdById,
      },
    });
    return serialize(admin);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw emailTaken();
    throw error;
  }
}

async function editableAdmin(id: string) {
  const admin = await prisma.superAdmin.findUnique({ where: { id } });
  if (!admin) throw new HttpError(404, 'Admin not found', 'NOT_FOUND');
  if (admin.role === 'SUPER_ADMIN') {
    throw new HttpError(403, 'Super Admin accounts cannot be changed or deleted from this page', 'SUPER_ADMIN_PROTECTED');
  }
  return admin;
}

export async function updateAdminAccount(id: string, input: UpdateAdminAccountPayload): Promise<AdminAccount> {
  await editableAdmin(id);
  const { password, ...fields } = input;
  try {
    const admin = await prisma.superAdmin.update({
      where: { id },
      data: { ...fields, ...(password && { passwordHash: bcrypt.hashSync(password, 10) }) },
    });
    return serialize(admin);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw emailTaken();
    throw error;
  }
}

export async function deleteAdminAccount(id: string, requestedById: string): Promise<void> {
  if (id === requestedById) throw new HttpError(400, 'You cannot delete your own account', 'SELF_DELETE');
  await editableAdmin(id);
  await prisma.superAdmin.delete({ where: { id } });
}
