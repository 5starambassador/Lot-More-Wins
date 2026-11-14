import type { ReactNode } from 'react';
import { guardSection } from '@/lib/admin-page-guard';

export const dynamic = 'force-dynamic';

/** Sending to every partner is for the Super Admin only (checked on the server). */
export default async function Layout({ children }: { children: ReactNode }) {
  return guardSection('admins', children);
}
