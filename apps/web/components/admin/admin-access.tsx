'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { AdminPage, SuperAdminProfile } from '@lotmorewins/types';

/**
 * The signed-in panel account, loaded by the server layout. Used to hide what the account
 * cannot use (sidebar links, delete buttons); the API enforces the same rules on every request.
 */
const AdminAccessContext = createContext<SuperAdminProfile | null>(null);

export function AdminAccessProvider({ admin, children }: { admin: SuperAdminProfile; children: ReactNode }) {
  return <AdminAccessContext.Provider value={admin}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  const admin = useContext(AdminAccessContext);
  if (!admin) throw new Error('useAdminAccess must be used inside AdminAccessProvider');
  const isSuperAdmin = admin.role === 'SUPER_ADMIN';
  return {
    admin,
    isSuperAdmin,
    canOpen: (page: AdminPage) => admin.pages.includes(page),
    /** Delete buttons on `page`: needs the page and the delete permission. */
    canDelete: (page: AdminPage) => admin.canDelete && admin.pages.includes(page),
  };
}
