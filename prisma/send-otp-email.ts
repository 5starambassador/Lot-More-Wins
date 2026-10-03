import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { EmailProvider } from '../apps/web/lib/messaging/email-provider';

/**
 * Sends the partner registration OTP email through the app's SMTP account.
 * Usage: pnpm tsx prisma/send-otp-email.ts [to] [otp] [name]
 * Uses EmailProvider directly so it always goes by email, whatever the messaging mode.
 */
const to = process.argv[2] || 'erix1008@gmail.com';
const otp = process.argv[3] || '963788';
const name = process.argv[4] || 'Partner';

async function sendOtpEmail() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER / SMTP_PASS are not set in the .env files');
  }

  console.log(`Sending OTP ${otp} to ${to} from ${process.env.SMTP_USER}`);
  const result = await new EmailProvider().sendOtp({ to, name, otp });

  // Outside production the provider reports success with a devNotice when SMTP fails.
  if (!result.success || result.devNotice || !result.messageId) {
    throw new Error(result.error || result.devNotice || 'Email was not sent');
  }
  console.log(`Sent. MessageId: ${result.messageId}`);
}

sendOtpEmail()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to send OTP email:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
