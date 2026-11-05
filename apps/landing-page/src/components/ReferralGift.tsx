import { Gift, Sparkles } from 'lucide-react';

const STEPS = Array.from({ length: 9 }, (_, index) => index + 1);

/** The referral prize: the first partner to reach 10 successful referrals wins the speaker. */
export function ReferralGift({ className = '' }: { className?: string }) {
  return (
    <div className={`gilt-frame rounded-[2rem] shadow-[0_0_80px_-25px_rgba(245,197,66,0.75)] ${className}`}>
      <div className="relative overflow-hidden rounded-[calc(2rem-1.5px)] bg-gradient-to-br from-[#2A0101] via-ink to-[#430202] px-5 pb-8 pt-9 text-center sm:px-8 sm:pb-10">
        <span
          className="pointer-events-none absolute -left-2 -top-8 select-none text-[9rem] font-bold leading-none text-transparent"
          style={{ WebkitTextStroke: '1px rgba(245, 197, 66, 0.16)' }}
          aria-hidden
        >
          10
        </span>
        <span className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" aria-hidden />

        <div className="relative">
          <p className="eyebrow inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" aria-hidden />
            Referral challenge
            <Sparkles className="h-4 w-4" aria-hidden />
          </p>

          {/* The speaker's spotlight: turning gold rays, a bright halo, a lit floor and sparkles. */}
          <div className="relative mx-auto mt-9 max-w-[19rem] sm:max-w-sm">
            <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[175%] -translate-x-1/2 -translate-y-1/2" aria-hidden>
              <div className="gift-rays animate-spin-slower h-full w-full rounded-full [animation-duration:40s]" />
            </div>
            <div className="pointer-events-none absolute inset-x-[-14%] inset-y-[-38%] bg-[radial-gradient(ellipse,rgba(255,221,117,0.85)_0%,rgba(245,197,66,0.4)_38%,transparent_70%)]" aria-hidden />
            <div className="pointer-events-none absolute -bottom-5 inset-x-[6%] h-8 rounded-[50%] bg-gilt-bright/70 blur-xl" aria-hidden />
            <Sparkles className="animate-twinkle absolute -left-1 -top-5 h-6 w-6 text-gilt-pale" aria-hidden />
            <Sparkles className="animate-twinkle absolute -right-2 -top-3 h-5 w-5 text-gilt-pale [animation-delay:0.8s]" aria-hidden />
            <Sparkles className="animate-twinkle absolute -bottom-3 -right-3 h-4 w-4 text-gilt-pale [animation-delay:1.5s]" aria-hidden />
            <Sparkles className="animate-twinkle absolute -bottom-2 -left-3 h-4 w-4 text-gilt-pale [animation-delay:2.1s]" aria-hidden />
            <img
              src="/brand/marshall-emberton-3.png"
              alt="Marshall Emberton III Bluetooth speaker in cream and brass"
              width={820}
              height={387}
              loading="lazy"
              className="animate-float relative w-full drop-shadow-[0_22px_22px_rgba(0,0,0,0.6)]"
            />
          </div>

          <h2 className="relative mt-11 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Be the first to 10.
            <br />
            <span className="text-gilt-gradient">Win a Marshall Emberton&nbsp;III.</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm font-light leading-relaxed text-ivory-soft/90 sm:text-base">
            The first partner to complete 10 successful referrals takes this speaker home.
          </p>

          <ol className="relative mx-auto mt-6 grid max-w-md grid-cols-10 gap-1 sm:gap-1.5" aria-label="10 successful referrals to win">
            {STEPS.map((step) => (
              <li key={step} className="flex aspect-square items-center justify-center rounded-full border border-gilt/40 text-[10px] font-semibold text-gilt-bright sm:text-xs">
                {step}
              </li>
            ))}
            <li className="relative flex aspect-square items-center justify-center rounded-full bg-gilt text-ink" aria-label="10: you win">
              <span className="animate-ring absolute inset-0 rounded-full border border-gilt" aria-hidden />
              <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
