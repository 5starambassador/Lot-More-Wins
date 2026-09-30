import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { MessagingService } from '../apps/web/lib/messaging';

// No stored Super Admin setting: the service must fall back to MESSAGING_MODE.
const noStoredSetting = async () => null;

async function testMessagingModes() {
  console.log('================================================================');
  console.log('TESTING CENTRALIZED MESSAGING ROUTING (Section 34)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, name: string, details?: any) {
    if (cond) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`, details);
      failed++;
    }
  }

  // 1. Test Email Mode
  console.log('--- MODE 1: no DB setting, MESSAGING_MODE = email ---');
  process.env.MESSAGING_MODE = 'email';
  const emailService = new MessagingService(noStoredSetting);

  assert((await emailService.getMode()) === 'email', 'MessagingService reports mode "email"');

  const emailOtpRes = await emailService.sendRegistrationOtp({
    to: 'partner.test@example.com',
    name: 'Test Partner',
    otp: '543210',
  });
  assert(emailOtpRes.success, 'Email OTP send successfully dispatched');
  assert(emailOtpRes.channel === 'email', 'Email OTP routed strictly to Email channel');

  const emailInvoiceRes = await emailService.sendInvoiceAndDownloadLink({
    to: 'partner.test@example.com',
    name: 'Test Partner',
    billNumber: 'INV-2026-001',
    subtotal: 1500,
    discountAmount: 150,
    totalAmount: 1350,
    pointsEarned: 135,
    downloadLink: 'https://lotmorewins.com/download',
  });
  assert(emailInvoiceRes.success, 'Email Invoice send successfully dispatched');
  assert(emailInvoiceRes.channel === 'email', 'Email Invoice routed strictly to Email channel');
  assert(
    emailOtpRes.channel === emailInvoiceRes.channel && emailOtpRes.channel === 'email',
    'No mixed routing: Both services use strictly Email in email mode'
  );

  // 2. Test WhatsApp Mode
  console.log('\n--- MODE 2: no DB setting, MESSAGING_MODE = whatsapp ---');
  process.env.MESSAGING_MODE = 'whatsapp';
  const waService = new MessagingService(noStoredSetting);

  assert((await waService.getMode()) === 'whatsapp', 'MessagingService reports mode "whatsapp"');

  const waOtpRes = await waService.sendRegistrationOtp({
    to: '919876543210',
    name: 'WhatsApp Partner',
    otp: '889900',
  });
  assert(waOtpRes.success, 'WhatsApp OTP send successfully dispatched');
  assert(waOtpRes.channel === 'whatsapp', 'WhatsApp OTP routed strictly to WhatsApp channel (MSG91)');

  const waInvoiceRes = await waService.sendInvoiceAndDownloadLink({
    to: '919876543210',
    name: 'WhatsApp Partner',
    billNumber: 'INV-2026-002',
    subtotal: 2450,
    discountAmount: 245,
    totalAmount: 2205,
    pointsEarned: 220,
    downloadLink: 'https://lotmorewins.com/download',
  });
  assert(waInvoiceRes.success, 'WhatsApp Invoice send successfully dispatched');
  assert(waInvoiceRes.channel === 'whatsapp', 'WhatsApp Invoice routed strictly to WhatsApp channel (MSG91)');
  assert(
    waOtpRes.channel === waInvoiceRes.channel && waOtpRes.channel === 'whatsapp',
    'No mixed routing: Both services use strictly MSG91 WhatsApp in whatsapp mode'
  );

  // 3. Negative test: Invalid Mode fallback handling
  console.log('\n--- NEGATIVE TEST: INVALID MESSAGING_MODE ---');
  process.env.MESSAGING_MODE = 'invalid_sms';
  const invalidService = new MessagingService(noStoredSetting);
  assert((await invalidService.getMode()) === 'email', 'Invalid mode safely falls back to default email mode');

  // 4. The stored Super Admin setting is the runtime source of truth over MESSAGING_MODE
  console.log('\n--- DB-DRIVEN MODE: stored setting overrides MESSAGING_MODE ---');
  process.env.MESSAGING_MODE = 'email';
  const storedWhatsApp = new MessagingService(async () => 'whatsapp');
  assert((await storedWhatsApp.getMode()) === 'whatsapp', 'Stored "whatsapp" setting wins over MESSAGING_MODE=email');
  const storedOtp = await storedWhatsApp.sendRegistrationOtp({ to: '919876543210', name: 'Stored Mode', otp: '112233' });
  assert(storedOtp.channel === 'whatsapp', 'OTP routed by the stored setting, not the env var');

  process.env.MESSAGING_MODE = 'whatsapp';
  const storedEmail = new MessagingService(async () => 'email');
  assert((await storedEmail.getMode()) === 'email', 'Stored "email" setting wins over MESSAGING_MODE=whatsapp');

  // Reset to email
  process.env.MESSAGING_MODE = 'email';

  console.log('\n================================================================');
  console.log(`MESSAGING TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

testMessagingModes().catch((e) => {
  console.error('Fatal messaging test error:', e);
  process.exit(1);
});
