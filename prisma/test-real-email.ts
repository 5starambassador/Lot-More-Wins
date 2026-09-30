import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { MessagingService } from '../apps/web/lib/messaging';

async function testRealEmailServices() {
  console.log('================================================================');
  console.log('TESTING REAL GMAIL SMTP SERVICES VIA MESSAGING SERVICE');
  console.log('Account:', process.env.SMTP_USER);
  console.log('Host:', process.env.SMTP_HOST, 'Port:', process.env.SMTP_PORT);
  console.log('================================================================\n');

  const messagingService = new MessagingService();

  console.log('Current Messaging Mode:', messagingService.getMode());

  // 1. Service 1: Real Partner Registration OTP Email
  console.log('\n--- 1. Sending Real Partner Registration OTP Email ---');
  const otpRes = await messagingService.sendRegistrationOtp({
    to: 'webdeveloper@achariya.org',
    name: 'Achariya Web Developer',
    otp: '839201',
  });

  console.log('OTP Email Result:', JSON.stringify(otpRes, null, 2));

  if (!otpRes.success || !otpRes.messageId) {
    throw new Error(`Failed to send real OTP email: ${otpRes.error || 'Unknown error'}`);
  }
  console.log(`✅ Real OTP Email dispatched successfully! MessageId: ${otpRes.messageId}`);

  // 2. Service 2: Real Invoice + Download App Link Email
  console.log('\n--- 2. Sending Real Invoice + Download App Link Email ---');
  const invoiceRes = await messagingService.sendInvoiceAndDownloadLink({
    to: 'webdeveloper@achariya.org',
    name: 'Achariya Web Developer',
    billNumber: 'INV-2026-LIVE-001',
    subtotal: 2500,
    discountAmount: 250,
    totalAmount: 2250,
    pointsEarned: 225,
    downloadLink: 'https://lotmorewins.com/partner-app/download',
  });

  console.log('Invoice Email Result:', JSON.stringify(invoiceRes, null, 2));

  if (!invoiceRes.success || !invoiceRes.messageId) {
    throw new Error(`Failed to send real invoice email: ${invoiceRes.error || 'Unknown error'}`);
  }
  console.log(`✅ Real Invoice Email dispatched successfully! MessageId: ${invoiceRes.messageId}`);

  console.log('\n================================================================');
  console.log('🎉 BOTH REAL EMAIL SERVICES VALIDATED & DISPATCHED SUCCESSFULLY!');
  console.log('================================================================');
}

testRealEmailServices()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Real email test failed:', err);
    process.exit(1);
  });
