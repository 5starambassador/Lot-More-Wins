import type { ReactNode } from 'react';
import { BadgeCheck, CheckCircle2, KeyRound, Keyboard, QrCode, ScanLine, UserRound, Users, WalletCards } from 'lucide-react';
import { Reveal } from '../../components/Reveal';
import { SectionHeading } from '../../components/SectionHeading';

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

/** Step 1: the sign-in, done once per phone. */
function SignIn() {
  return (
    <Vignette>
      <div className="space-y-3">
        <div className="glass rounded-2xl px-4 py-3">
          <p className="text-[11px] font-light uppercase tracking-[0.18em] text-ivory-muted">Email</p>
          <p className="mt-0.5 text-sm font-medium">manager@youroutlet.com</p>
        </div>
        <div className="glass rounded-2xl px-4 py-3">
          <p className="text-[11px] font-light uppercase tracking-[0.18em] text-ivory-muted">Password</p>
          <p className="mt-0.5 text-sm font-medium tracking-[0.3em]">••••••••</p>
        </div>
      </div>
      <span className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gilt py-3 text-sm font-semibold text-ink">
        <KeyRound className="h-4 w-4" />
        Sign in
      </span>
      <p className="mt-4 text-center text-xs font-light text-ivory-muted">You stay signed in on this phone until you sign out.</p>
    </Vignette>
  );
}

/** Step 2: the three QR codes a partner can show. */
function ThreeCodes() {
  const codes = [
    { icon: QrCode, title: 'Personal Discount QR', note: 'The partner is paying for their own bill' },
    { icon: Users, title: 'Referral QR', note: 'A friend of a partner, sent by them' },
    { icon: WalletCards, title: 'Redeem QR', note: 'The partner pays part of the bill from their wallet' },
  ];
  return (
    <Vignette>
      <ul className="space-y-3">
        {codes.map((code) => (
          <li key={code.title} className="glass flex items-center gap-4 rounded-2xl p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gilt/40 bg-gilt/15">
              <code.icon className="h-5 w-5 text-gilt-bright" strokeWidth={1.7} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{code.title}</span>
              <span className="block text-xs font-light text-ivory-muted">{code.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-xs font-light text-ivory-muted">
        <Keyboard className="h-4 w-4 shrink-0 text-gilt" />
        Camera not working? Type the code printed under the QR instead.
      </p>
    </Vignette>
  );
}

/** Step 3: the partner card shown after a successful scan. */
function PartnerCheck() {
  return (
    <Vignette>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-gilt-bright">
          <BadgeCheck className="h-5 w-5" />
          QR verified
        </span>
        <ExampleTag />
      </div>
      <div className="glass mt-5 flex items-center gap-4 rounded-2xl p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gilt/15">
          <UserRound className="h-6 w-6 text-gilt-bright" strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Priya S.</span>
          <span className="block text-xs font-light text-ivory-muted">Partner code LMW-1024</span>
        </span>
        <span className="rounded-full border border-gilt/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gilt">
          Repeat bill
        </span>
      </div>
      <p className="mt-4 text-xs font-light leading-relaxed text-ivory-muted">
        For a Referral QR you also type the guest’s name and mobile number, so the right partner gets the reward.
      </p>
    </Vignette>
  );
}

/** Step 4: the bill breakdown the app works out, with the same order as the app. */
function BillBreakdown() {
  const rows: [string, string, string?][] = [
    ['Bill amount', '₹1,000.00'],
    ['Repeat bill discount (10%)', '− ₹100.00', 'text-[#9A1818]'],
    ['After discount', '₹900.00', 'font-medium'],
    ['Service charge (5%)', '+ ₹45.00'],
    ['GST (5%)', '+ ₹47.25'],
  ];
  return (
    <Vignette>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-gilt-bright">
          <ScanLine className="h-5 w-5" />
          Worked out by the app
        </span>
        <ExampleTag />
      </div>
      <dl className="mt-5 space-y-3 rounded-2xl bg-[#FBF6EC] p-5 text-sm text-ink">
        {rows.map(([label, value, tone]) => (
          <div key={label} className={`flex justify-between ${tone ?? ''}`}>
            <dt>{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-dashed border-ink/25 pt-3 text-base font-semibold">
          <dt>Collect</dt>
          <dd>₹992</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs font-light text-ivory-muted">The amount to collect is rounded to the nearest rupee.</p>
    </Vignette>
  );
}

/** Step 5: the completed bill. */
function BillDone() {
  return (
    <Vignette>
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gilt/50 bg-gilt/15">
          <CheckCircle2 className="h-8 w-8 text-gilt-bright" strokeWidth={1.6} />
        </span>
        <p className="mt-4 text-xl font-semibold">Bill completed</p>
        <p className="mt-1 text-sm font-light text-ivory-soft">Collect ₹992 from the customer</p>
      </div>
      <ul className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm font-light text-ivory-soft">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gilt" /> Saved in your History tab
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gilt" /> The partner’s rewards are added to their wallet
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gilt" /> The partner sees the bill in their Partner App
        </li>
      </ul>
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
    title: 'Sign in once',
    who: 'You',
    body: 'The Lot More Wins team gives your outlet an email address and password. Sign in with them the first time you open the app. After that the app opens straight to the scanner, every day, until you choose to sign out.',
    visual: <SignIn />,
  },
  {
    title: 'Scan the QR code the customer shows',
    who: 'You and the customer',
    body: 'Tap Scan and point the phone at the customer’s QR code. There are three kinds, and the app knows which is which on its own. If the camera cannot read it, switch to Enter code and type the code shown under the QR.',
    visual: <ThreeCodes />,
  },
  {
    title: 'Check who it is',
    who: 'You',
    body: 'The app shows the partner’s name and partner code, and whether this is their first bill at your outlet or a repeat visit. The discount is different for each, and the app picks the right one. Tap Proceed to continue.',
    visual: <PartnerCheck />,
  },
  {
    title: 'Type the bill amount',
    who: 'You',
    body: 'Enter the total of the customer’s bill before any discount or tax. The app takes off the discount, adds your service charge and GST in the right order, and shows each line, so you and the customer can both see how the total was reached.',
    visual: <BillBreakdown />,
  },
  {
    title: 'Complete the bill and collect',
    who: 'You',
    body: 'Tap Complete bill and collect the amount shown. That is it: the bill is saved, the partner’s points or cashback are added to their wallet automatically, and you are back at the scanner for the next customer.',
    visual: <BillDone />,
  },
];

export function OutletBilling() {
  return (
    <section id="how-it-works" className="relative bg-canvas-deep py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gilt/40 to-transparent" aria-hidden />
      <div className="mx-auto max-w-stage px-5 sm:px-8">
        <SectionHeading
          chapter="01"
          eyebrow="How billing works"
          title={
            <>
              From a QR code to <span className="text-gilt-gradient">a finished bill</span>
            </>
          }
          lead="Follow one customer from the moment they reach your counter. There is no maths to do and nothing to write down: the app handles both."
        />

        <div className="relative mt-20 sm:mt-24">
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
