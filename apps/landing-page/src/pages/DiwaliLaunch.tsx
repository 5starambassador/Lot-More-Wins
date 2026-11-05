import { Nav } from '../components/Nav';
import { DiwaliCta } from '../sections/DiwaliCta';
import { Footer } from '../sections/DownloadCta';
import { Earn } from '../sections/Earn';
import { Hero } from '../sections/Hero';
import { HowItWorks } from '../sections/HowItWorks';
import { Screens } from '../sections/Screens';

/** The home page for the Diwali launch: its download links and QR code lead to /students-download. */
export default function DiwaliLaunch() {
  return (
    <>
      <Nav cta={{ href: '/students-download', label: 'Download' }} />
      <main>
        <Hero downloadHref="/students-download" />
        <HowItWorks />
        <Earn />
        <Screens />
        <DiwaliCta />
      </main>
      <Footer />
    </>
  );
}
