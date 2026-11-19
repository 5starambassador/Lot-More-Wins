import type { ReactNode } from 'react';
import { guardSection } from '@/lib/admin-page-guard';

export const dynamic = 'force-dynamic';

/** The push engine is for the Super Admin only (its API routes check the same). */
export default async function Layout({ children }: { children: ReactNode }) {
  return guardSection('admins', children);
}
