import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Wordmark } from '../components/Brand';
import { Bullets, P, Section, Sub, useDocumentTitle } from '../components/Legal';
import { Footer } from '../sections/DownloadCta';

const EFFECTIVE_DATE = '3 November 2026';
const LAST_UPDATED = '3 November 2026';

const SECTIONS = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'who-uses', title: '2. Who This Policy Covers' },
  { id: 'information-we-collect', title: '3. Information We Collect' },
  { id: 'permissions', title: '4. Device Permissions' },
  { id: 'how-we-use', title: '5. How We Use Information' },
  { id: 'sharing', title: '6. Who We Share Information With' },
  { id: 'storage-security', title: '7. Storage and Security' },
  { id: 'retention', title: '8. Retention and Account Deletion' },
  { id: 'rights', title: '9. Your Rights and Choices' },
  { id: 'children', title: '10. Children' },
  { id: 'changes', title: '11. Changes to This Policy' },
  { id: 'contact', title: '12. Contact and Grievance Redressal' },
] as const;

const title = (id: (typeof SECTIONS)[number]['id']) => SECTIONS.find((s) => s.id === id)!.title;

const AT_A_GLANCE = [
  'The app is for outlet staff only. There is no sign-up in the app: logins are created by the Lot More Wins team.',
  'The camera is used only to scan QR codes. Camera images are never saved or uploaded.',
  'Photos are uploaded only when you choose them yourself, as your outlet logo or outlet photos.',
  'We do not use your location, microphone or contacts, and we show no advertising.',
  'We do not use third-party analytics or tracking tools in the app, and we do not sell personal information.',
];

const USES: [string, string][] = [
  ['Signing in', 'To check your email and password and keep you signed in on your phone.'],
  ['Billing', 'To verify the QR code a customer shows, work out the bill using your outlet’s slabs, and save the completed bill.'],
  ['Partner rewards', 'To add points, cashback or referral rewards to the right partner’s wallet after a bill.'],
  ['Outlet listing', 'To show your outlet’s name, logo, photos, address and contact details to partners in the Partner App.'],
  ['Records and support', 'To show your billing history, correct mistakes, and answer questions from your outlet or from partners.'],
  ['Security', 'To protect accounts from misuse, for example by limiting repeated failed sign-in attempts.'],
  ['Legal duties', 'To keep accounting and tax records and to meet other legal requirements.'],
];

const CONTACT: [string, string][] = [
  ['Operating Legal Entity', '[Insert registered company or legal entity name]'],
  ['Address', '88, Candappa Mudaliyar Street, Pondicherry, Puducherry 605001'],
  ['Email', '[Insert official privacy or grievance email address]'],
  ['Phone', '[Insert official contact number]'],
  ['Grievance Officer', "[Insert designated officer's name or title, where applicable]"],
];

/** /outlet-admin/privacy-policy: privacy policy of the Outlet Admin app (com.lotmorewins.outletadmin). */
export default function OutletPrivacyPolicy() {
  useDocumentTitle('Outlet Admin App Privacy Policy | Lot More Wins');

  return (
    <div className="canvas-fill relative min-h-screen">
      <header className="relative mx-auto flex h-[4.5rem] max-w-stage items-center justify-between px-5 sm:px-8">
        <Link to="/outlet-admin" className="flex items-center gap-2 text-sm text-ivory-soft/80 transition-colors hover:text-gilt-bright">
          <ArrowLeft className="h-4 w-4" />
          Back to the Outlet Admin app
        </Link>
        <Wordmark label="Outlet Admin" />
      </header>

      <main className="relative mx-auto max-w-3xl px-5 pb-20 pt-8 sm:px-8">
        <p className="eyebrow">LotMore Wins Outlet Admin App</p>
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

        <div className="panel mt-10 rounded-3xl p-6 sm:p-8">
          <p className="eyebrow">At a glance</p>
          <ul className="mt-4 space-y-2.5 text-sm font-light leading-relaxed text-ivory-soft/90">
            {AT_A_GLANCE.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gilt" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Contents" className="panel mt-6 rounded-3xl p-6 sm:p-8">
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
            <P>
              This Privacy Policy explains how LotMore Wins (“we”, “our”, “us”) collects, uses, shares and protects information
              through the <span className="font-medium text-ivory">Lot More Wins Outlet Admin</span> mobile application (the “App”,
              Android package com.lotmorewins.outletadmin).
            </P>
            <P>
              The App is used at the billing counter of outlets that take part in the LotMore Wins programme. It lets outlet staff scan
              a partner’s QR code, complete the bill with the outlet’s discounts, service charge and GST, and manage the outlet’s
              details shown to partners.
            </P>
            <P>
              The LotMore Wins Partner App and website are covered by our separate{' '}
              <Link to="/privacy-policy" className="text-gilt underline-offset-4 hover:text-gilt-bright hover:underline">
                Privacy Policy
              </Link>
              .
            </P>
          </Section>

          <Section id="who-uses" title={title('who-uses')}>
            <P>This Policy applies to:</P>
            <Bullets
              items={[
                'Outlet owners, managers and counter staff who sign in to the App with an outlet login.',
                'Partners and their referred guests, to the extent their information is shown in or entered into the App during billing.',
              ]}
            />
            <P>
              Outlet logins are created by the LotMore Wins team for participating outlets. The App does not offer public sign-up.
            </P>
          </Section>

          <Section id="information-we-collect" title={title('information-we-collect')}>
            <Sub title="3.1 Outlet login">
              <Bullets
                items={[
                  'The email address of the outlet login.',
                  'The password, which we store only in a one-way encrypted (hashed) form that cannot be read back.',
                  'Whether the login is active.',
                ]}
              />
            </Sub>
            <Sub title="3.2 Outlet profile">
              <P>Information your outlet adds or edits in the Outlet tab, which is shown to partners:</P>
              <Bullets
                items={[
                  'Outlet name, contact email and mobile number.',
                  'Description, address and map link.',
                  'Outlet logo and up to 12 outlet photos.',
                ]}
              />
              <P>Please add only business details and photos you are happy for partners to see.</P>
            </Sub>
            <Sub title="3.3 Bills and slabs">
              <Bullets
                items={[
                  'Bill amount, discount, service charge, GST, amount collected, and the date and time of each bill.',
                  'Wallet amounts used on redeem bills, and the rewards credited to partners.',
                  'Your outlet’s slab settings (discounts, cashback, service charge, GST) and a record of each change.',
                  'Which outlet login completed each bill or change.',
                ]}
              />
            </Sub>
            <Sub title="3.4 Partner and guest information during billing">
              <P>
                When a QR code is scanned, the App shows the partner’s name, mobile number and partner code so staff can confirm who is
                being billed. For a bill made with a partner’s Referral QR, staff enter the guest’s name, mobile number and, optionally,
                email address, so the bill and the referral reward are recorded correctly.
              </P>
              <P>
                Staff should use this information only to complete the bill, and should not copy, keep or share it outside the App.
              </P>
            </Sub>
            <Sub title="3.5 Technical information">
              <Bullets
                items={[
                  'Server records of requests to our systems, such as IP address, time and errors, used for security and troubleshooting.',
                  'Records of failed sign-in attempts, used to block repeated guessing of passwords.',
                  'A sign-in key stored in the phone’s secure storage so you stay signed in. It is deleted when you sign out.',
                ]}
              />
              <P>The App does not use advertising identifiers, third-party analytics or tracking tools.</P>
            </Sub>
          </Section>

          <Section id="permissions" title={title('permissions')}>
            <Sub title="Camera">
              <P>
                Used only to scan the QR codes customers show at billing. The camera picture is read on the phone to find the code;
                it is not saved or sent to us. You can refuse camera access and type the code instead using “Enter code”.
              </P>
            </Sub>
            <Sub title="Photos">
              <P>
                When you change your outlet logo or add outlet photos, the App opens your phone’s own photo picker. Only the photos you
                select are uploaded. The App does not ask for access to your whole photo library.
              </P>
            </Sub>
            <Sub title="Not used">
              <P>The App does not access your location, microphone, contacts, calls, SMS or files outside what you choose to upload.</P>
            </Sub>
          </Section>

          <Section id="how-we-use" title={title('how-we-use')}>
            <P>We use the information above only for these purposes:</P>
            <ol className="list-decimal space-y-1.5 pl-6 marker:text-gilt">
              {USES.map(([label, text]) => (
                <li key={label}>
                  <span className="font-medium text-ivory">{label}:</span> {text}
                </li>
              ))}
            </ol>
          </Section>

          <Section id="sharing" title={title('sharing')}>
            <P>We do not sell personal information. We share it only as follows:</P>
            <Bullets
              items={[
                'Partners: your outlet profile is shown to partners, and each partner can see the bills made with their own QR code.',
                'The LotMore Wins team: to run the programme, set up outlets, support you and correct bills.',
                'Service providers who host our servers and database and deliver our email and WhatsApp messages (for example, bill confirmations to partners). They may use the information only to provide these services to us.',
                'Authorities, auditors or legal advisers, when required by law or to protect our rights and users.',
              ]}
            />
            <P>
              Some of our service providers may store or process information on servers outside India. Where this happens it is done in
              line with applicable Indian law.
            </P>
          </Section>

          <Section id="storage-security" title={title('storage-security')}>
            <P>
              All information is sent between the App and our servers over encrypted connections (HTTPS). Passwords are stored only in
              hashed form, access to data is limited to people who need it, and every request is checked against the signed-in outlet,
              so one outlet cannot see another outlet’s bills.
            </P>
            <P>
              No system is completely secure. Keep your outlet password private, and sign out of the App before handing a phone to
              someone who should not use it.
            </P>
          </Section>

          <Section id="retention" title={title('retention')}>
            <P>
              We keep outlet login and profile information while your outlet takes part in the programme. Bills and slab change records
              are kept for as long as needed for accounting, tax, dispute resolution and fraud prevention, and as required by law.
            </P>
            <P>
              <span className="font-medium text-ivory">To delete an outlet login or outlet account</span>, contact us using the details in
              section 12 from the outlet’s registered email address. We will deactivate and delete the login and remove the outlet
              profile, logo and photos from the Partner App. Bill records that we must keep by law are retained for the required period
              and then deleted.
            </P>
          </Section>

          <Section id="rights" title={title('rights')}>
            <P>Subject to applicable law, you may:</P>
            <Bullets
              items={[
                'Ask what information we hold about you or your outlet login.',
                'Correct outlet details yourself in the Outlet tab, or ask us to correct anything else.',
                'Ask us to delete your login or outlet account, as described above.',
                'Raise a grievance about how your information is handled.',
              ]}
            />
            <P>
              Partners and guests whose details appear in a bill can contact us directly; requests are handled under our main{' '}
              <Link to="/privacy-policy" className="text-gilt underline-offset-4 hover:text-gilt-bright hover:underline">
                Privacy Policy
              </Link>
              .
            </P>
          </Section>

          <Section id="children" title={title('children')}>
            <P>
              The App is a business tool for outlet staff and is not meant for children. Outlet logins should be used only by adults
              authorised by the outlet.
            </P>
          </Section>

          <Section id="changes" title={title('changes')}>
            <P>
              We may update this Policy when the App or the law changes. The new version will be published on this page with a new
              “Last Updated” date. Where required, we will tell outlets about important changes.
            </P>
          </Section>

          <Section id="contact" title={title('contact')}>
            <P>For privacy questions, account deletion requests or complaints, please contact:</P>
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
              Please include your outlet name and outlet login email. Never send your password. We will acknowledge and address
              grievances within the timelines required by applicable law.
            </P>
          </Section>

          <p className="border-t border-white/10 pt-8 text-center font-medium text-gilt-bright">
            LotMore Wins — More Connections. More Benefits. More Wins.
          </p>
        </div>
      </main>

      <Footer
        appName="Lot More Wins Outlet Admin App"
        privacyHref="/outlet-admin/privacy-policy"
        otherApp={{ to: '/', label: 'Partner App' }}
      />
    </div>
  );
}
