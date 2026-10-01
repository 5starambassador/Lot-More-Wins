'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Search, Store, Users } from 'lucide-react';
import type { AdminSearchResult } from '@lotmorewins/types';
import { Input } from '@/components/ui/input';
import { adminApi, errorMessage, useDebounced } from '@/lib/admin-client';

/**
 * Dashboard search: one box that looks across partners (name, mobile, email, id, code) and
 * outlets (name, email, mobile, address, admin login) and links straight to the matches.
 */
export function GlobalSearch() {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ q: string; result: AdminSearchResult | null; error: string | null }>({
    q: '',
    result: null,
    error: null,
  });
  const q = useDebounced(text.trim());
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef(0);

  useEffect(() => {
    if (!q) return;
    const id = ++latest.current;
    adminApi
      .adminSearch(q)
      .then((res) => id === latest.current && setState({ q, result: res.data, error: null }))
      .catch((err) => id === latest.current && setState({ q, result: null, error: errorMessage(err, 'Search failed. Please try again.') }));
  }, [q]);

  // Close when clicking elsewhere or pressing Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const trimmed = text.trim();
  // Results on screen always belong to the text in the box.
  const current = trimmed && state.q === trimmed ? state : null;
  const searching = Boolean(trimmed) && !current;
  const partners = current?.result?.partners ?? [];
  const outlets = current?.result?.outlets ?? [];
  const encoded = encodeURIComponent(trimmed);

  return (
    <div ref={box} className="relative w-full sm:w-80">
      <Input
        icon={Search}
        placeholder="Search partners and outlets"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search partners and outlets"
        role="combobox"
        aria-expanded={open && Boolean(trimmed)}
        aria-controls="dashboard-search-results"
      />
      {open && trimmed && (
        <div
          id="dashboard-search-results"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[26rem] overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {searching && <p className="px-4 py-3 text-sm text-stone-500">Searching…</p>}
          {current?.error && <p className="px-4 py-3 text-sm text-red-700">{current.error}</p>}
          {current?.result && partners.length === 0 && outlets.length === 0 && (
            <p className="px-4 py-3 text-sm text-stone-500">No partner or outlet matches “{trimmed}”.</p>
          )}

          {partners.length > 0 && (
            <section aria-label="Partners">
              <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                <Users className="h-3.5 w-3.5 text-gold-600" /> Partners
              </p>
              {partners.map((p) => (
                <Link key={p.id} href={`/partners/${p.id}`} className="block px-4 py-2 hover:bg-stone-50" onClick={() => setOpen(false)}>
                  <p className="truncate text-sm font-medium text-stone-900">{p.name}</p>
                  <p className="tabular truncate text-xs text-stone-500">
                    {p.partnerCode} · {p.mobile} · {p.email}
                  </p>
                </Link>
              ))}
              <Link
                href={`/partners?q=${encoded}`}
                className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-maroon-700 hover:bg-stone-50"
                onClick={() => setOpen(false)}
              >
                All matching partners <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          )}

          {outlets.length > 0 && (
            <section aria-label="Outlets" className={partners.length > 0 ? 'mt-1 border-t border-stone-150' : undefined}>
              <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                <Store className="h-3.5 w-3.5 text-gold-600" /> Outlets
              </p>
              {outlets.map((o) => (
                <Link key={o.id} href={`/outlets/${o.id}`} className="block px-4 py-2 hover:bg-stone-50" onClick={() => setOpen(false)}>
                  <p className="truncate text-sm font-medium text-stone-900">{o.name}</p>
                  <p className="tabular truncate text-xs text-stone-500">
                    {o.mobile} · {o.email}
                    {o.status === 'INACTIVE' ? ' · Inactive' : ''}
                  </p>
                </Link>
              ))}
              <Link
                href={`/outlets?q=${encoded}`}
                className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-maroon-700 hover:bg-stone-50"
                onClick={() => setOpen(false)}
              >
                All matching outlets <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
