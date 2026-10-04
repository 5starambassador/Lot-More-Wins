import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from '../components/Brand';
import { QrCode } from '../components/QrCode';
import { Reveal } from '../components/Reveal';
import { downloadPageUrl } from '../lib/config';

const SCAN_STEPS = [
  'Open the camera on your phone.',
  'Point it at the QR code and tap the link that appears.',
  'On the download page, choose Android or iPhone.',
];

export function DownloadCta() {
  return (
    <section id="get-the-app" className="canvas-fill relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute -left-32 top-10 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(245,197,66,0.14)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <Reveal>
          <div className="gilt-frame rounded-[2.5rem] shadow-[0_0_90px_-25px_rgba(245,197,66,0.6)]">
            <div className="relative overflow-hidden rounded-[2.4rem] bg-gradient-to-br from-canvas-top via-canvas to-canvas-night px-6 py-12 text-center sm:px-12 sm:py-16 lg:px-16 lg:py-20">
              <span
                className="pointer-events-none absolute -top-6 right-6 select-none text-[8rem] font-bold leading-none text-transparent sm:text-[11rem]"
                style={{ WebkitTextStroke: '1px rgba(245, 197, 66, 0.1)' }}
                aria-hidden
              >
                04
              </span>

              {/* One centred column: the heading, the QR code at full size, then how to use it. */}
              <div className="relative mx-auto flex max-w-2xl flex-col items-center">
                <Logo className="h-24 w-24 sm:h-28 sm:w-28" halo />
                <p className="eyebrow mt-9">Get the app</p>
                <h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                  Scan to download the <span className="text-gilt-gradient">Partner App</span>
                </h2>
                <p className="mt-5 max-w-lg text-lg font-light leading-relaxed text-ivory-soft/90">
                  It is free, it takes a minute to set up, and your two QR codes are ready the moment you sign in.
                </p>

                <div className="mt-12 w-full max-w-[26rem] sm:max-w-[32rem] lg:max-w-[36rem]">
                  <QrCode value={downloadPageUrl()} />
                  <p className="mt-5 text-sm font-medium uppercase tracking-[0.24em] text-gilt">Scan with your phone camera</p>
                </div>

                <ol className="mt-12 space-y-4 text-left">
                  {SCAN_STEPS.map((step, index) => (
                    <li key={step} className="flex items-center gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gilt/50 text-sm font-semibold text-gilt-bright">
                        {index + 1}
                      </span>
                      <span className="font-light text-ivory-soft">{step}</span>
                    </li>
                  ))}
                </ol>

                <Link to="/download" className="btn-gold mt-10">
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

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-canvas-night py-10">
      <div className="mx-auto flex max-w-stage flex-col items-center justify-between gap-5 px-5 text-sm font-light text-ivory-muted sm:flex-row sm:px-8">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <span>Lot More Wins Partner App</span>
        </div>
        <p>More connections. More discounts. More prizes.</p>
        <Link to="/download" className="font-medium text-gilt transition-colors hover:text-gilt-bright">
          Download
        </Link>
      </div>
    </footer>
  );
}
