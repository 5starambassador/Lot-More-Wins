import { Fragment } from 'react';
import { ArrowDown, ArrowRight, Calculator, ChevronDown, ChevronRight, HandCoins, QrCode, ScanLine, WalletCards, type LucideIcon } from 'lucide-react';
import { Logo, Wordmark } from '../../components/Brand';
import { PhoneFrame } from '../../components/PhoneFrame';
import { Reveal } from '../../components/Reveal';
import { OUTLET_SCREEN_SIZE } from './screens';

interface FlowStep {
  icon: LucideIcon;
  label: string;
  caption: string;
}

const FLOW: FlowStep[] = [
  { icon: QrCode, label: 'Partner', caption: 'Shows a QR at the counter' },
  { icon: ScanLine, label: 'Scan', caption: 'You scan it with the app' },
  { icon: Calculator, label: 'Bill', caption: 'You type the bill amount' },
  { icon: HandCoins, label: 'Collect', caption: 'The app shows what to collect' },
  { icon: WalletCards, label: 'Rewards', caption: 'The partner’s wallet updates' },
];

/** The five-stop summary of a bill at the counter, in everyday words. */
function FlowStrip() {
  return (
    <div className="glass rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10">
      <p className="eyebrow text-center">A bill at your counter, in five steps</p>
      <div className="mt-8 flex flex-col md:flex-row md:items-start md:justify-between">
        {FLOW.map((step, index) => (
          <Fragment key={step.label}>
            {index > 0 && (
              <>
                <div className="ml-8 flex flex-col items-center self-start py-1 md:hidden" aria-hidden>
                  <span className="flow-line-y h-7" />
                  <ChevronDown className="-mt-1.5 h-4 w-4 text-gilt" />
                </div>
                <div className="mt-8 hidden flex-1 items-center md:flex" aria-hidden>
                  <span className="flow-line flex-1" />
                  <ChevronRight className="-ml-1.5 h-4 w-4 shrink-0 text-gilt" />
                </div>
              </>
            )}
            <div className="flex items-center gap-5 md:w-32 md:flex-col md:gap-4 md:text-center lg:w-36">
              <div className="relative shrink-0">
                {index === FLOW.length - 1 && <span className="animate-ring absolute inset-0 rounded-full border border-gilt" aria-hidden />}
                <div className="gilt-frame rounded-full">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-canvas-deep">
                    <step.icon className="h-7 w-7 text-gilt-bright" strokeWidth={1.6} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-base font-semibold text-ivory">{step.label}</p>
                <p className="mt-0.5 text-sm font-light leading-snug text-ivory-muted">{step.caption}</p>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function OutletHero() {
  return (
    <section id="top" className="canvas-fill relative overflow-hidden pt-[4.5rem]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-40 top-10 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(224,69,63,0.42)_0%,transparent_62%)]" />
        <div className="absolute -left-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(245,197,66,0.12)_0%,transparent_65%)]" />
        <div className="animate-spin-slower absolute right-[-12rem] top-[-6rem] hidden h-[52rem] w-[52rem] rounded-full border border-dashed border-gilt/15 lg:block" />
        <div className="absolute right-[-6rem] top-0 hidden h-[40rem] w-[40rem] rounded-full border border-gilt/10 lg:block" />
      </div>

      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <div className="grid items-center gap-14 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:py-20">
          <div>
            <Reveal className="flex items-center gap-5">
              <Logo className="h-24 w-24 sm:h-32 sm:w-32" halo />
              <Wordmark size="lg" label="Outlet Admin" />
            </Reveal>

            <Reveal delay={120}>
              <h1 className="mt-10 text-[2.6rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.2rem]">
                Scan. Bill.
                <br />
                <span className="text-gilt-gradient">Done.</span>
              </h1>
            </Reveal>

            <Reveal delay={220}>
              <p className="mt-7 max-w-xl text-lg font-light leading-relaxed text-ivory-soft/90">
                The Lot More Wins Outlet Admin app is for the billing counter of every outlet in the programme. Scan the QR code a
                partner shows you, type the bill amount, and the app works out the discount, service charge and GST and tells you
                exactly what to collect. The partner’s rewards are added for you.
              </p>
            </Reveal>

            <Reveal delay={320} className="mt-10 flex flex-wrap items-center gap-4">
              <a href="#get-the-app" className="btn-gold">
                Get the app
                <ArrowRight className="h-5 w-5" />
              </a>
              <a href="#how-it-works" className="btn-ghost">
                See how billing works
                <ArrowDown className="h-4 w-4" />
              </a>
            </Reveal>

            <Reveal delay={420}>
              <p className="mt-6 text-sm font-light text-ivory-muted">
                Free for participating outlets. Your login is given to you by the Lot More Wins team.
              </p>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative mx-auto w-full max-w-[17rem] sm:max-w-[19rem]">
            <div className="animate-float">
              <PhoneFrame
                src="/screens/outlet/scan.webp"
                alt="Outlet Admin app scan screen with Camera scan and Enter code tabs"
                eager
                {...OUTLET_SCREEN_SIZE}
              />
            </div>
          </Reveal>
        </div>

        <Reveal className="pb-20 lg:pb-28">
          <FlowStrip />
        </Reveal>
      </div>
    </section>
  );
}
