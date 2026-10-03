import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo, Wordmark } from './Brand';

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#earn', label: 'How you earn' },
  { href: '#screens', label: 'The app' },
  { href: '#get-the-app', label: 'Get the app' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 24);
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? 'border-b border-white/10 bg-canvas-deep/80 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-stage items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="Lot More Wins Partner App, back to top">
          <Logo className="h-11 w-11" />
          <Wordmark />
        </a>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Sections">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-ivory-soft/80 transition-colors hover:text-gilt-bright">
              {link.label}
            </a>
          ))}
        </nav>
        <Link to="/download" className="btn-gold !px-5 !py-2.5 !text-sm">
          Download
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {/* Reading progress, as a gold hairline under the bar. */}
      <div
        className="h-px origin-left bg-gradient-to-r from-gilt-pale via-gilt to-gilt-muted"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />
    </header>
  );
}
