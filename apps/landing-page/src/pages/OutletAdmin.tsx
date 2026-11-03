import { Nav, type NavLink } from '../components/Nav';
import { useDocumentTitle } from '../components/Legal';
import { Footer } from '../sections/DownloadCta';
import { OutletBilling } from '../sections/outlet/OutletBilling';
import { OutletFaq } from '../sections/outlet/OutletFaq';
import { OutletGetApp } from '../sections/outlet/OutletGetApp';
import { OutletHero } from '../sections/outlet/OutletHero';
import { OutletScreens } from '../sections/outlet/OutletScreens';
import { OutletSlabs } from '../sections/outlet/OutletSlabs';

const LINKS: NavLink[] = [
  { href: '#how-it-works', label: 'How billing works' },
  { href: '#slabs', label: 'Your slabs' },
  { href: '#screens', label: 'The app' },
  { href: '#faq', label: 'Questions' },
];

/** /outlet-admin: presents the Outlet Admin app to outlet owners and their counter staff. */
export default function OutletAdmin() {
  useDocumentTitle('Lot More Wins Outlet Admin App');
  return (
    <>
      <Nav links={LINKS} label="Outlet Admin" cta={{ href: '#get-the-app', label: 'Get the app' }} />
      <main>
        <OutletHero />
        <OutletBilling />
        <OutletSlabs />
        <OutletScreens />
        <OutletFaq />
        <OutletGetApp />
      </main>
      <Footer
        appName="Lot More Wins Outlet Admin App"
        privacyHref="/outlet-admin/privacy-policy"
        otherApp={{ to: '/', label: 'Partner App' }}
      />
    </>
  );
}
