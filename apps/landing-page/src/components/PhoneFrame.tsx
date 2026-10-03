interface PhoneFrameProps {
  src: string;
  alt: string;
  className?: string;
  /** Load immediately instead of lazily (for the hero). */
  eager?: boolean;
}

/** A Partner App screenshot inside a slim phone body. Screenshots are 720 x 1431. */
export function PhoneFrame({ src, alt, className = '', eager = false }: PhoneFrameProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="gilt-frame rounded-[2.4rem] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden rounded-[2.3rem] bg-ink p-[7px]">
          <div className="canvas-fill relative overflow-hidden rounded-[1.9rem]">
            {/* The screenshots are cropped below the status bar; this strip stands in for it. */}
            <div className="flex h-7 items-center justify-center bg-[#8c0a0a]">
              <span className="h-1.5 w-14 rounded-full bg-black/40" />
            </div>
            <img
              src={src}
              alt={alt}
              width={720}
              height={1431}
              loading={eager ? 'eager' : 'lazy'}
              className="block h-auto w-full"
            />
            <span
              className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
