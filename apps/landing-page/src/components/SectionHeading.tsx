import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

interface SectionHeadingProps {
  /** Chapter number shown as a large outline numeral, e.g. "02". */
  chapter: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
}

/** Presentation-style section opener: outline chapter numeral, eyebrow, title and lead. */
export function SectionHeading({ chapter, eyebrow, title, lead, align = 'center' }: SectionHeadingProps) {
  const centered = align === 'center';
  return (
    <Reveal className={`relative ${centered ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}`}>
      <span
        className={`pointer-events-none absolute -top-24 select-none text-[6rem] font-bold leading-none text-transparent sm:-top-32 sm:text-[8.5rem] ${
          centered ? 'left-1/2 -translate-x-1/2' : '-left-1'
        }`}
        style={{ WebkitTextStroke: '1px rgba(245, 197, 66, 0.16)' }}
        aria-hidden
      >
        {chapter}
      </span>
      <div className={`relative flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
        <span className="h-px w-8 bg-gilt/60" />
        <span className="eyebrow">{eyebrow}</span>
        {centered && <span className="h-px w-8 bg-gilt/60" />}
      </div>
      <h2 className="relative mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.9rem]">{title}</h2>
      {lead && <p className="relative mt-5 text-base font-light leading-relaxed text-ivory-soft/90 sm:text-lg">{lead}</p>}
    </Reveal>
  );
}
