import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Apple,
  ArrowLeft,
  Check,
  Chrome,
  Copy,
  Download as DownloadIcon,
  EllipsisVertical,
  ExternalLink,
  Share,
  Smartphone,
  SquarePlus,
  type LucideIcon,
} from 'lucide-react';
import { Logo, Wordmark } from '../components/Brand';
import { PARTNER_WEB_URL, detectDevice, type Device } from '../lib/config';
import { ScreenShowcase } from '../sections/Screens';

/**
 * The Partner App is installed from its web version (partner.lotmorewins.com) on both platforms:
 * each button opens a step-by-step guide for adding it to the home screen.
 */

type Platform = 'android' | 'ios';

interface Step {
  icon: LucideIcon;
  title: string;
  note: string;
  /** Shows the "Open the Partner App" button under this step. */
  openApp?: boolean;
}

const GUIDES: Record<Platform, { eyebrow: string; title: string; intro: string; steps: Step[] }> = {
  android: {
    eyebrow: 'Install on Android',
    title: 'Add the Partner App to your home screen',
    intro: 'On Android the Partner App installs straight from Chrome. It takes a few taps and works like any other app.',
    steps: [
      { icon: Chrome, title: 'Open the Partner App in Chrome', note: 'Use the button below to open it in Chrome.', openApp: true },
      { icon: EllipsisVertical, title: 'Tap Install, or open the ⋮ menu', note: 'Tap Install in the Partner App popup, or the three dots at the top right of Chrome.' },
      { icon: DownloadIcon, title: 'Choose "Install app"', note: 'Some phones call it "Add to Home screen". Confirm with Install.' },
      { icon: Smartphone, title: 'Open it from your home screen', note: 'The Lot More Wins icon now opens the app full screen.' },
    ],
  },
  ios: {
    eyebrow: 'Install on iPhone',
    title: 'Add the Partner App to your home screen',
    intro: 'On iPhone the Partner App installs straight from Safari. It takes four taps and works like any other app.',
    steps: [
      { icon: ExternalLink, title: 'Open the Partner App in Safari', note: 'Use the button below. It has to be Safari, not another browser.', openApp: true },
      { icon: Share, title: 'Tap the Share button', note: 'The square with an arrow pointing up, in the Safari toolbar.' },
      { icon: SquarePlus, title: 'Choose "Add to Home Screen"', note: 'Scroll down the share menu to find it, then tap Add.' },
      { icon: Smartphone, title: 'Open it from your home screen', note: 'The Lot More Wins icon now opens the app full screen.' },
    ],
  },
};

const GUIDE_ID = 'install-guide';

/** The guided "Add to Home Screen" install for the chosen platform. */
function InstallGuide({ platform }: { platform: Platform }) {
  const guide = GUIDES[platform];
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PARTNER_WEB_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.warn('Copy failed:', error);
    }
  };

  return (
    <div id={GUIDE_ID} className="panel mt-5 scroll-mt-6 rounded-3xl p-6 text-left sm:p-8">
      <p className="eyebrow">{guide.eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold">{guide.title}</h2>
      <p className="mt-2 text-sm font-light leading-relaxed text-ivory-soft/90">{guide.intro}</p>

      <ol className="mt-6 space-y-4">
        {guide.steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-4">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gilt/40 bg-gilt/15">
              <step.icon className="h-5 w-5 text-gilt-bright" strokeWidth={1.7} />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gilt text-[11px] font-bold text-ink">
                {index + 1}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{step.title}</span>
              <span className="block text-sm font-light text-ivory-muted">{step.note}</span>
              {step.openApp && (
                <a href={PARTNER_WEB_URL} className="btn-gold mt-3 !py-2.5 text-sm">
                  Open the Partner App
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-7 flex flex-col items-start gap-2 border-t border-gilt/20 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="break-all text-sm font-light text-ivory-muted">{PARTNER_WEB_URL.replace(/^https?:\/\//, '')}</span>
        <button type="button" onClick={copyLink} className="btn-ghost !py-2 text-sm">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}

const btnClass = (dimmed: boolean) => `btn-gold relative !rounded-2xl !py-5 ${dimmed ? 'opacity-70' : ''}`;

const PLATFORM_BUTTONS: { platform: Platform; icon: LucideIcon; label: string }[] = [
  { platform: 'android', icon: Smartphone, label: 'Android' },
  { platform: 'ios', icon: Apple, label: 'iOS' },
];

const scrollToGuide = (delay: number) =>
  window.setTimeout(() => document.getElementById(GUIDE_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), delay);

export default function Download() {
  const [device, setDevice] = useState<Device>('other');
  const [guide, setGuide] = useState<Platform | null>(null);

  useEffect(() => {
    const detected = detectDevice();
    setDevice(detected);
    // ?platform=android|ios: sent here by the Partner App's install popup, so open on that guide.
    const asked = new URLSearchParams(window.location.search).get('platform');
    if (asked === 'android' || asked === 'ios') {
      setGuide(asked);
      scrollToGuide(300);
    } else if (detected !== 'other') {
      setGuide(detected);
    }
  }, []);

  const openGuide = (platform: Platform) => {
    setGuide(platform);
    // Wait for the guide to render before bringing it into view.
    scrollToGuide(60);
  };

  const yourDevice = (
    <span className="absolute -top-2.5 right-5 rounded-full bg-ivory px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink">
      Your device
    </span>
  );

  return (
    <div className="canvas-fill relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[-14rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(224,69,63,0.45)_0%,transparent_62%)]" />
        <div className="animate-spin-slower absolute left-1/2 top-[-18rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full border border-dashed border-gilt/15" />
      </div>

      <header className="relative mx-auto flex h-[4.5rem] max-w-stage items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 text-sm text-ivory-soft/80 transition-colors hover:text-gilt-bright">
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
        <Wordmark />
      </header>

      <div className="relative pt-6 sm:pt-8">
        <Logo className="mx-auto h-20 w-20 sm:h-24 sm:w-24" halo />
        <ScreenShowcase compact className="mt-6" />
      </div>

      <main className="relative mx-auto max-w-xl px-5 pb-20 pt-6 text-center sm:px-8">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Download the
          <br />
          <span className="text-gilt-gradient">Lot More Wins </span>
          Partner App
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm font-light leading-relaxed text-ivory-soft/90">
          Save at every Lot More outlet, share your referral QR and watch your reward points grow in your wallet.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PLATFORM_BUTTONS.map(({ platform, icon: Icon, label }) => (
            <button
              key={platform}
              type="button"
              onClick={() => openGuide(platform)}
              aria-expanded={guide === platform}
              aria-controls={GUIDE_ID}
              className={btnClass(device !== 'other' && device !== platform)}
            >
              {device === platform && yourDevice}
              <Icon className="h-6 w-6" />
              <span className="text-left leading-tight">
                <span className="block text-xs font-medium opacity-70">How to install on</span>
                <span className="block text-lg">{label}</span>
              </span>
            </button>
          ))}
        </div>

        {guide && <InstallGuide key={guide} platform={guide} />}
      </main>
    </div>
  );
}
