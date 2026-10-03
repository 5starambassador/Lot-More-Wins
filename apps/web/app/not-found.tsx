import Image from 'next/image';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

/** Any address the console does not have: a branded page with a way back, instead of the bare default 404. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/brand/lotmore-logo.png"
          alt="Lot More"
          width={64}
          height={64}
          priority
          className="mx-auto h-16 w-16 rounded-md border border-gold-400/60 bg-white object-contain"
        />
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-stone-900">Page not found</h1>
        <p className="mt-1.5 text-[13px] text-stone-500">This address does not exist in the Lot More Wins console. It may have been moved, or the link may be mistyped.</p>
        <Link href="/dashboard" className={buttonClass('primary', 'md', 'mt-6')}>
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
