import { PhoneFrame } from '../components/PhoneFrame';
import { Reveal } from '../components/Reveal';
import { SectionHeading } from '../components/SectionHeading';

interface Screen {
  src: string;
  alt: string;
  title: string;
  caption: string;
  /** Desktop pose: the side phones sit lower and tilt towards the centre. */
  pose: string;
}

const SCREENS: Screen[] = [
  {
    src: '/screens/referral.webp',
    alt: 'Referral QR screen with Download QR and Share QR buttons',
    title: 'Referral QR',
    caption: 'Your code, ready to share or download.',
    pose: 'lg:translate-y-12 lg:-rotate-6',
  },
  {
    src: '/screens/home.webp',
    alt: 'Home screen with both QR codes, referral progress and outlets',
    title: 'Home',
    caption: 'Both QR codes, your referral progress and every outlet.',
    pose: 'lg:z-10 lg:scale-110',
  },
  {
    src: '/screens/wallet.webp',
    alt: 'Wallet screen with total points, purchase and referral points and Redeem QR',
    title: 'Wallet',
    caption: 'Total points, their value and your full history.',
    pose: 'lg:translate-y-12 lg:rotate-6',
  },
];

export function Screens() {
  return (
    <section id="screens" className="relative overflow-hidden bg-canvas-deep py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(176,30,30,0.5)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <SectionHeading
          chapter="03"
          eyebrow="Inside the app"
          title={
            <>
              Three screens. <span className="text-gilt-gradient">Everything you need.</span>
            </>
          }
          lead="No menus to dig through. Your codes, your progress and your points are each one tap away."
        />
      </div>

      {/* Phones: a snap-scrolling row on phones and tablets, a fanned trio on desktop. */}
      <div className="relative mt-16 flex snap-x snap-mandatory gap-6 overflow-x-auto px-[12vw] pb-10 [scrollbar-width:none] sm:px-[25vw] lg:mx-auto lg:max-w-5xl lg:items-start lg:justify-center lg:gap-12 lg:overflow-visible lg:px-8 lg:pb-0 lg:pt-10 [&::-webkit-scrollbar]:hidden">
        {SCREENS.map((screen, index) => (
          <Reveal key={screen.title} delay={index * 150} className="w-[76vw] max-w-[17rem] shrink-0 snap-center lg:w-64">
            <figure>
              <PhoneFrame
                src={screen.src}
                alt={screen.alt}
                className={`transition-transform duration-500 ease-out hover:!translate-y-0 hover:!rotate-0 ${screen.pose}`}
              />
              <figcaption className="mt-6 text-center lg:mt-24">
                <p className="text-lg font-semibold text-gilt-bright">{screen.title}</p>
                <p className="mx-auto mt-1 max-w-[15rem] text-sm font-light leading-relaxed text-ivory-muted">{screen.caption}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
