import { Nav } from '../components/Nav';
import { DownloadCta, Footer } from '../sections/DownloadCta';
import { Earn } from '../sections/Earn';
import { Hero } from '../sections/Hero';
import { HowItWorks } from '../sections/HowItWorks';
import { Screens } from '../sections/Screens';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Earn />
        <Screens />
        <DownloadCta />
      </main>
      <Footer />
    </>
  );
}
