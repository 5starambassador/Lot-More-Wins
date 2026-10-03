import type { ReactNode } from 'react';
import { ArrowRight, Download, Plus, QrCode, ScanLine, Share2, ShoppingBag, Users } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';

/** Small "Example" marker for vignettes that show made-up figures. */
function ExampleTag() {
  return (
    <span className="rounded-full border border-gilt/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-gilt/90">
      Example
    </span>
  );
}

function Vignette({ children }: { children: ReactNode }) {
  return <div className="panel w-full max-w-md rounded-3xl p-6 shadow-[0_30px_70px_-35px_rgba(0,0,0,0.9)] sm:p-7">{children}</div>;
}

/** Step 1: the two QR codes every partner gets, as on the app's home screen. */
function TwoCodes() {
  const codes = [
    { icon: QrCode, title: 'Personal Discount QR', note: 'Show it at billing' },
    { icon: Users, title: 'Referral QR', note: 'Share and earn points' },
  ];
  return (
    <Vignette>
      <div className="grid grid-cols-2 gap-4">
        {codes.map((code) => (
          <div key={code.title} className="glass rounded-2xl p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gilt/40 bg-gilt/15">
              <code.icon className="h-5 w-5 text-gilt-bright" strokeWidth={1.7} />
            </span>
            <p className="mt-4 text-sm font-medium leading-snug">{code.title}</p>
            <p className="mt-1.5 flex items-center justify-between text-xs font-light text-ivory-muted">
              {code.note}
              <ArrowRight className="h-3.5 w-3.5" />
            </p>
          </div>
        ))}
      </div>
    </Vignette>
  );
}

/** Step 2: the referral code being sent to a friend. */
function ShareCode() {
  return (
    <Vignette>
      <div className="flex items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#FBF6EC]">
          <QrCode className="h-16 w-16 text-canvas" strokeWidth={1.4} />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3">
          <p className="text-sm font-medium">You are invited to Lot More Wins!</p>
          <p className="mt-1 text-xs font-light leading-relaxed text-ivory-muted">Use this QR at any Lot More outlet and save on your bill.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <span className="flex items-center justify-center gap-2 rounded-xl border border-gilt/40 py-2.5 text-sm font-medium text-gilt">
          <Download className="h-4 w-4" />
          Download QR
        </span>
        <span className="flex items-center justify-center gap-2 rounded-xl bg-gilt py-2.5 text-sm font-semibold text-ink">
          <Share2 className="h-4 w-4" />
          Share QR
        </span>
      </div>
    </Vignette>
  );
}

/** Step 3: the bill at the outlet, with the discount applied after the scan. */
function OutletBill() {
  return (
    <Vignette>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-gilt-bright">
          <ScanLine className="h-5 w-5" />
          QR scanned at the counter
        </span>
        <ExampleTag />
      </div>
      <dl className="mt-5 space-y-3 rounded-2xl bg-[#FBF6EC] p-5 text-sm text-ink">
        <div className="flex justify-between">
          <dt>Bill amount</dt>
          <dd className="font-medium">₹1,200</dd>
        </div>
        <div className="flex justify-between text-[#9A1818]">
          <dt>Referral discount</dt>
          <dd className="font-medium">− ₹120</dd>
        </div>
        <div className="flex justify-between border-t border-dashed border-ink/25 pt-3 text-base font-semibold">
          <dt>Your friend pays</dt>
          <dd>₹1,080</dd>
        </div>
      </dl>
    </Vignette>
  );
}

/** Step 4: the two kinds of points arriving after a closed bill. */
function PointsCredited() {
  const credits = [
    { icon: Users, title: 'Referral points', note: 'A friend closed a bill with your QR' },
    { icon: ShoppingBag, title: 'Purchase points', note: 'You shopped with your Personal Discount QR' },
  ];
  return (
    <Vignette>
      <ul className="space-y-3">
        {credits.map((credit) => (
          <li key={credit.title} className="glass flex items-center gap-4 rounded-2xl p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gilt/15">
              <credit.icon className="h-5 w-5 text-gilt-bright" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{credit.title}</span>
              <span className="block text-xs font-light text-ivory-muted">{credit.note}</span>
            </span>
            <span className="flex items-center gap-0.5 text-lg font-semibold text-gilt-bright">
              <Plus className="h-4 w-4" />
              pts
            </span>
          </li>
        ))}
      </ul>
    </Vignette>
  );
}

/** Step 5: the wallet summary card, mirroring the app's Wallet tab. */
function WalletCard() {
  return (
    <Vignette>
      <div className="flex justify-end">
        <ExampleTag />
      </div>
      <div className="text-center">
        <p className="eyebrow !text-ivory-muted">Total points</p>
        <p className="text-gilt-gradient mt-2 text-6xl font-bold leading-none">480</p>
        <p className="mt-3 text-sm font-light text-ivory-soft">Shown with its value in ₹</p>
      </div>
      <div className="mt-5 flex items-center justify-center gap-6 border-t border-white/10 pt-5 text-center">
        <div>
          <p className="text-xs font-light text-ivory-muted">Purchase points</p>
          <p className="mt-0.5 text-lg font-medium">300</p>
        </div>
        <Plus className="h-4 w-4 text-gilt" />
        <div>
          <p className="text-xs font-light text-ivory-muted">Referral points</p>
          <p className="mt-0.5 text-lg font-medium">180</p>
        </div>
      </div>
      <span className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gilt py-3 text-sm font-semibold text-ink">
        <QrCode className="h-4 w-4" />
        Redeem QR
      </span>
    </Vignette>
  );
}

interface Step {
  title: string;
  who: string;
  body: string;
  visual: ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Join and get your two QR codes',
    who: 'You',
    body: 'Sign up in the app in about a minute. You immediately receive two QR codes: one that gives you a partner discount when you shop, and one that you can share with other people.',
    visual: <TwoCodes />,
  },
  {
    title: 'Share your Referral QR',
    who: 'You',
    body: 'Send your Referral QR to family and friends from the app, or simply show it on your phone. Anyone who has it gets a discount at Lot More outlets.',
    visual: <ShareCode />,
  },
  {
    title: 'They shop at an outlet',
    who: 'Your friend and the outlet',
    body: 'At the billing counter your friend shows the QR. The outlet scans it, the discount comes off the bill straight away, and the purchase is recorded against your name.',
    visual: <OutletBill />,
  },
  {
    title: 'Your points are added automatically',
    who: 'Lot More Wins',
    body: 'As soon as that bill is closed, referral points are credited to you. Shop yourself with your Personal Discount QR and you collect purchase points as well. There is nothing to claim or fill in.',
    visual: <PointsCredited />,
  },
  {
    title: 'Track everything in your wallet',
    who: 'You',
    body: 'The Wallet tab shows your total points, what they are worth in rupees and a full history with expiry dates. When you want to use them, show your Redeem QR at an outlet.',
    visual: <WalletCard />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-canvas-deep py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gilt/40 to-transparent" aria-hidden />
      <div className="mx-auto max-w-stage px-5 sm:px-8">
        <SectionHeading
          chapter="01"
          eyebrow="How the app works"
          title={
            <>
              From one QR code to <span className="text-gilt-gradient">points in your wallet</span>
            </>
          }
          lead="Follow a single referral from start to finish. Every step happens inside the app or at the outlet counter, and none of it needs paperwork."
        />

        <div className="relative mt-20 sm:mt-24">
          {/* The journey line, with a light travelling down it. */}
          <div className="absolute bottom-0 left-6 top-0 w-px bg-gradient-to-b from-gilt/60 via-gilt/25 to-transparent lg:left-1/2" aria-hidden>
            <span className="animate-travel-y absolute -left-[3px] h-[7px] w-[7px] rounded-full bg-gilt-bright shadow-[0_0_14px_4px_rgba(255,221,117,0.7)]" />
          </div>

          <ol className="space-y-16 lg:space-y-24">
            {STEPS.map((step, index) => {
              const flipped = index % 2 === 1;
              return (
                <li key={step.title} className="relative grid gap-7 pl-16 lg:grid-cols-2 lg:items-center lg:gap-28 lg:pl-0">
                  <span className="gilt-frame absolute left-6 top-0 -translate-x-1/2 rounded-full lg:left-1/2 lg:top-1/2 lg:-translate-y-1/2">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-deep text-base font-semibold text-gilt-bright">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </span>

                  <Reveal className={flipped ? 'lg:order-2' : 'lg:text-right'}>
                    <p className="eyebrow">{step.who}</p>
                    <h3 className="mt-3 text-2xl font-semibold leading-snug sm:text-[1.7rem]">{step.title}</h3>
                    <p className={`mt-4 max-w-md font-light leading-relaxed text-ivory-soft/90 ${flipped ? '' : 'lg:ml-auto'}`}>{step.body}</p>
                  </Reveal>

                  <Reveal delay={140} className={`flex ${flipped ? 'lg:order-1 lg:justify-end' : ''}`}>
                    {step.visual}
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
