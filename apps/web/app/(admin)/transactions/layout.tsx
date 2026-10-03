import type { ReactNode } from 'react';
import { guardSection } from '@/lib/admin-page-guard';

export const dynamic = 'force-dynamic';

/** Only accounts given this page can open it (checked on the server). */
export default async function Layout({ children }: { children: ReactNode }) {
  return guardSection('transactions', children);
}
