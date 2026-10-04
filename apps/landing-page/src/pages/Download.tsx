import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Apple,
  ArrowLeft,
  Check,
  Copy,
  Download as DownloadIcon,
  ExternalLink,
  Loader2,
  Play,
  RotateCw,
  Share,
  Smartphone,
  SquarePlus,
  type LucideIcon,
} from 'lucide-react';
import { Logo, Wordmark } from '../components/Brand';
import { PARTNER_WEB_URL, detectDevice, type Device } from '../lib/config';
import { useAppLinks, type AppLink } from '../lib/app-links';
import { ScreenShowcase } from '../sections/Screens';

interface IosStep {
  icon: LucideIcon;
  title: string;
  note: string;
}

const IOS_STEPS: IosStep[] = [
  { icon: ExternalLink, title: 'Open the Partner App in Safari', note: 'Use the button below. It has to be Safari, not another browser.' },
  { icon: Share, title: 'Tap the Share button', note: 'The square with an arrow pointing up, in the Safari toolbar.' },
  { icon: SquarePlus, title: 'Choose "Add to Home Screen"', note: 'Scroll down the share menu to find it, then tap Add.' },
  { icon: Smartphone, title: 'Open it from your home screen', note: 'The Lot More Wins icon now opens the app full screen.' },
];

/** The guided "Add to Home Screen" install for iPhone, shown under the iOS button. */
function IosGuide({ webAppUrl }: { webAppUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!webAppUrl) return;
    try {
      await navigator.clipboard.writeText(webAppUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.warn('Copy failed:', error);
    }
  };

  return (
    <div id="ios-guide" className="panel mt-5 rounded-3xl p-6 text-left sm:p-8">
      <p className="eyebrow">Install on iPhone</p>
      <h2 className="mt-2 text-xl font-semibold">Add the Partner App to your home screen</h2>
      <p className="mt-2 text-sm font-light leading-relaxed text-ivory-soft/90">
        On iPhone the Partner App installs straight from Safari. It takes four taps and works like any other app.
      </p>

      <ol className="mt-6 space-y-4">
        {IOS_STEPS.map((step, index) => (
          <li key={step.title} className="flex items-start gap-4">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gilt/40 bg-gilt/15">
              <step.icon className="h-5 w-5 text-gilt-bright" strokeWidth={1.7} />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gilt text-[11px] font-bold text-ink">
                {index + 1}
              </span>
            </span>
            <span>
              <span className="block font-medium">{step.title}</span>
              <span className="block text-sm font-light text-ivory-muted">{step.note}</span>
            </span>
          </li>
        ))}
      </ol>

      {webAppUrl ? (
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href={webAppUrl} className="btn-gold flex-1">
            Open the Partner App
            <ExternalLink className="h-4 w-4" />
          </a>
          <button type="button" onClick={copyLink} className="btn-ghost">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      ) : (
        <p className="mt-7 rounded-2xl border border-gilt/40 bg-black/25 p-4 text-sm font-light text-ivory-soft">
          The iPhone link is not set up yet. Add it in the Super Admin panel under Settings → App downloads.
        </p>
      )}
    </div>
  );
}

const btnClass = (dimmed: boolean) => `btn-gold relative !rounded-2xl !py-5 ${dimmed ? 'opacity-70' : ''}`;

/** Shown in place of a download when the Android link cannot be used. */
function DownloadError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mt-5 rounded-2xl border border-gilt/40 bg-black/30 p-4 text-left">
      <p className="flex items-center gap-2 font-medium text-gilt-bright">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {title}
      </p>
      <p className="mt-1 text-sm font-light text-ivory-soft/90">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost mt-3 !py-2 text-sm">
          <RotateCw className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}

export default function Download() {
  const appLinks = useAppLinks();
  // Android: exactly the link set in the Super Admin panel, once it has loaded.
  const android: AppLink | null = appLinks.status === 'ready' ? appLinks.links.android : null;
  const androidReady = !!android?.url;
  const androidStore = android?.type === 'STORE';
  // iOS: the panel's link, or the web app address from this site's settings meanwhile.
  const ios: AppLink = appLinks.status === 'ready' ? appLinks.links.ios : { url: PARTNER_WEB_URL, type: 'DIRECT' };
  const iosStore = ios.type === 'STORE' && !!ios.url;

  const [device, setDevice] = useState<Device>('other');
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const detected = detectDevice();
    setDevice(detected);
    if (detected === 'ios') setShowIos(true);
  }, []);
  // An App Store link replaces the home-screen guide.
  const showGuide = showIos && !iosStore;

  const openIosGuide = () => {
    setShowIos(true);
    // Wait for the guide to render before bringing it into view.
    window.setTimeout(() => document.getElementById('ios-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const yourDevice = (
    <span className="absolute -top-2.5 right-5 rounded-full bg-ivory px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink">
      Your device
    </span>
  );

  const androidLabel = (
    <span className="text-left leading-tight">
      <span className="block text-xs font-medium opacity-70">{androidStore ? 'Get it on' : 'Download for'}</span>
      <span className="block text-lg">{androidStore ? 'Google Play' : 'Android'}</span>
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
          {androidReady ? (
            <a
              href={android!.url!}
              {...(androidStore ? { target: '_blank', rel: 'noopener noreferrer' } : { download: '' })}
              className={btnClass(device === 'ios')}
            >
              {device === 'android' && yourDevice}
              {androidStore ? <Play className="h-6 w-6" /> : <DownloadIcon className="h-6 w-6" />}
              {androidLabel}
            </a>
          ) : (
            <button type="button" disabled aria-disabled className={`${btnClass(true)} cursor-not-allowed`}>
              {device === 'android' && yourDevice}
              {appLinks.status === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : <DownloadIcon className="h-6 w-6" />}
              <span className="text-left leading-tight">
                <span className="block text-xs font-medium opacity-70">{appLinks.status === 'loading' ? 'Getting the link…' : 'Download for'}</span>
                <span className="block text-lg">Android</span>
              </span>
            </button>
          )}
          {iosStore ? (
            <a href={ios.url!} target="_blank" rel="noopener noreferrer" className={btnClass(device === 'android')}>
              {device === 'ios' && yourDevice}
              <Apple className="h-6 w-6" />
              <span className="text-left leading-tight">
                <span className="block text-xs font-medium opacity-70">Download on the</span>
                <span className="block text-lg">App Store</span>
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={openIosGuide}
              aria-expanded={showGuide}
              aria-controls="ios-guide"
              className={btnClass(device === 'android')}
            >
              {device === 'ios' && yourDevice}
              <Apple className="h-6 w-6" />
              <span className="text-left leading-tight">
                <span className="block text-xs font-medium opacity-70">Download for</span>
                <span className="block text-lg">iOS</span>
              </span>
            </button>
          )}
        </div>

        {appLinks.status === 'error' ? (
          <DownloadError title="Android download unavailable" message={appLinks.reason} onRetry={appLinks.retry} />
        ) : appLinks.status === 'ready' && !androidReady ? (
          <DownloadError
            title="Android download coming soon"
            message="The Android app is not available to download yet. Please check back soon."
          />
        ) : androidReady && !androidStore ? (
          // <p className="mt-5 text-sm font-light text-ivory-muted">
          //   Android: open the downloaded file to install. If your phone asks, allow installs from your browser.
          // </p>
          <></>
        ) : null}

        {showGuide && <IosGuide webAppUrl={ios.url} />}
      </main>
    </div>
  );
}
