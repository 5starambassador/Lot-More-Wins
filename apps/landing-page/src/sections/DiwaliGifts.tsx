import { GiftContest } from '../components/GiftContest';

/** The /diwali-launch referral contest, as a section of its own above the QR code. */
export function DiwaliGifts() {
  return (
    <section id="win" className="canvas-fill relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,197,66,0.16)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <GiftContest />
      </div>
    </section>
  );
}
