/**
 * Lot More Wins — Shared Domain & API Types
 */

// ============================================================================
// Common & API Response Types
// ============================================================================

export type ID = string;

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  details?: Record<string, unknown> | Array<unknown>;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version?: string;
  timestamp: string;
  database?: {
    status: 'connected' | 'disconnected' | 'not_configured';
    latencyMs?: number;
  };
}

// ============================================================================
// Authentication & Roles
// ============================================================================

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PARTNER' | 'OUTLET_ADMIN';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionUser {
  id: ID;
  role: UserRole;
  phone: string;
  name: string;
  email?: string | null;
  outletId?: string | null;
  partnerId?: string | null;
}

// ============================================================================
// Core Entities (Preparation for Future Phases)
// ============================================================================

export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type PartnerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Partner extends Timestamps {
  id: ID;
  code: string;
  name: string;
  phone: string;
  email?: string | null;
  status: PartnerStatus;
  tier: PartnerTier;
  walletBalance: number;
  pointsBalance: number;
}

export interface OutletAdmin extends Timestamps {
  id: ID;
  name: string;
  phone: string;
  email?: string | null;
  outletId: ID;
  isActive: boolean;
}

export interface Outlet extends Timestamps {
  id: ID;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isActive: boolean;
}

export interface Customer extends Timestamps {
  id: ID;
  phone: string;
  name?: string | null;
  referredByPartnerId?: ID | null;
}

export type ReferralStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

export interface Referral extends Timestamps {
  id: ID;
  partnerId: ID;
  customerId: ID;
  outletId?: ID | null;
  status: ReferralStatus;
  rewardPoints?: number | null;
}

export interface Bill extends Timestamps {
  id: ID;
  outletId: ID;
  customerId: ID;
  partnerId?: ID | null;
  billNumber: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  pointsEarned: number;
}

export interface Discount {
  id: ID;
  code: string;
  percentage?: number | null;
  fixedAmount?: number | null;
  minBillAmount?: number | null;
  maxDiscount?: number | null;
  isActive: boolean;
}

export interface Wallet extends Timestamps {
  id: ID;
  ownerId: ID;
  ownerType: 'PARTNER' | 'OUTLET';
  balance: number;
  currency: string;
}

export interface Points extends Timestamps {
  id: ID;
  partnerId: ID;
  availablePoints: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
}

export type TransactionType = 'CREDIT' | 'DEBIT' | 'REFUND' | 'REWARD';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface Transaction extends Timestamps {
  id: ID;
  walletId: ID;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  referenceId?: string | null;
  description?: string | null;
}

export type QRCodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED';

export interface QRCode extends Timestamps {
  id: ID;
  code: string;
  type: 'PARTNER_REFERRAL' | 'BILL_DISCOUNT' | 'OUTLET_CHECKIN';
  metadata?: Record<string, unknown> | null;
  status: QRCodeStatus;
  expiresAt?: string | null;
}

export interface ProgramSettings {
  id: ID;
  pointsPerRupee: number;
  redemptionRate: number;
  minRedemptionPoints: number;
  referralRewardPoints: number;
  supportPhone?: string | null;
  supportEmail?: string | null;
}

export interface AuditLog {
  id: ID;
  actorId: ID;
  actorRole: UserRole;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
