import Link from 'next/link';

export default function HomePage() {
  const adminModules = [
    { title: 'Dashboard', path: '/dashboard', desc: 'Central metrics and system overview' },
    { title: 'Partners', path: '/partners', desc: 'Manage registered business partners' },
    { title: 'Outlets', path: '/outlets', desc: 'Manage participating outlets & admins' },
    { title: 'Referrals', path: '/referrals', desc: 'Monitor customer referrals & rewards' },
    { title: 'Bills', path: '/bills', desc: 'Bill transactions and discount validations' },
    { title: 'Wallet', path: '/wallet', desc: 'Partner wallets, balances, and payouts' },
    { title: 'Settings', path: '/settings', desc: 'Platform configuration and rules' },
    { title: 'Auth (Login)', path: '/login', desc: 'Admin authentication placeholder' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        <header className="mb-12 border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 mb-3 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Phase 1 Architecture Initialized
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Lot More Wins <span className="text-emerald-400">Admin</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Central Administration Panel & Universal API Gateway
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/api/health"
              target="_blank"
              className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-medium text-slate-200 transition border border-slate-700"
            >
              Verify API Health (GET /api/health)
            </Link>
          </div>
        </header>

        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Admin Route Foundation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {adminModules.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className="group p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-semibold text-white group-hover:text-emerald-400 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2">{item.desc}</p>
                </div>
                <span className="mt-4 text-xs font-medium text-emerald-400/80 group-hover:text-emerald-300 flex items-center gap-1">
                  Access module &rarr;
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
