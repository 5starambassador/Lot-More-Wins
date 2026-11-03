import { ArrowUpRight, Play } from 'lucide-react';
import { Logo } from '../../components/Brand';
import { QrCode } from '../../components/QrCode';
import { Reveal } from '../../components/Reveal';
import { OUTLET_PLAY_URL } from '../../lib/config';

const STEPS = [
  'Open Google Play on the outlet’s Android phone, or scan this code with its camera.',
  'Install “Lot More Wins Outlet Admin”.',
  'Sign in with the email and password from the Lot More Wins team.',
];

export function OutletGetApp() {
  return (
    <section id="get-the-app" className="relative overflow-hidden bg-canvas-deep py-24 sm:py-32">
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
                05
              </span>

              <div className="relative mx-auto flex max-w-2xl flex-col items-center">
                <Logo className="h-24 w-24 sm:h-28 sm:w-28" halo />
                <p className="eyebrow mt-9">Get the app</p>
                <h2 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                  Install the <span className="text-gilt-gradient">Outlet Admin</span> app
                </h2>
                <p className="mt-5 max-w-lg text-lg font-light leading-relaxed text-ivory-soft/90">
                  Free on Google Play for Android phones. Set it up once on your billing phone and you are ready for the next
                  customer.
                </p>

                <a href={OUTLET_PLAY_URL} target="_blank" rel="noopener noreferrer" className="btn-gold mt-10">
                  <Play className="h-5 w-5 fill-current" />
                  Get it on Google Play
                  <ArrowUpRight className="h-5 w-5" />
                </a>

                <div className="mt-12 w-full max-w-[18rem] sm:max-w-[20rem]">
                  <QrCode value={OUTLET_PLAY_URL} />
                  <p className="mt-5 text-sm font-medium uppercase tracking-[0.24em] text-gilt">Scan with the outlet’s phone</p>
                </div>

                <ol className="mt-12 space-y-4 text-left">
                  {STEPS.map((step, index) => (
                    <li key={step} className="flex items-center gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gilt/50 text-sm font-semibold text-gilt-bright">
                        {index + 1}
                      </span>
                      <span className="font-light text-ivory-soft">{step}</span>
                    </li>
                  ))}
                </ol>

                <p className="mt-10 max-w-lg text-sm font-light leading-relaxed text-ivory-muted">
                  Want your outlet to join Lot More Wins? Contact the Lot More Wins team and they will set up your outlet and send you
                  your login.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
