import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Apple, ArrowLeft, Check, Copy, Download as DownloadIcon, ExternalLink, Share, Smartphone, SquarePlus, type LucideIcon } from 'lucide-react';
import { Logo, Wordmark } from '../components/Brand';
import { ANDROID_APK_URL, APK_FILE_NAME, PARTNER_WEB_URL, detectDevice, type Device } from '../lib/config';

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
function IosGuide() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!PARTNER_WEB_URL) return;
    try {
      await navigator.clipboard.writeText(PARTNER_WEB_URL);
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

      {PARTNER_WEB_URL ? (
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href={PARTNER_WEB_URL} className="btn-gold flex-1">
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
          The web app link is not set up yet. Set <code className="font-medium text-gilt-bright">VITE_PARTNER_WEB_URL</code> for this site.
        </p>
      )}
    </div>
  );
}

export default function Download() {
  const [device, setDevice] = useState<Device>('other');
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const detected = detectDevice();
    setDevice(detected);
    if (detected === 'ios') setShowIos(true);
  }, []);

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

      <main className="relative mx-auto max-w-xl px-5 pb-20 pt-8 text-center sm:px-8 sm:pt-12">
        <Logo className="mx-auto h-32 w-32 sm:h-40 sm:w-40" halo />
        <h1 className="mt-9 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Download the
          <br />
          <span className="text-gilt-gradient">Partner App</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg font-light leading-relaxed text-ivory-soft/90">
          Save at every Lot More outlet, share your referral QR and watch your reward points grow in your wallet.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            href={ANDROID_APK_URL}
            download={APK_FILE_NAME}
            className={`btn-gold relative !rounded-2xl !py-5 ${device === 'ios' ? 'opacity-70' : ''}`}
          >
            {device === 'android' && yourDevice}
            <DownloadIcon className="h-6 w-6" />
            <span className="text-left leading-tight">
              <span className="block text-xs font-medium opacity-70">Download for</span>
              <span className="block text-lg">Android</span>
            </span>
          </a>
          <button
            type="button"
            onClick={openIosGuide}
            aria-expanded={showIos}
            aria-controls="ios-guide"
            className={`btn-gold relative !rounded-2xl !py-5 ${device === 'android' ? 'opacity-70' : ''}`}
          >
            {device === 'ios' && yourDevice}
            <Apple className="h-6 w-6" />
            <span className="text-left leading-tight">
              <span className="block text-xs font-medium opacity-70">Download for</span>
              <span className="block text-lg">iOS</span>
            </span>
          </button>
        </div>

        <p className="mt-5 text-sm font-light text-ivory-muted">
          Android: open the downloaded file to install. If your phone asks, allow installs from your browser.
        </p>

        {showIos && <IosGuide />}
      </main>
    </div>
  );
}
