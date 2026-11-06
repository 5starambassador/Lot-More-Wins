import type { ReactNode } from 'react';
import { guardSection } from '@/lib/admin-page-guard';

export const dynamic = 'force-dynamic';

/** The leaderboard shows partner details, so it goes with the Partners page (checked on the server). */
export default async function Layout({ children }: { children: ReactNode }) {
  return guardSection('partners', children);
}
