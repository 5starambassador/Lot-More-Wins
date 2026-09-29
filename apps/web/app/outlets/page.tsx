import Link from 'next/link';

export default function OutletsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Outlet Management</h1>
            <p className="text-xs text-slate-400 mt-1">
              Phase 1 Route Foundation — Participating stores and outlet admin accounts
            </p>
          </div>
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            &larr; Back to Portal
          </Link>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300">
          <p className="font-semibold text-emerald-400 mb-2">Architectural Route Status: Verified</p>
          <p className="text-slate-400 text-xs">
            Store creation, staff assignment, and terminal credentials will be enabled in subsequent phases.
          </p>
        </div>
      </div>
    </div>
  );
}
