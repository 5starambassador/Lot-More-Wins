import { LiveCounter } from '../components/LiveCounter';
import { ReferralGift } from '../components/ReferralGift';
import { Reveal } from '../components/Reveal';
import Download from './Download';

/** The download page with the referral prize above the buttons and the live partner count below. */
export default function StudentsDownload() {
  return (
    <Download
      aboveButtons={
        <Reveal className="mt-10">
          <ReferralGift />
        </Reveal>
      }
    >
      <Reveal className="mt-12">
        <LiveCounter />
      </Reveal>
    </Download>
  );
}
