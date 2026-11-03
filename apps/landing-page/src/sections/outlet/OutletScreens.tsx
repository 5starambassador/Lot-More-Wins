import { Check } from 'lucide-react';
import { PhoneFrame } from '../../components/PhoneFrame';
import { Reveal } from '../../components/Reveal';
import { SectionHeading } from '../../components/SectionHeading';
import { OUTLET_SCREEN_SIZE } from './screens';

interface Screen {
  src: string;
  alt: string;
  tab: string;
  title: string;
  body: string;
  points: string[];
}

const SCREENS: Screen[] = [
  {
    src: '/screens/outlet/scan.webp',
    alt: 'Scan tab: Scan, Bill and Done steps, with Camera scan and Enter code',
    tab: 'Scan tab',
    title: 'Where every bill starts',
    body: 'The app opens here. The bar at the top shows where you are: Scan, then Bill, then Done.',
    points: [
      'Camera scan reads the customer’s QR code in a second.',
      'Enter code lets you type the code by hand if the camera cannot read it.',
      'The first time, tap Allow camera so the app can use the camera for scanning.',
    ],
  },
  {
    src: '/screens/outlet/history.webp',
    alt: 'History tab: today’s bills, money collected and discount given',
    tab: 'History tab',
    title: 'Your day at a glance',
    body: 'See how the day is going without adding anything up yourself.',
    points: [
      'Today shows the number of bills, the money collected and the discount given.',
      'All bills lists every bill your outlet has completed.',
      'Tap any bill to see its full breakdown, line by line.',
    ],
  },
  {
    src: '/screens/outlet/offers.webp',
    alt: 'Slabs tab: first bill, repeat bill, cashback, referred guest and referring partner percentages',
    tab: 'Slabs tab',
    title: 'Your outlet’s offers',
    body: 'Every percentage your outlet gives partners, in one list, with a short note under each one.',
    points: [
      'Partner bills: first bill discount, repeat bill discount and cashback.',
      'Referral bills: the guest’s discount and the referring partner’s reward.',
      'Service charge and GST, with an example bill that updates as you type.',
    ],
  },
  {
    src: '/screens/outlet/profile.webp',
    alt: 'Outlet tab: outlet logo, name, email and mobile number',
    tab: 'Outlet tab',
    title: 'How partners see you',
    body: 'Partners find your outlet in their app using these details, so keep them up to date.',
    points: [
      'Change the outlet name, email, mobile number and description.',
      'Tap the camera on the logo to pick a new one from your photos.',
      'Tap Save profile and partners see the change straight away.',
    ],
  },
  {
    src: '/screens/outlet/photos.webp',
    alt: 'Outlet tab: address, map link, outlet photos and sign out',
    tab: 'Outlet tab',
    title: 'Show off your outlet',
    body: 'Good photos and a map link help partners choose you and find you.',
    points: [
      'Add up to 12 photos of your outlet from the phone’s gallery.',
      'Add your address and a Google Maps link for directions.',
      'Sign out here when the phone is handed to someone else.',
    ],
  },
];

export function OutletScreens() {
  return (
    <section id="screens" className="relative overflow-hidden bg-canvas-deep py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(176,30,30,0.5)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <SectionHeading
          chapter="03"
          eyebrow="Inside the app"
          title={
            <>
              Four tabs. <span className="text-gilt-gradient">Every screen explained.</span>
            </>
          }
          lead="Scan, History, Slabs and Outlet sit along the bottom of the app. Here is what each one is for."
        />

        <ol className="mt-20 space-y-20 lg:space-y-28">
          {SCREENS.map((screen, index) => {
            const flipped = index % 2 === 1;
            return (
              <li key={screen.src} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
                <Reveal className={`mx-auto w-full max-w-[16rem] sm:max-w-[18rem] ${flipped ? 'lg:order-2' : ''}`}>
                  <PhoneFrame
                    src={screen.src}
                    alt={screen.alt}
                    className={`transition-transform duration-500 ease-out hover:!rotate-0 ${flipped ? 'lg:rotate-3' : 'lg:-rotate-3'}`}
                    {...OUTLET_SCREEN_SIZE}
                  />
                </Reveal>
                <Reveal delay={140} className={flipped ? 'lg:order-1' : ''}>
                  <p className="eyebrow">
                    {String(index + 1).padStart(2, '0')} · {screen.tab}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold leading-snug sm:text-[2rem]">{screen.title}</h3>
                  <p className="mt-4 max-w-lg font-light leading-relaxed text-ivory-soft/90">{screen.body}</p>
                  <ul className="mt-6 space-y-3">
                    {screen.points.map((point) => (
                      <li key={point} className="flex gap-3 font-light leading-relaxed text-ivory-soft/90">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gilt/40 bg-gilt/15">
                          <Check className="h-3.5 w-3.5 text-gilt-bright" strokeWidth={2.4} />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
