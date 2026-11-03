import { HandCoins, Info, Landmark, Receipt, Repeat, Sparkles, UserPlus, Users, Wallet, WalletCards, type LucideIcon } from 'lucide-react';
import { Reveal } from '../../components/Reveal';
import { SectionHeading } from '../../components/SectionHeading';

interface Slab {
  icon: LucideIcon;
  title: string;
  body: string;
}

interface Group {
  label: string;
  title: string;
  slabs: Slab[];
}

const GROUPS: Group[] = [
  {
    label: 'Partner bills',
    title: 'When a partner shops',
    slabs: [
      {
        icon: Sparkles,
        title: 'First bill discount',
        body: 'Taken off a partner’s very first bill at your outlet. A bigger welcome offer brings new partners through the door.',
      },
      {
        icon: Repeat,
        title: 'Repeat bill discount',
        body: 'Taken off every later bill of the same partner, so they keep coming back.',
      },
      {
        icon: Wallet,
        title: 'Cashback',
        body: 'A share of each repeat bill, added to the partner’s wallet to spend on a later visit. There is no cashback on a partner’s first bill.',
      },
    ],
  },
  {
    label: 'Referral bills',
    title: 'When a partner sends a friend',
    slabs: [
      {
        icon: UserPlus,
        title: 'Referred guest discount',
        body: 'Taken off the bill of a guest who shows a partner’s Referral QR. You get a new customer; they get a saving.',
      },
      {
        icon: Users,
        title: 'Referring partner reward',
        body: 'A share of the guest’s bill, added to the wallet of the partner who sent them, as a thank-you for the introduction.',
      },
    ],
  },
  {
    label: 'Service charge and tax',
    title: 'Added after the discount',
    slabs: [
      {
        icon: HandCoins,
        title: 'Service charge',
        body: 'Optional. Either a percentage of the bill or a fixed amount in rupees per bill. Leave it at 0 and it never appears on the bill.',
      },
      {
        icon: Landmark,
        title: 'GST',
        body: 'The tax rate your outlet charges. It is worked out on the discounted amount plus any service charge.',
      },
    ],
  },
];

const RULES = [
  'A discount is never more than half of the bill.',
  'The order is always the same: discount first, then service charge, then GST.',
  'Points, cashback and rewards are worked out on the discounted bill, never on the service charge or GST.',
  'A change to a slab applies from the next bill. Bills already completed are never changed.',
  'Every change is recorded with the date, so you can always see what was set and when.',
];

export function OutletSlabs() {
  return (
    <section id="slabs" className="canvas-fill relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(224,69,63,0.3)_0%,transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-stage px-5 sm:px-8">
        <SectionHeading
          chapter="02"
          eyebrow="Your slabs, explained"
          title={
            <>
              Every number on your bill, <span className="text-gilt-gradient">in plain words</span>
            </>
          }
          lead="“Slabs” are the percentages your outlet offers to partners. You can see them all on the Slabs tab. Here is what each one means for the customer and for you."
        />

        <div className="mt-20 space-y-14">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <Reveal className="flex items-center gap-3">
                <span className="h-px w-8 bg-gilt/60" />
                <p className="eyebrow">{group.label}</p>
                <span className="text-sm font-light text-ivory-muted">· {group.title}</span>
              </Reveal>
              <div className={`mt-6 grid gap-6 ${group.slabs.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                {group.slabs.map((slab, index) => (
                  <Reveal key={slab.title} delay={index * 110}>
                    <article className="glass h-full rounded-[2rem] p-7">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gilt/40 bg-gilt/15">
                        <slab.icon className="h-6 w-6 text-gilt-bright" strokeWidth={1.6} />
                      </span>
                      <h3 className="mt-5 text-xl font-semibold">{slab.title}</h3>
                      <p className="mt-3 font-light leading-relaxed text-ivory-soft/90">{slab.body}</p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Wallet redeem bills: the one bill with no discount. */}
        <Reveal className="mt-14">
          <div className="gilt-frame rounded-[2rem] shadow-[0_0_60px_-18px_rgba(245,197,66,0.55)]">
            <div className="relative grid items-center gap-8 overflow-hidden rounded-[1.9rem] bg-gradient-to-br from-canvas to-canvas-night p-7 sm:p-10 lg:grid-cols-[auto_1fr]">
              <span className="gilt-frame mx-auto h-24 w-24 rounded-3xl">
                <span className="flex h-full w-full items-center justify-center rounded-[1.4rem] bg-canvas-deep">
                  <WalletCards className="h-11 w-11 text-gilt-bright" strokeWidth={1.4} />
                </span>
              </span>
              <div>
                <p className="eyebrow">Wallet redeem bills</p>
                <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">When a partner pays with their rewards</h3>
                <p className="mt-3 max-w-3xl font-light leading-relaxed text-ivory-soft/90">
                  A partner can show a <span className="font-medium text-ivory">Redeem QR</span> from their wallet instead of a
                  discount QR. Scan it and type the bill amount as usual. The app works out how much comes from their wallet (at
                  most half of the bill) and how much you collect from them. There is no discount and no new reward on this bill,
                  and whatever is left in their wallet stays there for next time.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-6">
          <div className="panel rounded-[2rem] p-7 sm:p-10">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-gilt" />
              <p className="eyebrow">Good to know</p>
            </div>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {RULES.map((rule) => (
                <li key={rule} className="flex gap-3 font-light leading-relaxed text-ivory-soft/90">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gilt" />
                  {rule}
                </li>
              ))}
            </ul>
            <p className="mt-8 flex gap-3 rounded-2xl border border-gilt/30 bg-black/20 p-4 text-sm font-light leading-relaxed text-ivory-soft/90">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-gilt" />
              Whether you can change these numbers yourself is set by the Lot More Wins team for each outlet. If the Slabs tab does
              not let you edit them, contact the team and they will update them for you.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
