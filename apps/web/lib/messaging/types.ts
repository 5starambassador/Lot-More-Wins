import type { MessagingMode } from '@lotmorewins/types';

export type { MessagingMode };

export interface SendOtpOptions {
  to: string; // email address or phone number
  name?: string;
  otp: string;
}

export interface SendInvoiceOptions {
  to: string;
  name: string;
  outletName: string;
  billNumber: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
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
