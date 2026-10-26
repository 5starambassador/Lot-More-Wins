import type { PartnerCategory, PayoutSource, PayoutStatus } from '@lotmorewins/types';
import type { Tone } from '@/components/ui/badge';

/** Labels for the partner classification, payouts and the payout weekday. */

export const PARTNER_CATEGORY: Record<PartnerCategory, string> = {
  ACHARIYA: 'Achariya',
  NON_ACHARIYA: 'Non-Achariya',
};

export const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled (moved to wallet)', tone: 'neutral' },
};

export const PAYOUT_SOURCE: Record<PayoutSource, string> = {
  WEEKLY: 'Weekly',
  MANUAL: 'Requested',
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
