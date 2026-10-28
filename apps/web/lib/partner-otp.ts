import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Partner } from '@prisma/client';
import type { MessagingMode } from '@lotmorewins/types';
import prisma from './prisma';
import messagingService from './messaging';
import { HttpError } from './auth';

/**
 * One-time codes for a registered partner: sign-in and confirming a wallet transfer. A code goes
 * out on the channel the Super Admin chose in Settings (email to the partner's registered email,
 * WhatsApp to their registered mobile); the partner never picks it. Codes are stored in
 * `otp_verifications` under a key derived from the purpose and the partner id, so they never mix
 * with registration codes (keyed by mobile/email) or with each other.
 */

export type PartnerOtpPurpose = 'login' | 'transfer';

const OTP_VALIDITY_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
/** Codes requested within the validity window all stay usable, so a late message still verifies. */
const MAX_ACTIVE_OTPS = 5;
const MAX_ATTEMPTS = 5;

export function partnerOtpKey(purpose: PartnerOtpPurpose, partnerId: string): string {
  return purpose === 'login' ? `partner-login:${partnerId}` : `wallet-transfer:${partnerId}`;
}

/** "ra****@gmail.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

/** "+91 98****3210" */
export function maskMobile(mobile: string): string {
  return `+91 ${mobile.slice(0, 2)}****${mobile.slice(-4)}`;
}

/**
 * App store review login: store reviewers cannot receive the emailed code, so the review account
 * (REVIEW_LOGIN_EMAIL, apptest@lotmorewins.com by default) signs in with the fixed code in
 * REVIEW_LOGIN_OTP and no message is sent. Reviewers test on many devices at once, so this account
 * has no request limit, resend gap or attempt limit, and the code is never used up. Off unless
 * REVIEW_LOGIN_OTP is a 6-digit code; it only covers sign-in, never wallet transfers.
 */
export function reviewLoginOtp(email: string): string | null {
  const otp = process.env.REVIEW_LOGIN_OTP?.trim() ?? '';
  const reviewEmail = (process.env.REVIEW_LOGIN_EMAIL?.trim() || 'apptest@lotmorewins.com').toLowerCase();
  return /^\d{6}$/.test(otp) && email.trim().toLowerCase() === reviewEmail ? otp : null;
}

/** Minimum gap between two sign-in codes for the same partner. */
export const RESEND_GAP_SEC = 60;

export interface SentPartnerOtp {
  mode: MessagingMode;
  /** Masked address the code was sent to, for display. */
  destination: string;
  expiresAt: string;
  /** Seconds until another code can be requested. */
  resendAfterSec: number;
  devOtp?: string;
}

/**
 * Sends a code for `purpose`. Throws 429 after 5 codes in 10 minutes, 429 OTP_RESEND_WAIT when a
 * sign-in code was sent less than RESEND_GAP_SEC ago (`details.retryAfterSec`), and 502 when it
 * cannot be delivered. The channel is read from the Super Admin setting on every send.
 */
export async function sendPartnerOtp(
  partner: Pick<Partner, 'id' | 'name' | 'mobile' | 'email'>,
  purpose: PartnerOtpPurpose
): Promise<SentPartnerOtp> {
  const mode = await messagingService.getMode();
  const destination = mode === 'whatsapp' ? maskMobile(partner.mobile) : maskEmail(partner.email);
  const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS);

  // The review code is fixed and checked directly at sign-in: nothing is stored, sent or limited.
  if (purpose === 'login' && reviewLoginOtp(partner.email)) {
    return { mode, destination, expiresAt: expiresAt.toISOString(), resendAfterSec: RESEND_GAP_SEC };
  }

  const key = partnerOtpKey(purpose, partner.id);
  const [recentCount, latest] = await Promise.all([
    prisma.otpVerification.count({ where: { identifier: key, createdAt: { gte: new Date(Date.now() - OTP_VALIDITY_MS) } } }),
    prisma.otpVerification.findFirst({ where: { identifier: key }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    throw new HttpError(429, 'Too many code requests. Please wait a few minutes before trying again.', 'RATE_LIMITED');
  }
  if (purpose === 'login' && latest) {
    const retryAfterSec = Math.ceil((latest.createdAt.getTime() + RESEND_GAP_SEC * 1000 - Date.now()) / 1000);
    if (retryAfterSec > 0) {
      throw new HttpError(
        429,
        `A code was sent moments ago. You can request a new one in ${retryAfterSec} seconds.`,
        'OTP_RESEND_WAIT',
        { retryAfterSec }
      );
    }
  }

  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const record = await prisma.otpVerification.create({
    data: {
      identifier: key,
      channel: mode.toUpperCase(),
      codeHash: await bcrypt.hash(rawOtp, 10),
      expiresAt,
      verified: false,
    },
  });

  const to = mode === 'whatsapp' ? partner.mobile : partner.email;
  const sendResult = await messagingService.sendRegistrationOtp({ to, name: partner.name, otp: rawOtp, purpose }, mode);
  if (!sendResult.success) {
    // A code that never went out must not count towards the request limit.
    await prisma.otpVerification.delete({ where: { id: record.id } }).catch(() => undefined);
    throw new HttpError(502, 'Could not deliver the code. Please try again.', 'OTP_SEND_FAILED');
  }

  return {
    mode,
    destination,
    expiresAt: expiresAt.toISOString(),
    resendAfterSec: purpose === 'login' ? RESEND_GAP_SEC : 0,
    // In non-production or when ENABLE_DEV_OTP=true, return devOtp for testing.
    devOtp: process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true' ? rawOtp : undefined,
  };
}

/**
 * Checks a code for `purpose` and consumes every pending code of that purpose when it matches, so
 * none can be replayed. A wrong code counts as an attempt against all pending codes; after 5 a new
 * code is needed. Throws 400 with OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED or OTP_INVALID.
 */
export async function consumePartnerOtp(partnerId: string, purpose: PartnerOtpPurpose, otp: string): Promise<void> {
  const key = partnerOtpKey(purpose, partnerId);
  // Newest first. After a resend the earlier codes still work: messages can arrive out of order.
  const records = await prisma.otpVerification.findMany({
    where: { identifier: key, verified: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: MAX_ACTIVE_OTPS,
  });
  if (records.length === 0) {
    throw new HttpError(400, 'Your code has expired. Please request a new one.', 'OTP_EXPIRED');
  }
  // Requesting a new code starts a fresh count.
  if (records[0].attempts >= MAX_ATTEMPTS) {
    throw new HttpError(400, 'Too many incorrect attempts. Please request a new code.', 'OTP_ATTEMPTS_EXCEEDED');
  }

  for (const record of records) {
    if (record.attempts < MAX_ATTEMPTS && (await bcrypt.compare(otp, record.codeHash))) {
      await prisma.otpVerification.deleteMany({ where: { identifier: key } });
      return;
    }
  }
  await prisma.otpVerification.updateMany({
    where: { id: { in: records.map((record) => record.id) } },
    data: { attempts: { increment: 1 } },
  });
  throw new HttpError(400, 'Incorrect code. Please check it and try again.', 'OTP_INVALID');
}
