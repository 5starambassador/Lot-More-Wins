import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Logo } from '../components/Brand';
import { LiveCounter } from '../components/LiveCounter';
import { QrCode } from '../components/QrCode';
import { ReferralGift } from '../components/ReferralGift';
import { Reveal } from '../components/Reveal';
import { STUDENTS_DOWNLOAD_URL } from '../lib/config';
import { SCAN_STEPS } from './DownloadCta';

/** The /diwali-launch get-the-app section: the QR code beside the live count and the referral prize. */
export function DiwaliCta() {
  return (
    <section id="get-the-app" className="canvas-fill relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute -left-32 top-10 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(245,197,66,0.14)_0%,transparent_65%)]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(245,197,66,0.14)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <Reveal>
          <div className="gilt-frame rounded-[2.5rem] shadow-[0_0_90px_-25px_rgba(245,197,66,0.6)]">
            <div className="relative overflow-hidden rounded-[2.4rem] bg-gradient-to-br from-canvas-top via-canvas to-canvas-night px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
              <span
                className="pointer-events-none absolute -top-6 right-6 select-none text-[8rem] font-bold leading-none text-transparent sm:text-[11rem]"
                style={{ WebkitTextStroke: '1px rgba(245, 197, 66, 0.1)' }}
                aria-hidden
              >
                04
              </span>

              <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
                <Logo className="h-24 w-24 sm:h-28 sm:w-28" halo />
                <p className="eyebrow mt-9 inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Diwali launch
                  <Sparkles className="h-4 w-4" aria-hidden />
                </p>
                <h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                  Scan to download the <span className="text-gilt-gradient">Partner App</span>
                </h2>
                <p className="mt-5 max-w-lg text-lg font-light leading-relaxed text-ivory-soft/90">
                  It is free, it takes a minute to set up, and your two QR codes are ready the moment you sign in.
                </p>
              </div>
                <div className='my-7 max-w-xl mx-auto'>
                  <LiveCounter />
                </div>

              {/* The row takes the gift box's height, and the QR code stretches to match it. */}
              <div className="relative mt-12 grid gap-10 lg:grid-cols-2 lg:gap-12">
                <QrCode value={STUDENTS_DOWNLOAD_URL} stretch className="mx-auto w-full max-w-[26rem] lg:max-w-none" />
                <ReferralGift />
              </div>

              <div className="relative mt-12 flex flex-col items-center text-center">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-gilt">Scan with your phone camera</p>

                <ol className="mt-8 grid w-full gap-4 text-left md:grid-cols-3 md:gap-6">
                  {SCAN_STEPS.map((step, index) => (
                    <li key={step} className="flex items-center gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gilt/50 text-sm font-semibold text-gilt-bright">
                        {index + 1}
                      </span>
                      <span className="font-light text-ivory-soft">{step}</span>
                    </li>
                  ))}
                </ol>

                <Link to="/students-download" className="btn-gold mt-10">
                  Open the download page
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
