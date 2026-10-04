interface PhoneFrameProps {
  src: string;
  alt: string;
  className?: string;
  /** Load immediately instead of lazily (for the hero). */
  eager?: boolean;
  /** A thumbnail-sized phone: tighter corners and bezel to suit the smaller body. */
  small?: boolean;
}

/** A Partner App screenshot inside a slim phone body. Screenshots are 720 x 1431. */
export function PhoneFrame({ src, alt, className = '', eager = false, small = false }: PhoneFrameProps) {
  return (
    <div className={`relative ${className}`}>
      <div className={`gilt-frame shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] ${small ? 'rounded-[1rem]' : 'rounded-[2.4rem]'}`}>
        <div className={`relative overflow-hidden bg-ink ${small ? 'rounded-[0.95rem] p-[2px]' : 'rounded-[2.3rem] p-[7px]'}`}>
          <div className={`canvas-fill relative overflow-hidden ${small ? 'rounded-[0.8rem]' : 'rounded-[1.9rem]'}`}>
            {/* The screenshots are cropped below the status bar; this strip stands in for it. */}
            <div className={`flex items-center justify-center bg-[#8c0a0a] ${small ? 'h-2.5' : 'h-7'}`}>
              <span className={`rounded-full bg-black/40 ${small ? 'h-[2px] w-5' : 'h-1.5 w-14'}`} />
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
