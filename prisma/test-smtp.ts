import nodemailer from 'nodemailer';
import { promises as dns } from 'dns';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Credentials come from SMTP_USER / SMTP_PASS in the env file; never hard-code them here.
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

async function testGmail() {
  if (!SMTP_USER || !SMTP_PASS) throw new Error('Set SMTP_USER and SMTP_PASS in .env or apps/web/.env.local');
  console.log('Resolving IPv6 address for smtp.gmail.com...');
  let host = 'smtp.gmail.com';
  try {
    const addrs = await dns.resolve6('smtp.gmail.com');
    if (addrs && addrs.length > 0) {
      host = addrs[0];
      console.log(`Using IPv6 host: ${host}`);
    }
  } catch (err: any) {
    console.warn('IPv6 resolve fallback to hostname:', err.message);
  }

  const transporter = nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    tls: {
      servername: 'smtp.gmail.com',
    },
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  console.log('Verifying transporter with Gmail credentials...');
  await transporter.verify();
  console.log('🎉 GMAIL SMTP AUTHENTICATED SUCCESSFULLY!');

  // Send a real test email
  console.log(`Sending test email to ${SMTP_USER}...`);
  const info = await transporter.sendMail({
    from: `"Lot More Wins" <${SMTP_USER}>`,
    to: SMTP_USER,
    subject: 'Lot More Wins — Real Email Verification Test',
    text: 'Real Gmail SMTP with app password is fully working and verified!',
    html: '<h3>Lot More Wins</h3><p>Real Gmail SMTP with Google App Password is <strong>fully verified and working</strong>!</p>',
  });

  console.log('✅ Email sent! Message ID:', info.messageId);
  return info;
}

testGmail()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  });
