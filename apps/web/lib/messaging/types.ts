import type { MessagingMode } from '@lotmorewins/types';

export type { MessagingMode };

export interface SendOtpOptions {
  to: string; // email address or phone number
  name?: string;
  otp: string;
  /** What the code is for; changes only the email wording. Defaults to registration. */
  purpose?: 'registration' | 'login' | 'transfer';
}

export interface SendInvoiceOptions {
  to: string;
  name: string;
  outletName: string;
  billNumber: string;
  subtotal: number;
  discountAmount: number;
  /** Total discount %, birthday bonus / referral reward included. */
  discountPercentage: number;
  /** Amount after discount, before GST. */
  taxableAmount: number;
  /** The outlet's GST % and the GST charged on the taxable amount (0 = no GST line). */
  gstPercentage: number;
  gstAmount: number;
  /** Redeem bills: the part paid from the partner's wallet (0 = none). */
  walletRedeemAmount?: number;
  /** Paise added or taken off to reach whole rupees (0 = no line). */
  roundOffAmount?: number;
  /** Final payable: taxable amount + GST − wallet amount + round-off, whole rupees. */
  totalAmount: number;
  /** Cash reward this bill earned the recipient (0 = none). */
  cashReward: number;
  pointsEarned: number;
  /** true when the points are held against the mobile number until the partner app is registered. */
  pointsPending: boolean;
  /** Partner app download link from the Super Admin settings; null when not configured. */
  downloadLink: string | null;
}

export interface MessagingResult {
  success: boolean;
  channel: 'email' | 'whatsapp';
  messageId?: string;
  recipient: string;
  error?: string;
  devNotice?: string;
}
