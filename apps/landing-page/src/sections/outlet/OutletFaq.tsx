import { ChevronDown } from 'lucide-react';
import { Reveal } from '../../components/Reveal';
import { SectionHeading } from '../../components/SectionHeading';

const FAQS: [string, string][] = [
  [
    'Who can use the Outlet Admin app?',
    'Only outlets that are part of the Lot More Wins programme. There is no sign-up inside the app: the Lot More Wins team creates your outlet and gives you the email address and password to sign in.',
  ],
  [
    'Does it cost anything?',
    'No. The app is free to download and free to use for participating outlets.',
  ],
  [
    'Can more than one phone use the same login?',
    'Yes. Sign in on each billing phone with your outlet’s login. Every bill is saved to your outlet, whichever phone it was made on.',
  ],
  [
    'I forgot the password. What do I do?',
    'Contact the Lot More Wins team. They can set a new password for your outlet login.',
  ],
  [
    'The camera does not read the QR code.',
    'Wipe the camera lens, hold the phone steady about a hand’s length away, and make sure the customer’s screen brightness is up. If it still does not scan, tap Enter code and type the code shown under the QR.',
  ],
  [
    'It says the QR code has expired or was already used.',
    'Redeem QR codes from the partner’s wallet can be used only once and only for a short time. Ask the partner to open their wallet and show a new one.',
  ],
  [
    'Do I need to work out the discount or tax myself?',
    'No. Type the bill amount and the app does the rest, using your outlet’s slabs. The amount to collect is shown on the button you tap to complete the bill.',
  ],
  [
    'What if the internet drops while I complete a bill?',
    'Tap Complete bill again once you are back online. The app makes sure the same bill is never saved twice.',
  ],
  [
    'A bill was entered with the wrong amount.',
    'Contact the Lot More Wins team with the bill details from your History tab. They can correct it, and the partner’s wallet is adjusted to match.',
  ],
  [
    'Does the app need internet?',
    'Yes. Every bill is checked and saved online, so the partner’s rewards are always correct. Mobile data or Wi-Fi both work.',
  ],
];

export function OutletFaq() {
  return (
    <section id="faq" className="canvas-fill relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute -right-40 top-20 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(245,197,66,0.1)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <SectionHeading
          chapter="04"
          eyebrow="Questions"
          title={
            <>
              Answers for <span className="text-gilt-gradient">your counter staff</span>
            </>
          }
          lead="The questions outlets ask us most, answered in a line or two."
        />

        <div className="mx-auto mt-16 max-w-3xl space-y-4">
          {FAQS.map(([question, answer], index) => (
            <Reveal key={question} delay={Math.min(index, 4) * 60}>
              <details className="glass group rounded-2xl px-6 py-5 open:bg-white/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  {question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-gilt transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="mt-3 font-light leading-relaxed text-ivory-soft/90">{answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
