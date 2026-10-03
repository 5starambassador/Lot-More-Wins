import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/sidebar';
import { AdminTopbar } from '@/components/admin/topbar';
import { AdminAccessProvider } from '@/components/admin/admin-access';
import { ToastProvider } from '@/components/ui/toast';
import { currentAdmin } from '@/lib/admin-page-guard';

export const dynamic = 'force-dynamic';

/**
 * Panel shell: verifies the session server-side before rendering any admin page. Each section
 * also checks its own page access (see its layout.tsx).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await currentAdmin();

  return (
    <AdminAccessProvider admin={admin}>
      <ToastProvider>
        <div className="min-h-screen bg-background lg:flex">
          <AdminSidebar />
          <div className="min-w-0 flex-1">
            <AdminTopbar />
            <main className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </AdminAccessProvider>
  );
}
