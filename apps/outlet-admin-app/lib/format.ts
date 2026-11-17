import type {
  BillNotification,
  BillTransactionType,
  PurchasePointsRecipient,
} from '@lotmorewins/types';
import type { BadgeTone } from '../components/ui/Parts';

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact rupees for tiles: ₹1,250 / ₹1.2L */
export function formatINRCompact(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount >= 1000000 ? 1 : 2)}L`;
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

export function formatPoints(points: number): string {
  return `${points.toLocaleString('en-IN', { maximumFractionDigits: 2 })} pts`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** e.g. "Includes 5% birthday bonus"; null when the bill carries no birthday bonus. */
export function birthdayBonusLabel(birthdayBonusPercentage: number | undefined): string | null {
  return birthdayBonusPercentage && birthdayBonusPercentage > 0
    ? `Includes ${formatPercent(birthdayBonusPercentage)} birthday bonus`
    : null;
}

/** e.g. "Referral reward: 20% special discount"; null when the bill uses no referral reward. */
export function referralRewardLabel(referralRewardPercentage: number | undefined): string | null {
  return referralRewardPercentage && referralRewardPercentage > 0
    ? `Referral reward: ${formatPercent(referralRewardPercentage)} special discount`
    : null;
}

/** Redeem QRs from the partner wallet carry a case-sensitive signed token after this prefix. */
export const REDEEM_QR_PREFIX = 'LMW-RDM.';

/**
 * The short text code shown under a redeem QR ("K7Q2-9XPA"): 8 characters without look-alikes,
 * any case, dash and spaces optional. The server turns it back into the QR.
 */
export const isRedeemShortCode = (code: string) => /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(code.trim().toUpperCase().replace(/[\s-]/g, ''));

/** A scanned redeem QR or a typed redeem short code: both go down the redeem bill path. */
export const isRedeemQr = (code: string) => code.trim().startsWith(REDEEM_QR_PREFIX) || isRedeemShortCode(code);

export const transactionLabel = (t: BillTransactionType) => (t === 'DIRECT_PARTNER' ? 'Direct partner' : 'Referral');

export function purchaseRecipientLabel(recipient: PurchasePointsRecipient): string {
  switch (recipient) {
    case 'PARTNER':
      return "Added to the partner's wallet";
    case 'CUSTOMER_PARTNER':
      return "Added to the customer's partner wallet";
    case 'CUSTOMER_PENDING':
      return 'Saved on the customer mobile until they join the app';
  }
}

export function notificationBadge(n: BillNotification): { label: string; tone: BadgeTone } {
  const channel = n.channel === 'whatsapp' ? 'WhatsApp' : n.channel === 'email' ? 'Email' : 'Message';
  switch (n.status) {
    case 'SENT':
      return { label: `${channel} sent`, tone: 'success' };
    case 'FAILED':
      return { label: `${channel} failed`, tone: 'danger' };
    case 'SKIPPED':
      return { label: `${channel} not sent`, tone: 'muted' };
    default:
      return { label: 'Sending…', tone: 'gold' };
  }
}

/** 10-digit Indian mobile from free text (+91, spaces, dashes, leading 0 removed), or null. */
export function normalizeMobileInput(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Unique per bill attempt; reused on retries so the server can de-duplicate. */
export function newIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `oa-${Date.now().toString(36)}-${rand()}${rand()}`;
}

/** This outlet's maximum wallet redemption in words; older servers send none (half the bill). */
export function walletCapText(cap: { walletRedeemCapType?: 'PERCENTAGE' | 'FIXED'; walletRedeemCapValue?: number }): string {
  const value = cap.walletRedeemCapValue ?? 50;
  if (cap.walletRedeemCapType === 'FIXED') return `${formatINR(value)} of the bill`;
  if (value === 50) return 'half the bill';
  if (value >= 100) return 'the whole bill';
  return `${formatPercent(value)} of the bill`;
}
