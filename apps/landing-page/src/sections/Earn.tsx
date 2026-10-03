import { BadgePercent, Coins, Equal, Plus, QrCode, Receipt, ShoppingBag, Store, Users, Wallet, type LucideIcon } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';

interface Stage {
  icon: LucideIcon;
  title: string;
  happens: string;
  result: string;
}

const STAGES: Stage[] = [
  { icon: QrCode, title: 'Referral', happens: 'You pass on your Referral QR.', result: 'Costs you nothing' },
  { icon: Store, title: 'Customer visit', happens: 'Your friend walks into a Lot More outlet.', result: 'They bring your QR' },
  { icon: Receipt, title: 'Transaction', happens: 'The outlet scans the QR and closes the bill.', result: 'They save on the bill' },
  { icon: Coins, title: 'Reward', happens: 'Referral points are credited to you.', result: 'You earn points' },
  { icon: Wallet, title: 'Wallet', happens: 'Points add up and show their rupee value.', result: 'You redeem at outlets' },
];

/** The earning pipeline: five stages on a gold track, with a coin travelling along it. */
function Pipeline() {
  return (
    <div className="relative">
      {/* Track: horizontal behind the icons on desktop, vertical beside them on phones. */}
      <div className="absolute left-[10%] right-[10%] top-9 hidden h-px bg-gilt/30 lg:block" aria-hidden>
        <span className="animate-travel absolute -top-[9px] flex h-[19px] w-[19px] -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-gilt-pale to-gilt-muted text-[10px] font-bold text-ink shadow-[0_0_18px_4px_rgba(245,197,66,0.55)]">
          ₹
        </span>
      </div>
      <div className="absolute bottom-0 left-9 top-0 w-px bg-gilt/30 lg:hidden" aria-hidden>
        <span className="animate-travel-y absolute -left-[9px] flex h-[19px] w-[19px] -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-gilt-pale to-gilt-muted text-[10px] font-bold text-ink shadow-[0_0_18px_4px_rgba(245,197,66,0.55)]">
          ₹
        </span>
      </div>

      <ol className="relative grid gap-8 lg:grid-cols-5 lg:gap-5">
        {STAGES.map((stage, index) => (
          <li key={stage.title}>
            <Reveal delay={index * 110} className="flex gap-5 lg:flex-col lg:items-center lg:gap-0 lg:text-center">
              <span className="gilt-frame h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl">
                <span className="flex h-full w-full items-center justify-center rounded-[0.9rem] bg-canvas-deep">
                  <stage.icon className="h-8 w-8 text-gilt-bright" strokeWidth={1.5} />
                </span>
              </span>
              <div className="lg:mt-6">
                <p className="text-xs font-medium text-gilt/80">Stage {index + 1}</p>
                <h3 className="mt-1 text-lg font-semibold">{stage.title}</h3>
                <p className="mt-2 text-sm font-light leading-relaxed text-ivory-soft/85">{stage.happens}</p>
                <span className="mt-3 inline-block rounded-full bg-gilt/15 px-3 py-1 text-xs font-medium text-gilt-bright">{stage.result}</span>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Way {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  gains: string[];
}

const WAYS: Way[] = [
  {
    icon: ShoppingBag,
    label: 'When you shop',
    title: 'Your Personal Discount QR',
    body: 'Show it at billing in any Lot More outlet. Each outlet sets its own partner discount, and you can see it on the outlet page in the app before you go.',
    gains: ['Partner discount on your bill', 'Purchase points on every bill'],
  },
  {
    icon: Users,
    label: 'When friends shop',
    title: 'Your Referral QR',
    body: 'Every time someone closes a bill with your Referral QR, they get a discount and you get referral points. There is no limit on how many people you can refer.',
    gains: ['A discount for the person you referred', 'Referral points for you, every time'],
  },
];

export function Earn() {
  return (
    <section id="earn" className="canvas-fill relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(224,69,63,0.3)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <SectionHeading
          chapter="02"
          eyebrow="How partners earn"
          title={
            <>
              One shared QR. <span className="text-gilt-gradient">Points on every bill.</span>
            </>
          }
          lead="You earn in two ways: on your own shopping, and on the shopping of everyone you refer. Here is what happens to a single referral."
        />

        <div className="mt-20">
          <Pipeline />
        </div>

        <div className="mt-20 grid gap-6 lg:grid-cols-2">
          {WAYS.map((way, index) => (
            <Reveal key={way.title} delay={index * 140}>
              <article className="glass h-full rounded-[2rem] p-7 sm:p-9">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gilt/40 bg-gilt/15">
                    <way.icon className="h-6 w-6 text-gilt-bright" strokeWidth={1.6} />
                  </span>
                  <div>
                    <p className="eyebrow">{way.label}</p>
                    <h3 className="mt-1.5 text-xl font-semibold sm:text-2xl">{way.title}</h3>
                  </div>
                </div>
                <p className="mt-6 font-light leading-relaxed text-ivory-soft/90">{way.body}</p>
                <ul className="mt-6 space-y-3">
                  {way.gains.map((gain) => (
                    <li key={gain} className="flex items-center gap-3 text-sm font-medium">
                      <BadgePercent className="h-5 w-5 shrink-0 text-gilt" strokeWidth={1.7} />
                      {gain}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Refer & Win: the milestone card from the app's home screen. */}
        <Reveal className="mt-6">
          <div className="gilt-frame rounded-[2rem] shadow-[0_0_60px_-18px_rgba(245,197,66,0.55)]">
            <div className="relative grid items-center gap-8 overflow-hidden rounded-[1.9rem] bg-gradient-to-br from-canvas to-canvas-night p-7 sm:p-10 lg:grid-cols-[auto_1fr_auto]">
              <img
                src="/brand/gift-box.webp"
                alt=""
                width={360}
                height={360}
                loading="lazy"
                className="animate-float-slow mx-auto w-32 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] lg:w-40"
              />
              <div>
                <p className="eyebrow">Refer &amp; win</p>
                <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">A bonus for your successful referrals</h3>
                <p className="mt-3 max-w-xl font-light leading-relaxed text-ivory-soft/90">
                  The app counts every customer who closes a bill with your Referral QR. Reach the target shown on your home screen and
                  you unlock a special discount on your next purchase.
                </p>
                <div className="mt-6 h-3 max-w-xl overflow-hidden rounded-full border border-gilt/40 bg-black/40" aria-hidden>
                  <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-gilt-muted via-gilt to-gilt-pale" />
                </div>
              </div>
              <p className="text-center text-sm font-light text-ivory-muted lg:text-right">
                Successful
                <br className="hidden lg:block" /> referrals
                <span className="text-gilt-gradient mt-1 block text-5xl font-bold">7</span>
                <span className="text-xs">of your target (example)</span>
              </p>
            </div>
          </div>
        </Reveal>

        {/* The wallet sum. */}
        <Reveal className="mt-6">
          <div className="panel rounded-[2rem] p-7 sm:p-10">
            <p className="eyebrow text-center">How your wallet adds it up</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-5 md:flex-row md:gap-8">
              <div className="text-center">
                <p className="text-3xl font-semibold sm:text-4xl">Purchase points</p>
                <p className="mt-1 text-sm font-light text-ivory-muted">from your own bills</p>
              </div>
              <Plus className="h-7 w-7 text-gilt" />
              <div className="text-center">
                <p className="text-3xl font-semibold sm:text-4xl">Referral points</p>
                <p className="mt-1 text-sm font-light text-ivory-muted">from bills closed with your QR</p>
              </div>
              <Equal className="h-7 w-7 text-gilt" />
              <div className="text-center">
                <p className="text-gilt-gradient text-3xl font-bold sm:text-4xl">Total points</p>
                <p className="mt-1 text-sm font-light text-ivory-muted">shown with its value in ₹</p>
              </div>
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm font-light leading-relaxed text-ivory-soft/85">
              Each entry in your points history shows where it came from and when it expires. To spend your points, open the wallet
              and show your Redeem QR at the outlet.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
