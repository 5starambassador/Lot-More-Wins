import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin Sign In</h1>
        <p className="text-xs text-slate-400 mt-2">
          Central Administration Portal — Phase 1 Route Placeholder
        </p>
      </div>

      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
        Authentication workflow (OTP / credentials) will be implemented in Phase 2.
      </div>

      <div>
        <Link
          href="/"
          className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
        >
          &larr; Back to Admin Overview
        </Link>
      </div>
    </div>
  );
}
