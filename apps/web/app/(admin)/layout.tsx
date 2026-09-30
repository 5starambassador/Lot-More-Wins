import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { ADMIN_SESSION_COOKIE, readSuperAdminIdFromToken } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminTopbar } from '@/components/admin/topbar';
import { ToastProvider } from '@/components/ui/toast';

export const dynamic = 'force-dynamic';

/** Super Admin shell: verifies the session server-side before rendering any admin page. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const adminId = readSuperAdminIdFromToken(token);
  const admin = adminId ? await prisma.superAdmin.findUnique({ where: { id: adminId } }) : null;
  if (!admin || !admin.isActive) redirect('/login');

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background lg:flex">
        <AdminSidebar adminName={admin.name} adminEmail={admin.email} />
        <div className="min-w-0 flex-1">
          <AdminTopbar />
          <main className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
