interface LogoProps {
  /** Tailwind size classes for the medallion, e.g. "h-12 w-12". */
  className?: string;
  /** Adds the slow pulsing halo used behind the large hero and download logos. */
  halo?: boolean;
}

/** The Partner App logo in its gold-rimmed ivory medallion, as on the app's home header. */
export function Logo({ className = 'h-12 w-12', halo = false }: LogoProps) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      {halo && <span className="animate-ring absolute inset-0 rounded-full border border-gilt/60" aria-hidden />}
      <div className="gilt-frame relative h-full w-full rounded-full shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)]">
        <img
          src="/brand/logo.webp"
          alt="Lot More Wins"
          width={512}
          height={512}
          className="h-full w-full rounded-full bg-white object-contain p-[13%]"
        />
      </div>
    </div>
  );
}

/** Wordmark and "Partner App" pill, matching the app header. */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const large = size === 'lg';
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className={`font-semibold uppercase leading-none tracking-[0.2em] ${large ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'}`}>
        Lot More <span className="text-gilt">Wins</span>
      </span>
      <span
        className={`rounded-full border border-gilt/50 bg-black/20 font-semibold uppercase leading-none tracking-[0.22em] text-gilt ${
          large ? 'px-3 py-1.5 text-[11px]' : 'px-2 py-1 text-[9px]'
        }`}
      >
        Partner App
      </span>
    </div>
  );
}
