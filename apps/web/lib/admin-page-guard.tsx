import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import type { AdminPage, SuperAdminProfile } from '@lotmorewins/types';
import { buttonClass } from '@/components/ui/button';
import { ADMIN_SESSION_COOKIE, loadAdminSession } from './auth';

/** First page an account may open, for sending it somewhere useful. */
export const ADMIN_PAGE_PATHS: Record<AdminPage, string> = {
  dashboard: '/dashboard',
  partners: '/partners',
  outlets: '/outlets',
  transactions: '/transactions',
  settings: '/settings',
};

export async function currentAdmin(): Promise<SuperAdminProfile> {
  const admin = await loadAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!admin) redirect('/login');
  return admin;
}

function NoAccess({ admin }: { admin: SuperAdminProfile }) {
  const home = admin.pages[0];
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-stone-150 bg-white px-6 py-10 text-center shadow-sm animate-rise-in">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-stone-900">You don&apos;t have access to this page</h1>
      <p className="mt-1.5 text-[13px] text-stone-500">
        {home
          ? 'Ask the Super Admin if you need it.'
          : 'No pages have been given to your account yet. Ask the Super Admin to give you access.'}
      </p>
      {home && (
        <Link href={ADMIN_PAGE_PATHS[home]} className={buttonClass('primary', 'md', 'mt-6')}>
          Go to your pages
        </Link>
      )}
    </div>
  );
}

/**
 * Server-side page access for a section's layout: renders the section only for accounts that
 * have the page ("admins" = Super Admin only); everyone else gets a no-access screen, so a typed
 * URL never shows a page that was not given. The section's API routes check the same rule.
 */
export async function guardSection(page: AdminPage | 'admins', children: ReactNode) {
  const admin = await currentAdmin();
  const allowed = page === 'admins' ? admin.role === 'SUPER_ADMIN' : admin.pages.includes(page);
  if (allowed) return children;
  // The dashboard is where sign-in lands: send admins without it to their first page.
  if (page === 'dashboard' && admin.pages[0]) redirect(ADMIN_PAGE_PATHS[admin.pages[0]]);
  return <NoAccess admin={admin} />;
}
