import { GiftContest } from '../components/GiftContest';
import { LiveCounter } from '../components/LiveCounter';
import { Reveal } from '../components/Reveal';
import Download from './Download';

/** The download page with the referral contest above the buttons and the live partner count below. */
export default function StudentsDownload() {
  return (
    <Download
      aboveButtons={
        <div className="mt-10">
          <GiftContest compact />
        </div>
      }
    >
      <Reveal className="mt-12">
        <LiveCounter />
      </Reveal>
    </Download>
  );
}
