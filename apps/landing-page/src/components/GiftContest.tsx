import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ReceiptText, Sparkles, Trophy } from 'lucide-react';
import { Reveal } from './Reveal';

const AUTO_SLIDE_MS = 3000;
const SWIPE_PX = 40;

const GIFTS = [
  { place: '1st prize', name: '40-inch LED TV', detail: 'For the highest total referral bills', image: '/gifts/led-tv.webp' },
  { place: '2nd prize', name: 'Marshall Emberton III', detail: 'For the second highest', image: '/gifts/marshall-emberton.webp' },
  { place: '3rd prize', name: 'Projector', detail: 'For the third highest', image: '/gifts/projector.webp' },
  { place: 'Next 22 people', name: 'Amazon gift voucher', detail: 'Worth ₹2,500 each', image: '/gifts/amazon-voucher.webp' },
];

const RULES = [
  { icon: CalendarDays, label: 'Last date', value: '30 November 2026' },
  { icon: ReceiptText, label: 'Minimum to qualify', value: '10 referrals with completed bills' },
  { icon: Trophy, label: 'Who wins', value: 'The highest total referral bills' },
];

/** Where a gift stands relative to the active one: 0 centre, 1 right, -1 left, 2 out of sight behind. */
function positionOf(index: number, active: number): -1 | 0 | 1 | 2 {
  const gap = (index - active + GIFTS.length) % GIFTS.length;
  return gap === GIFTS.length - 1 ? -1 : gap > 1 ? 2 : (gap as 0 | 1);
}

/** Three gifts in frame: the active one large under a beam of light, its neighbours small and faded. */
function GiftSlider({ compact }: { compact: boolean }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipeStart = useRef<number | null>(null);

  const goTo = (index: number) => setActive((index + GIFTS.length) % GIFTS.length);

  // Restarts on every change, so a tap on an arrow still gives the new gift its full three seconds.
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % GIFTS.length), AUTO_SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused]);

  const arrow =
    'absolute top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gilt/60 bg-ink/60 text-gilt-bright backdrop-blur transition hover:border-gilt hover:bg-gilt hover:text-ink';

  return (
    <div
      className={compact ? 'mt-6' : 'mx-auto mt-12 max-w-5xl'}
      // Holds still only for someone tabbing through with a keyboard; a click or tap keeps it sliding.
      onFocus={(event) => setPaused(event.target.matches(':focus-visible'))}
      onBlur={() => setPaused(false)}
    >
      <div className="gilt-frame rounded-[2.25rem] shadow-[0_0_90px_-25px_rgba(245,197,66,0.75)]">
        <div className="overflow-hidden rounded-[calc(2.25rem-1.5px)] bg-gradient-to-b from-[#1C0101] via-ink to-[#2A0101]">
          <div
            className={`relative touch-pan-y select-none ${compact ? 'h-[19rem] sm:h-[22rem]' : 'h-[19rem] sm:h-[26rem] lg:h-[33rem]'}`}
            onPointerDown={(event) => {
              swipeStart.current = event.clientX;
            }}
            onPointerUp={(event) => {
              if (swipeStart.current === null) return;
              const moved = event.clientX - swipeStart.current;
              swipeStart.current = null;
              if (Math.abs(moved) >= SWIPE_PX) goTo(active + (moved < 0 ? 1 : -1));
            }}
          >
            {/* The light: a beam from above, rays turning behind the gift, and the pool it lights on the floor. */}
            <div className="animate-beam gift-beam pointer-events-none absolute inset-x-[12%] -top-4 bottom-[8%] lg:inset-x-[24%]" aria-hidden />
            <div className="pointer-events-none absolute left-1/2 top-[48%] aspect-square w-[130%] -translate-x-1/2 -translate-y-1/2 sm:w-[90%]" aria-hidden>
              <div className="gift-rays animate-spin-slower h-full w-full rounded-full opacity-60 [animation-duration:50s]" />
            </div>
            <div className="pointer-events-none absolute bottom-[7%] left-1/2 h-10 w-[62%] -translate-x-1/2 rounded-[50%] bg-gilt-bright/60 blur-2xl lg:w-[46%]" aria-hidden />
            <div className="pointer-events-none absolute bottom-[10%] left-1/2 h-3 w-[42%] -translate-x-1/2 rounded-[50%] bg-gilt-pale/70 blur-md lg:w-[30%]" aria-hidden />
            <Sparkles className="animate-twinkle pointer-events-none absolute left-[22%] top-[14%] h-5 w-5 text-gilt-pale" aria-hidden />
            <Sparkles className="animate-twinkle pointer-events-none absolute right-[22%] top-[20%] h-6 w-6 text-gilt-pale [animation-delay:0.9s]" aria-hidden />
            <Sparkles className="animate-twinkle pointer-events-none absolute right-[30%] top-[8%] h-4 w-4 text-gilt-pale [animation-delay:1.7s]" aria-hidden />

            <ul aria-label="Gifts to win" className={compact ? '[--shift:66%]' : '[--shift:66%] lg:[--shift:84%]'}>
              {GIFTS.map((gift, index) => {
                const position = positionOf(index, active);
                const centre = position === 0;
                const beside = position === 1 || position === -1;
                return (
                  <li
                    key={gift.name}
                    aria-hidden={!centre}
                    className={`absolute bottom-[11%] left-1/2 aspect-[5/4] transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,0.9,0.25,1)] ${
                      compact ? 'w-[68%]' : 'w-[68%] sm:w-[56%] lg:w-[50%]'
                    } ${centre ? 'z-20' : beside ? 'z-10' : 'z-0'}`}
                    style={{
                      opacity: centre ? 1 : beside ? 0.35 : 0,
                      filter: centre ? 'none' : 'saturate(0.7) blur(0.5px)',
                      transformOrigin: 'bottom center',
                      transform: `translateX(calc(-50% + var(--shift) * ${position === 2 ? 0 : position})) scale(${centre ? 1 : beside ? 0.55 : 0.35})`,
                    }}
                  >
                    <button
                      type="button"
                      tabIndex={beside ? 0 : -1}
                      disabled={!beside}
                      onClick={() => goTo(index)}
                      aria-label={`Show ${gift.place}: ${gift.name}`}
                      className="h-full w-full"
                    >
                      <img
                        src={gift.image}
                        alt={centre ? gift.name : ''}
                        draggable={false}
                        className={`h-full w-full object-contain object-bottom transition-[filter] duration-700 ${
                          centre ? 'drop-shadow-[0_0_38px_rgba(255,221,117,0.5)]' : ''
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>

            <button type="button" className={`${arrow} left-3 sm:left-5`} onClick={() => goTo(active - 1)} aria-label="Previous gift">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" className={`${arrow} right-3 sm:right-5`} onClick={() => goTo(active + 1)} aria-label="Next gift">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {/* Every caption shares one grid cell, so the box keeps the tallest one's height as they cross-fade. */}
          <div className="grid px-5 pb-7 pt-2 text-center">
            {GIFTS.map((gift, index) => (
              <div
                key={gift.name}
                aria-hidden={index !== active}
                className={`col-start-1 row-start-1 transition duration-500 ${index === active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
              >
                <p className="eyebrow">{gift.place}</p>
                <h3 className="text-gilt-gradient mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{gift.name}</h3>
                <p className="mt-2 text-sm font-light text-ivory-soft/90 sm:text-base">{gift.detail}</p>
              </div>
            ))}
          </div>

          {/* One bar per gift; the active one fills over the three seconds until the next slide. */}
          <div className="flex items-center justify-center gap-2 pb-6">
            {GIFTS.map((gift, index) => (
              <button
                key={gift.name}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show ${gift.place}: ${gift.name}`}
                aria-current={index === active}
                className="flex h-8 items-center"
              >
                <span className="block h-1.5 w-9 overflow-hidden rounded-full bg-gilt/25 sm:w-12">
                  {index === active && (
                    <span
                      key={`${active}-${paused}`}
                      className={`block h-full rounded-full bg-gilt ${paused ? '' : 'animate-fill'}`}
                      style={{ animationDuration: `${AUTO_SLIDE_MS}ms` }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The referral contest: the title, the gift slider, then the rules.
 * `compact` fits a narrow page column: smaller title, rules stacked.
 */
export function GiftContest({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <Reveal>
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="eyebrow inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" aria-hidden />
            Referral contest
            <Sparkles className="h-4 w-4" aria-hidden />
          </p>
          <h2 className={`mt-4 font-semibold leading-[1.1] tracking-tight ${compact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'}`}>
            Register and refer and win daily
          </h2>
          <p className={`text-gilt-gradient mt-4 font-semibold ${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}>Win gifts worth up to ₹1 lakh</p>
        </div>
      </Reveal>

      <Reveal>
        <GiftSlider compact={compact} />
      </Reveal>

      <Reveal>
        <dl className={`mx-auto grid gap-4 text-left ${compact ? 'mt-8' : 'mt-10 max-w-5xl md:grid-cols-3'}`}>
          {RULES.map(({ icon: Icon, label, value }) => (
            <div key={label} className="panel flex items-center gap-4 rounded-2xl p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gilt/50 text-gilt-bright">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.16em] text-gilt">{label}</dt>
                <dd className="mt-1 font-medium leading-snug text-ivory">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Reveal>
    </>
  );
}
