import { useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ReceiptText, Sparkles, Trophy } from 'lucide-react';
import { Reveal } from './Reveal';

/** `light`: the picture has a white background, so its frame is white too. */
const GIFTS = [
  { place: '1st prize', name: '40-inch LED TV', detail: 'For the highest total referral bills', image: '/gifts/led-tv.webp', light: true },
  { place: '2nd prize', name: 'Marshall Emberton III', detail: 'For the second highest', image: '/gifts/marshall-emberton.webp', light: false },
  { place: '3rd prize', name: 'Projector', detail: 'For the third highest', image: '/gifts/projector.webp', light: true },
  { place: 'Next 22 people', name: 'Amazon gift voucher', detail: 'Worth ₹2,500 each', image: '/gifts/amazon-voucher.webp', light: false },
];

const RULES = [
  { icon: CalendarDays, label: 'Last date', value: '30 November 2026' },
  { icon: ReceiptText, label: 'Minimum to qualify', value: '10 referrals with completed bills' },
  { icon: Trophy, label: 'Who wins', value: 'The highest total referral bills' },
];

/**
 * The referral contest: the title, a swipeable slider of the gifts, then the rules.
 * `compact` fits a narrow page column: smaller title, rules stacked.
 */
export function GiftContest({ compact = false }: { compact?: boolean }) {
  const slider = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (index: number) => {
    const list = slider.current;
    const slide = list?.children[index] as HTMLElement | undefined;
    if (!list || !slide) return;
    list.scrollTo({ left: slide.offsetLeft - (list.clientWidth - slide.offsetWidth) / 2, behavior: 'smooth' });
  };

  // The active gift is the one nearest the middle, however the slider was moved.
  const handleScroll = () => {
    const list = slider.current;
    if (!list) return;
    const middle = list.scrollLeft + list.clientWidth / 2;
    let nearest = 0;
    let nearestGap = Infinity;
    Array.from(list.children as HTMLCollectionOf<HTMLElement>).forEach((slide, index) => {
      const gap = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
      if (gap < nearestGap) {
        nearest = index;
        nearestGap = gap;
      }
    });
    setActive(nearest);
  };

  const arrow =
    'flex h-11 w-11 items-center justify-center rounded-full border border-gilt/50 text-gilt-bright transition hover:bg-gilt/10 disabled:opacity-30 disabled:hover:bg-transparent';

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
        <ul
          ref={slider}
          onScroll={handleScroll}
          aria-label="Gifts to win"
          className={`relative flex snap-x snap-mandatory gap-5 overflow-x-auto px-[calc(50%-8.75rem)] py-4 [scrollbar-width:none] sm:px-[calc(50%-10.5rem)] [&::-webkit-scrollbar]:hidden ${compact ? 'mt-6' : 'mt-12'}`}
        >
          {GIFTS.map((gift, index) => (
            <li
              key={gift.name}
              className={`w-[17.5rem] shrink-0 snap-center transition duration-300 sm:w-[21rem] ${index === active ? '' : 'scale-95 opacity-60'}`}
            >
              <div className="gilt-frame h-full rounded-[2rem] shadow-[0_0_60px_-25px_rgba(245,197,66,0.7)]">
                <div className="flex h-full flex-col rounded-[calc(2rem-1.5px)] bg-gradient-to-br from-[#2A0101] via-ink to-[#430202] p-5 text-center sm:p-6">
                  <div className={`aspect-[4/3] overflow-hidden rounded-2xl ${gift.light ? 'bg-white' : 'bg-black/30'}`}>
                    <img src={gift.image} alt={gift.name} loading="lazy" className="h-full w-full object-contain" />
                  </div>
                  <p className="eyebrow mt-6">{gift.place}</p>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{gift.name}</h3>
                  <p className="mt-2 text-sm font-light text-ivory-soft/90">{gift.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-center gap-5">
          <button type="button" className={arrow} onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous gift">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex items-center">
            {GIFTS.map((gift, index) => (
              <button
                key={gift.name}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show ${gift.place}: ${gift.name}`}
                aria-current={index === active}
                className="flex h-8 w-6 items-center justify-center"
              >
                <span className={`h-2.5 w-2.5 rounded-full transition ${index === active ? 'bg-gilt' : 'bg-gilt/30'}`} />
              </button>
            ))}
          </div>
          <button type="button" className={arrow} onClick={() => goTo(active + 1)} disabled={active === GIFTS.length - 1} aria-label="Next gift">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </Reveal>

      <Reveal>
        <dl className={`mx-auto grid gap-4 text-left ${compact ? 'mt-8' : 'mt-14 max-w-5xl md:grid-cols-3'}`}>
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
