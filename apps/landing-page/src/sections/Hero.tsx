import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ChevronDown, ChevronRight, Gift, QrCode, Store, UserRound, Users, type LucideIcon } from 'lucide-react';
import { Logo, Wordmark } from '../components/Brand';
import { PhoneFrame } from '../components/PhoneFrame';
import { Reveal } from '../components/Reveal';

interface FlowStep {
  icon: LucideIcon;
  label: string;
  caption: string;
}

const FLOW: FlowStep[] = [
  { icon: UserRound, label: 'Partner', caption: 'You join the app' },
  { icon: QrCode, label: 'Referral', caption: 'You share your QR' },
  { icon: Users, label: 'Customer', caption: 'A friend comes to shop' },
  { icon: Store, label: 'Outlet', caption: 'The QR is scanned at billing' },
  { icon: Gift, label: 'Reward', caption: 'Points land in your wallet' },
];

/** The five-stop summary of the whole programme, in everyday words. */
function FlowStrip() {
  return (
    <div className="glass rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10">
      <p className="eyebrow text-center">The whole idea, in five steps</p>
      <div className="mt-8 flex flex-col md:flex-row md:items-start md:justify-between">
        {FLOW.map((step, index) => (
          <Fragment key={step.label}>
            {index > 0 && (
              <>
                {/* Connector: vertical on phones, horizontal from tablet up. */}
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

export function Hero() {
  return (
    <section id="top" className="canvas-fill relative overflow-hidden pt-[4.5rem]">
      {/* Atmosphere: a warm glow behind the phone and a faint rotating mandala ring. */}
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
              <Wordmark size="lg" />
            </Reveal>

            <Reveal delay={120}>
              <h1 className="mt-10 text-[2.6rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.2rem]">
                Shop. Share.
                <br />
                <span className="text-gilt-gradient">Earn every time.</span>
              </h1>
            </Reveal>

            <Reveal delay={220}>
              <p className="mt-7 max-w-xl text-lg font-light leading-relaxed text-ivory-soft/90">
                The Lot More Wins Partner App gives you a discount at every Lot More outlet and a personal QR code to share. When
                family and friends shop with your code, they save on their bill and you collect reward points, all tracked in your
                wallet.
              </p>
            </Reveal>

            <Reveal delay={320} className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/download" className="btn-gold">
                Get the app
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#how-it-works" className="btn-ghost">
                See how it works
                <ArrowDown className="h-4 w-4" />
              </a>
            </Reveal>

            <Reveal delay={420}>
              <p className="mt-6 text-sm font-light text-ivory-muted">Free for partners. Available for Android and iPhone.</p>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem]">
            <div className="animate-float">
              <PhoneFrame src="/screens/home.webp" alt="Partner App home screen with the two QR codes and referral progress" eager />
            </div>
            <img
              src="/brand/gift-box.webp"
              alt=""
              width={360}
              height={360}
              className="animate-float-slow absolute -left-14 bottom-16 w-28 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] sm:-left-20 sm:w-36"
            />
          </Reveal>
        </div>

        <Reveal className="pb-20 lg:pb-28">
          <FlowStrip />
        </Reveal>
      </div>
    </section>
  );
}
