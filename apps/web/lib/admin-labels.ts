import type {
  BillNotificationStatus,
  BillTransactionType,
  OutletStatus,
  PartnerStatus,
  QRCodeType,
} from '@lotmorewins/types';
import type { Tone } from '@/components/ui/badge';

/** Human labels and status tones for enum values shown in the Super Admin panel. */

export const PARTNER_STATUS: Record<PartnerStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
};

export const OUTLET_STATUS: Record<OutletStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
};

export const BILL_TYPE_LABEL: Record<BillTransactionType, string> = {
  DIRECT_PARTNER: 'Direct partner',
  REFERRAL: 'Referral',
};

export const QR_TYPE_LABEL: Record<QRCodeType, string> = {
  DEFAULT_DISCOUNT: 'Discount QR',
  REFERRAL: 'Referral QR',
};

export const NOTIFICATION_STATUS: Record<BillNotificationStatus, { label: string; tone: Tone }> = {
  SENT: { label: 'Sent', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
  SKIPPED: { label: 'Skipped', tone: 'neutral' },
};
