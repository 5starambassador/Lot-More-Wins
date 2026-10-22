import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '../components/Brand';
import { Footer } from '../sections/DownloadCta';

const EFFECTIVE_DATE = '22 October 2026';
const LAST_UPDATED = '22 October 2026';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-white/10 pt-8">
      <h2 className="text-xl font-semibold tracking-tight text-ivory sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 pt-2">
      <h3 className="font-semibold text-gilt-bright">{title}</h3>
      {children}
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-gilt">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

const SECTIONS = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'scope', title: '2. Scope of This Policy' },
  { id: 'information-we-collect', title: '3. Personal Information We Collect' },
  { id: 'how-we-use', title: '4. How We Use Your Information' },
  { id: 'referrals', title: '5. Referral Programme and Information Sharing' },
  { id: 'wallet', title: '6. Wallet, Rewards and Gift Cards' },
  { id: 'sharing', title: '7. Sharing of Personal Information' },
  { id: 'cookies', title: '8. Cookies and Similar Technologies' },
  { id: 'security', title: '9. Data Security' },
  { id: 'retention', title: '10. Data Retention and Deletion' },
  { id: 'rights', title: '11. Your Privacy Rights' },
  { id: 'children', title: "12. Children's Privacy" },
  { id: 'third-parties', title: '13. Third-Party Websites and Services' },
  { id: 'international', title: '14. International Data Transfers' },
  { id: 'marketing', title: '15. Marketing Communications and Preferences' },
  { id: 'changes', title: '16. Changes to This Privacy Policy' },
  { id: 'contact', title: '17. Contact and Grievance Redressal' },
  { id: 'governing-law', title: '18. Governing Law' },
] as const;

const title = (id: (typeof SECTIONS)[number]['id']) => SECTIONS.find((s) => s.id === id)!.title;

const USES: [string, string][] = [
  ['Account registration', 'To create, authenticate and manage Partner and Merchant accounts.'],
  ['Programme administration', 'To provide eligible discounts, rewards, membership benefits and participating Merchant services.'],
  ['Referral management', 'To attribute referrals, validate eligibility and calculate applicable rewards.'],
  ['Wallet administration', 'To maintain wallet records and process eligible credits, debits and redemptions.'],
  ['Gift card services', 'To issue, validate, transfer where supported, and redeem eligible gift cards.'],
  ['Merchant operations', 'To manage participating outlets, offers, transactions and programme administration.'],
  ['Customer support', 'To respond to enquiries, investigate complaints and resolve disputes.'],
  ['Security and fraud prevention', 'To detect suspicious activity, unauthorised transactions, fraudulent referrals and misuse of the Platform.'],
  ['Service improvement', 'To understand usage patterns, troubleshoot technical problems and improve the user experience.'],
  ['Communications', 'To send registration confirmations, transaction notifications, service updates and important policy changes.'],
  ['Marketing', 'To send promotional messages, offers and updates where permitted by law and subject to applicable consent and opt-out requirements.'],
  ['Legal compliance', 'To comply with applicable laws, lawful requests, recordkeeping obligations and the establishment or defence of legal claims.'],
];

const CONTACT: [string, string][] = [
  ['Operating Legal Entity', '[Insert registered company or legal entity name]'],
  ['Registered Address', '[Insert complete registered address]'],
  ['Email', '[Insert official privacy or grievance email address]'],
  ['Phone', '[Insert official contact number]'],
  ['Grievance Officer', "[Insert designated officer's name or title, where applicable]"],
];

export default function PrivacyPolicy() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Privacy Policy | Lot More Wins';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="canvas-fill relative min-h-screen">
      <header className="relative mx-auto flex h-[4.5rem] max-w-stage items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 text-sm text-ivory-soft/80 transition-colors hover:text-gilt-bright">
          <ArrowLeft className="h-4 w-4" />
          Back to overview
        </Link>
        <Wordmark />
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-20 pt-8 sm:px-8">
        <p className="eyebrow">LotMore Wins</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          <span className="text-gilt-gradient">Privacy Policy</span>
        </h1>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-1 text-sm font-light text-ivory-muted">
          <div className="flex gap-2">
            <dt>Effective Date:</dt>
            <dd className="text-ivory-soft">{EFFECTIVE_DATE}</dd>
          </div>
          <div className="flex gap-2">
            <dt>Last Updated:</dt>
            <dd className="text-ivory-soft">{LAST_UPDATED}</dd>
          </div>
        </dl>

        <nav aria-label="Contents" className="panel mt-10 rounded-3xl p-6 sm:p-8">
          <p className="eyebrow">Contents</p>
          <ol className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-ivory-soft/80 transition-colors hover:text-gilt-bright">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-10 font-light leading-relaxed text-ivory-soft/90">
          <Section id="introduction" title={title('introduction')}>
            <P>Welcome to LotMore Wins (“we”, “our”, “us” or the “Platform”).</P>
            <P>
              LotMore Wins is a rewards and benefits platform designed to connect Partners with participating Merchants, enabling
              eligible users to access discounts, referral benefits, wallet rewards and gift card facilities in accordance with the
              applicable programme terms.
            </P>
            <P>
              We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we
              collect, use, store, disclose and protect your information when you visit our website, use our mobile application,
              register as a Partner or Merchant, participate in referral programmes, or access our services.
            </P>
            <P>
              By using LotMore Wins, you acknowledge that you have read this Privacy Policy. Where consent is legally required, we will
              seek your consent before processing your personal information for the relevant purposes.
            </P>
          </Section>

          <Section id="scope" title={title('scope')}>
            <P>This Privacy Policy applies to:</P>
            <Bullets
              items={[
                'Visitors to the LotMore Wins website.',
                'Registered Partners, including eligible parents, teachers, students and other users.',
                'Registered Merchants and their authorised representatives.',
                'Users who participate in referral programmes.',
                'Users who receive, purchase, transfer or redeem eligible gift cards.',
                'Individuals who contact us for support, enquiries or complaints.',
              ]}
            />
            <P>
              This Policy should be read alongside our Terms and Conditions, Referral Programme Terms, Wallet and Rewards Terms, and
              Gift Card Terms, wherever applicable.
            </P>
          </Section>

          <Section id="information-we-collect" title={title('information-we-collect')}>
            <P>Depending on how you use LotMore Wins, we may collect the following categories of information.</P>
            <Sub title="3.1 Personal and Contact Information">
              <P>When you register or use our services, we may collect:</P>
              <Bullets
                items={[
                  'Full name.',
                  'Mobile number.',
                  'Email address.',
                  'Age or date of birth, where necessary.',
                  'Residential address or general location, where required for a specific service.',
                  'Parent or guardian details, where applicable.',
                ]}
              />
            </Sub>
            <Sub title="3.2 Account and Registration Information">
              <P>We may collect information relating to your account, such as:</P>
              <Bullets
                items={[
                  'User ID or membership number.',
                  'Registration date and account status.',
                  'Partner or Merchant classification.',
                  'Referral code and referral relationships.',
                  'Membership tier and eligibility status.',
                  'Account preferences and communication preferences.',
                ]}
              />
            </Sub>
            <Sub title="3.3 Transaction, Wallet and Rewards Information">
              <P>To administer the LotMore Wins programme, we may process:</P>
              <Bullets
                items={[
                  'Eligible purchase and billing details.',
                  'Merchant name and outlet location.',
                  'Applicable discounts and benefits redeemed.',
                  'Wallet balances, credits, debits and redemption history.',
                  'Referral-related reward records.',
                  'Gift card issuance, transfer and redemption records.',
                  'Transaction references and records required to investigate disputes or prevent misuse.',
                ]}
              />
              <P>We aim to collect only the information reasonably necessary to provide and administer the relevant services.</P>
            </Sub>
            <Sub title="3.4 Merchant Information">
              <P>For Merchant registration and account administration, we may collect:</P>
              <Bullets
                items={[
                  'Business or outlet name.',
                  'Business address and contact details.',
                  'Details of an authorised representative.',
                  'Business registration or verification documents, where necessary.',
                  'Merchant offers, discount structures and participation details.',
                  'Settlement or payment information, if required for the relevant service.',
                ]}
              />
            </Sub>
            <Sub title="3.5 Technical and Usage Information">
              <P>
                When you visit our website or use our application, certain technical information may be collected, where enabled,
                including:
              </P>
              <Bullets
                items={[
                  'IP address and device identifiers.',
                  'Browser, operating system and application version.',
                  'Login timestamps and session information.',
                  'Pages viewed and application features used.',
                  'Diagnostic, security and error logs.',
                  'Cookie and similar technology information, subject to applicable requirements and your preferences.',
                ]}
              />
            </Sub>
            <Sub title="3.6 Customer Support Information">
              <P>
                If you contact us, we may collect the details you provide, including your enquiry, complaint, correspondence,
                supporting documents and information needed to resolve your request.
              </P>
            </Sub>
          </Section>

          <Section id="how-we-use" title={title('how-we-use')}>
            <P>We may use your personal information for the following purposes:</P>
            <ol className="list-decimal space-y-1.5 pl-6 marker:text-gilt">
              {USES.map(([label, text]) => (
                <li key={label}>
                  <span className="font-medium text-ivory">{label}:</span> {text}
                </li>
              ))}
            </ol>
            <P>
              We will not use personal information for purposes incompatible with the purpose for which it was collected without an
              appropriate lawful basis.
            </P>
          </Section>

          <Section id="referrals" title={title('referrals')}>
            <P>LotMore Wins allows eligible Partners to refer friends and family members to the Platform.</P>
            <P>
              To operate this feature, we may process referral codes, referral identifiers, registration status and qualifying
              transaction information.
            </P>
            <P>
              Where necessary, limited information may be made available to the referring Partner to confirm referral eligibility or
              explain an applicable reward. We will not disclose another user's full transaction history, contact details or other
              unrelated personal information merely because a referral relationship exists.
            </P>
            <P>
              Please refer friends or family members only in a lawful and appropriate manner. Do not submit another person's personal
              information without the necessary authority or permission.
            </P>
            <P>Referral benefits are subject to the applicable Referral Programme Terms.</P>
          </Section>

          <Section id="wallet" title={title('wallet')}>
            <P>
              LotMore Wins may maintain records relating to eligible wallet benefits, discounts, gift cards and redemption activity.
            </P>
            <P>We use these records to:</P>
            <Bullets
              items={[
                'Display or administer available benefits.',
                'Validate eligible transactions.',
                'Apply programme limits and redemption conditions.',
                'Prevent duplicate claims and fraudulent activity.',
                'Investigate discrepancies and resolve disputes.',
              ]}
            />
            <P>
              Wallet balances, reward credits, gift cards and discounts are governed by the applicable programme terms. The existence
              of a wallet record does not, by itself, mean that the balance is a bank deposit or that it can be withdrawn or
              transferred as cash.
            </P>
            <P>
              Any wallet transfer, gift card transfer or redemption will be supported only where the relevant feature is available and
              permitted under the applicable terms and law.
            </P>
          </Section>

          <Section id="sharing" title={title('sharing')}>
            <P>We do not sell personal information as a standalone commercial product.</P>
            <P>
              We may share relevant personal information with the following categories of recipients where necessary and lawful:
            </P>
            <Sub title="7.1 Participating Merchants">
              <P>
                We may share limited transaction, eligibility or redemption information with a participating Merchant to validate an
                eligible discount, reward or gift card.
              </P>
            </Sub>
            <Sub title="7.2 Technology and Service Providers">
              <P>
                We may engage service providers that support application hosting, cloud storage, customer support, analytics,
                communication delivery, security, identity verification and technical maintenance.
              </P>
              <P>
                These providers should be permitted to process personal information only for authorised purposes and subject to
                appropriate safeguards.
              </P>
            </Sub>
            <Sub title="7.3 Payment and Transaction Service Providers">
              <P>
                Where payment or settlement functionality is available, relevant information may be shared with payment gateways,
                banks or other authorised service providers to complete or reconcile transactions.
              </P>
            </Sub>
            <Sub title="7.4 Professional Advisers and Authorities">
              <P>
                We may disclose information to legal advisers, auditors, regulators, law enforcement agencies or other authorities when
                required or permitted by applicable law.
              </P>
            </Sub>
            <Sub title="7.5 Business Transfers">
              <P>
                If LotMore Wins or its operating business undergoes a merger, restructuring, acquisition or transfer, personal
                information may be transferred as part of that transaction, subject to applicable legal requirements and appropriate
                safeguards.
              </P>
            </Sub>
            <P>
              We do not authorise third parties receiving personal information from us to use it for unrelated purposes without an
              appropriate legal basis.
            </P>
          </Section>

          <Section id="cookies" title={title('cookies')}>
            <P>Our website may use cookies and similar technologies to:</P>
            <Bullets
              items={[
                'Maintain essential website functionality.',
                'Remember relevant preferences.',
                'Understand website performance.',
                'Improve navigation and user experience.',
                'Support analytics or advertising, where enabled and permitted.',
              ]}
            />
            <P>
              You may be able to manage cookies through your browser settings or any cookie preference mechanism provided on our
              website. Disabling certain cookies may affect website functionality.
            </P>
            <P>Where required, we will obtain consent before using non-essential cookies or similar technologies.</P>
          </Section>

          <Section id="security" title={title('security')}>
            <P>
              We take reasonable technical and organisational measures designed to protect personal information against unauthorised
              access, disclosure, alteration, loss, misuse or destruction.
            </P>
            <P>
              Depending on the nature of the information and the risks involved, safeguards may include access controls,
              authentication measures, encryption, security monitoring, restricted staff access and appropriate service-provider
              arrangements.
            </P>
            <P>
              No website, application or electronic transmission can be guaranteed to be completely secure. We will handle security
              incidents and personal data breaches in accordance with applicable legal requirements.
            </P>
          </Section>

          <Section id="retention" title={title('retention')}>
            <P>
              We retain personal information only for as long as necessary to fulfil the purposes described in this Policy, administer
              accounts and benefits, resolve disputes, prevent fraud, comply with applicable laws and meet legitimate recordkeeping
              requirements.
            </P>
            <P>
              When personal information is no longer required, we will take appropriate steps to delete it or render it
              non-identifiable, subject to applicable legal obligations and permitted exceptions.
            </P>
            <P>
              You may request deletion of your account or personal information through our designated contact channel. Account
              deletion may affect access to outstanding benefits, referral records and gift cards, subject to applicable law and the
              relevant programme terms.
            </P>
            <P>Certain information may need to be retained for a lawful period or purpose even after an account is closed.</P>
          </Section>

          <Section id="rights" title={title('rights')}>
            <P>Subject to applicable law, you may have the right to:</P>
            <Bullets
              items={[
                'Obtain information about the personal data we process about you.',
                'Request correction or updating of inaccurate or incomplete information.',
                'Request deletion of personal information where legally applicable.',
                'Withdraw consent for processing where processing is based on your consent.',
                'Raise a grievance concerning the processing of your personal information.',
                'Nominate another individual to exercise applicable rights in circumstances permitted by law.',
              ]}
            />
            <P>
              To exercise these rights, contact us using the details provided in the{' '}
              <a href="#contact" className="text-gilt underline-offset-4 hover:text-gilt-bright hover:underline">
                Contact and Grievance Redressal
              </a>{' '}
              section below.
            </P>
            <P>
              We may need to verify your identity before acting on a request. Withdrawing consent will not affect the lawfulness of
              processing undertaken before withdrawal. It may also affect our ability to provide certain features or services.
            </P>
          </Section>

          <Section id="children" title={title('children')}>
            <P>
              LotMore Wins may be used in programmes involving schoolchildren and students. We recognise the importance of protecting
              children's personal information.
            </P>
            <P>
              Where a user is a child under applicable law, we will obtain verifiable parental or lawful guardian consent before
              processing the child's personal data where required. We will apply any additional restrictions or safeguards required by
              law.
            </P>
            <P>
              We will not knowingly engage in prohibited tracking, behavioural monitoring or targeted advertising directed at children
              where such practices are prohibited by applicable law.
            </P>
            <P>
              Parents or lawful guardians may contact us to request information about a child's account, seek correction of
              information, or raise a concern regarding the child's personal data, subject to identity and authority verification.
            </P>
          </Section>

          <Section id="third-parties" title={title('third-parties')}>
            <P>Our website or application may contain links to third-party websites, Merchant pages or external services.</P>
            <P>
              These third parties may have their own privacy policies and practices. LotMore Wins is not responsible for the privacy
              practices of independent third-party websites or services that we do not control.
            </P>
            <P>We encourage users to review the relevant privacy policies before providing personal information to third parties.</P>
          </Section>

          <Section id="international" title={title('international')}>
            <P>
              If personal information is stored or processed outside India by us or our service providers, such processing will be
              subject to applicable Indian legal requirements, including any restrictions or safeguards relating to cross-border
              transfers.
            </P>
            <P>
              Details of relevant service providers and processing locations should be documented internally and disclosed where
              required by law.
            </P>
          </Section>

          <Section id="marketing" title={title('marketing')}>
            <P>
              We may send service-related communications necessary to administer your account, transactions, security alerts and
              programme benefits.
            </P>
            <P>
              Where permitted, we may also send promotional communications about participating Merchants, special offers and LotMore
              Wins services.
            </P>
            <P>
              You may opt out of promotional communications through the unsubscribe facility, where available, or by contacting us.
              Opting out of promotional communications will not necessarily stop essential service or transaction messages.
            </P>
          </Section>

          <Section id="changes" title={title('changes')}>
            <P>
              We may update this Privacy Policy from time to time to reflect changes in our services, data practices, technology or
              applicable law.
            </P>
            <P>
              The revised Policy will be published on this page with an updated “Last Updated” date. Where required, we will provide
              notice of material changes or seek fresh consent.
            </P>
            <P>We encourage users to review this page periodically.</P>
          </Section>

          <Section id="contact" title={title('contact')}>
            <P>For privacy-related questions, requests, complaints or concerns, please contact:</P>
            <div className="panel rounded-3xl p-6 sm:p-8">
              <p className="eyebrow">Privacy and Grievance Contact</p>
              <p className="mt-2 text-lg font-semibold text-ivory">LotMore Wins</p>
              <dl className="mt-4 space-y-2 text-sm">
                {CONTACT.map(([label, value]) => (
                  <div key={label} className="sm:flex sm:gap-2">
                    <dt className="font-medium text-ivory">{label}:</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <P>
              Please include your registered mobile number or user ID, a description of your request and any information reasonably
              necessary to verify your identity. Avoid including passwords, OTPs or unnecessary sensitive information in your message.
            </P>
            <P>We will acknowledge and address grievances within the timelines required by applicable law.</P>
          </Section>

          <Section id="governing-law" title={title('governing-law')}>
            <P>
              This Privacy Policy is governed by the laws of India, including applicable data protection and information technology
              legislation.
            </P>
            <P>
              Any disputes relating to this Policy will be handled in accordance with applicable Indian law and the jurisdiction of the
              competent courts, subject to any mandatory legal requirements.
            </P>
          </Section>

          <p className="border-t border-white/10 pt-8 text-center font-medium text-gilt-bright">
            LotMore Wins — More Connections. More Benefits. More Wins.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
