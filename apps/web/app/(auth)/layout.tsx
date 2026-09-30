import type { ReactNode } from 'react';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';

const PILLARS = [
  { title: 'Partner network', body: 'Achariya and non-Achariya partners, their QR codes and wallets.' },
  { title: 'Outlet operations', body: 'Every participating outlet, its admins and billing activity.' },
  { title: 'Programme rules', body: 'Discounts, points and messaging applied to every bill.' },
];

export default function AuthLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-[#750505] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Fine gold rule lines: a quiet texture, not decoration for its own sake */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
          <defs>
            <pattern id="rules" width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="56" stroke="#D1AA4A" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rules)" />
        </svg>

        <div className="relative flex items-center gap-3">
          <Image src="/brand/lotmore-logo.png" alt="Lot More" width={48} height={48} priority className="h-12 w-12 shrink-0 rounded-md border border-gold-400/50 bg-white object-contain" />
          <span className="leading-tight">
            <span className="block text-base font-semibold">Lot More Wins</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-gold-400">Super Admin Console</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">Programme control centre</p>
          <h2 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.02em]">
            Oversee the entire rewards network from one place.
          </h2>
          <div className="mt-10 space-y-5 border-l border-gold-400/30 pl-6">
            {PILLARS.map((p) => (
              <div key={p.title}>
                <p className="text-sm font-medium text-gold-200">{p.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-maroon-200/80">{p.body}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-maroon-200/60">
          <ShieldCheck className="h-4 w-4 text-gold-400/70" />
          Restricted to authorised Super Admin accounts. All sign-ins are rate limited.
        </p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[380px] animate-rise-in">{children}</div>
      </main>
    </div>
  );
}
