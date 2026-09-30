'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  SlidersHorizontal,
  Store,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { adminApi } from '@/lib/admin-client';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; soon?: boolean };

const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    section: 'Network',
    items: [
      { href: '/partners', label: 'Partners', icon: Users },
      { href: '/outlets', label: 'Outlets', icon: Store },
    ],
  },
  { section: 'Activity', items: [{ href: '/transactions', label: 'Transactions', icon: Receipt }] },
  { section: 'Configuration', items: [{ href: '/settings', label: 'Programme settings', icon: SlidersHorizontal }] },
  {
    section: 'Coming soon',
    items: [
      { href: '#', label: 'Subscriptions', icon: CreditCard, soon: true },
      { href: '#', label: 'Reports', icon: BarChart3, soon: true },
      { href: '#', label: 'Notifications', icon: Bell, soon: true },
    ],
  },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <Image src="/brand/lotmore-logo.png" alt="Lot More" width={36} height={36} priority className="h-9 w-9 shrink-0 rounded-md border border-gold-400/50 bg-white object-contain" />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold text-white">Lot More Wins</span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-gold-300">Super Admin</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Main">
      {NAV.map(({ section, items }) => (
        <div key={section}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">{section}</p>
          <ul className="space-y-0.5">
            {items.map(({ href, label, icon: Icon, soon }) => {
              if (soon) {
                return (
                  <li key={label}>
                    <span
                      aria-disabled="true"
                      className="flex h-9 cursor-default items-center gap-3 rounded-md px-3 text-[13px] text-white/55"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{label}</span>
                      <span className="rounded border border-gold-300/50 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-gold-200">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors',
                      active ? 'bg-white/[0.14] text-white' : 'text-white/90 hover:bg-white/[0.08] hover:text-white'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute inset-y-2 left-0 w-[3px] rounded-r bg-gold-300 transition-opacity',
                        active ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Icon
                      className={cn('h-4 w-4 transition-colors', active ? 'text-gold-300' : 'text-white/75 group-hover:text-gold-200')}
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Account({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    try {
      await adminApi.adminLogout();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };
  return (
    <div className="border-t border-white/[0.14] p-3">
      <div className="flex items-center gap-3 rounded-md px-2 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-xs font-semibold text-gold-300 ring-1 ring-gold-400/40">
          {initials(name) || 'SA'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">{name}</p>
          <p className="truncate text-[11px] text-white/75">{email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-md p-2 text-white/75 transition-colors hover:bg-white/[0.1] hover:text-gold-200 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const chrome = 'flex flex-col bg-[#750505] text-white';

  return (
    <>
      {/* Desktop rail */}
      <aside className={cn(chrome, 'sticky top-0 hidden h-screen w-64 shrink-0 border-r border-black/20 lg:flex')}>
        <div className="flex h-16 items-center border-b border-white/[0.14] px-5">
          <Brand />
        </div>
        <NavLinks />
        <Account name={adminName} email={adminEmail} />
      </aside>

      {/* Mobile bar + drawer */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[#750505] px-4 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-md p-2 text-white transition-colors hover:bg-white/[0.1]"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} />
          <aside className={cn(chrome, 'absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-in-left')}>
            <div className="flex h-14 items-center justify-between border-b border-white/[0.14] px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 text-white hover:bg-white/[0.1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <Account name={adminName} email={adminEmail} />
          </aside>
        </div>
      )}
    </>
  );
}
