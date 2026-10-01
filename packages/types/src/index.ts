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
// Phase 2: Partner Onboarding, Roles, & QR Code Types
// ============================================================================

export type PartnerRole = 'NON_ACHARIYA' | 'STAFF' | 'TEACHER' | 'PARENT';
export type AchariyaRole = 'STAFF' | 'TEACHER';
export type QRCodeType = 'DEFAULT_DISCOUNT' | 'REFERRAL';
export type QRCodeStatus = 'ACTIVE' | 'REVOKED';
export type PartnerStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED';
export type MessagingMode = 'email' | 'whatsapp';

export interface ValidateEmployeePayload {
  employeeId: string;
  role?: AchariyaRole;
}

export interface ValidateEmployeeResponse {
  employeeId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: AchariyaRole;
  department?: string | null;
}

export interface ValidateAdmissionPayload {
  admissionNumber: string;
}

export interface ValidateAdmissionResponse {
  admissionNumber: string;
  studentName: string;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  grade?: string | null;
}

export interface OtpSendPayload {
  identifier: string; // phone or email
  name?: string;
  email?: string; // delivery address in email mode when identifier is a phone
}

export interface OtpSendResponse {
  success: boolean;
  message: string;
  expiresAt: string;
  mode: MessagingMode;
  devOtp?: string; // only provided in dev environments when enabled
}

export interface OtpVerifyPayload {
  identifier: string;
  otp: string;
}

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  verificationToken?: string;
}

export interface PartnerOnboardingPayload {
  isAchariyaAssociated: boolean;
  role: PartnerRole;
  name: string;
  mobile: string;
  email: string;
  employeeId?: string;
  admissionNumber?: string;
  password: string;
  confirmPassword: string;
  otp: string;
}

export interface PermanentQRItem {
  id: string;
  code: string;
  type: QRCodeType;
  title: string;
  description: string;
  status: QRCodeStatus;
  createdAt: string;
}

export interface PartnerProfile {
  id: string;
  partnerCode: string;
  name: string;
  mobile: string;
  email: string;
  role: PartnerRole;
  isAchariyaAssociated: boolean;
  employeeId?: string | null;
  admissionNumber?: string | null;
  status: PartnerStatus;
  createdAt: string;
}

export interface PartnerOnboardingResponse {
  partner: PartnerProfile;
  qrCodes: PermanentQRItem[];
  token: string;
  /** Registration only: pending customer purchase points claimed into the new wallet. */
  claimedPoints?: number;
}

export interface PartnerQrResponse {
  partner: {
    id: string;
    partnerCode: string;
    name: string;
  };
  qrCodes: PermanentQRItem[];
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
// Future Phase Entities
// ============================================================================

export type PartnerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface PartnerEntity extends Timestamps {
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

export type ReferralStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

export interface Referral extends Timestamps {
  id: ID;
  partnerId: ID;
  customerId: ID;
  outletId?: ID | null;
  status: ReferralStatus;
  rewardPoints?: number | null;
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

// ============================================================================
// Phase 3: Settings, Outlets, Scanning & Billing
// ============================================================================

/** Derived server-side from Partner.isAchariyaAssociated. Never client-supplied. */
export type PartnerClassification = 'ACHARIYA' | 'NON_ACHARIYA';
export type OutletStatus = 'ACTIVE' | 'INACTIVE';
export type BillTransactionType = 'DIRECT_PARTNER' | 'REFERRAL';

export interface ClassificationPercentages {
  achariya: number;
  nonAchariya: number;
}

/** Amount that purchase and referral point percentages are applied to. */
export type PointsBasis = 'BILL_AMOUNT' | 'PAYABLE_AMOUNT';

export interface ProgramSettings {
  messagingMode: MessagingMode;
  /** Direct partner QR: discount on the partner's first ever bill. */
  firstTimeDiscount: ClassificationPercentages;
  /** Days after registration a partner can still use the first-time discount. 0 = no expiry. */
  firstTimeValidityDays: number;
  /** Direct partner QR: discount on every later bill. */
  repeatDiscount: ClassificationPercentages;
  /** Referral QR: discount for the referred customer, by the referring partner's type. */
  referralDiscount: ClassificationPercentages;
  pointsToRupees: { points: number; rupees: number };
  /** Referral QR: points percentage credited to the referring partner, by that partner's type. */
  referralPoints: ClassificationPercentages;
  /** Purchase points percentage credited to whoever made the purchase. */
  purchasePointsPercentage: number;
  /** Days earned purchase points stay in the wallet. 0 = no expiry. */
  purchasePointsValidityDays: number;
  /** Days earned referral points stay in the wallet. 0 = no expiry. */
  referralPointsValidityDays: number;
  pointsBasis: PointsBasis;
  /** Partner app download / Play Store link sent in bill messages. */
  appDownloadUrl: string | null;
  /** false when no row exists yet and runtime defaults are being served */
  isPersisted: boolean;
  updatedAt: string | null;
}

export type UpdateProgramSettingsPayload = Omit<ProgramSettings, 'isPersisted' | 'updatedAt'>;

export interface SuperAdminProfile {
  id: ID;
  name: string;
  email: string;
}

export interface Outlet extends Timestamps {
  id: ID;
  name: string;
  email: string;
  mobile: string;
  logoUrl: string | null;
  images: string[];
  status: OutletStatus;
}

export interface AdminOutlet extends Outlet {
  adminEmail: string | null;
  billCount: number;
}

export interface CreateOutletPayload {
  name: string;
  email: string;
  mobile: string;
  logoUrl?: string | null;
  images?: string[];
  status?: OutletStatus;
  adminEmail: string;
  adminPassword: string;
}

export interface UpdateOutletPayload {
  name?: string;
  email?: string;
  mobile?: string;
  logoUrl?: string | null;
  images?: string[];
  status?: OutletStatus;
  adminPassword?: string;
}

export type UpdateOutletProfilePayload = Pick<UpdateOutletPayload, 'name' | 'email' | 'mobile' | 'logoUrl' | 'images'>;

export interface MediaUploadPayload {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
}

export interface MediaUploadResponse {
  id: ID;
  url: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface OutletAdminSession {
  token: string;
  admin: { id: ID; email: string };
  outlet: Outlet;
}

export interface ScannedPartner {
  id: ID;
  partnerCode: string;
  name: string;
  mobile: string;
  email: string;
  classification: PartnerClassification;
}

/** Server-computed discount basis, taken from the Super Admin settings. */
export interface DiscountBasis {
  classification: PartnerClassification;
  /** Direct QR: partner's first bill ever. Referral QR: null until the customer is known. */
  isFirstTime: boolean | null;
  discountPercentage: number;
}

export interface ScanResult {
  qrType: QRCodeType;
  transactionType: BillTransactionType;
  partner: ScannedPartner;
  discount: DiscountBasis;
  /** Settings version (updatedAt) the scan was evaluated with. */
  settingsVersion: string;
}

/** Who receives the purchase points of a bill. */
export type PurchasePointsRecipient =
  /** Direct QR: the partner who purchased. */
  | 'PARTNER'
  /** Referral QR: the customer's mobile already belongs to a registered partner. */
  | 'CUSTOMER_PARTNER'
  /** Referral QR: held against the customer's mobile until they register in the partner app. */
  | 'CUSTOMER_PENDING';

export type BillNotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface BillNotification {
  status: BillNotificationStatus;
  channel: MessagingMode | null;
  recipient: string | null;
  error: string | null;
  attempts: number;
  sentAt: string | null;
}

/** Known customer details returned to prefill the referral customer form. */
export interface CustomerLookup {
  mobile: string;
  name: string;
  email: string | null;
  /** true when the mobile belongs to a registered partner (points go straight to their wallet). */
  isPartner: boolean;
}

export interface ReferredCustomerInput {
  name: string;
  mobile: string;
  email?: string | null;
}

export interface BillPreviewPayload {
  qrCode: string;
  billAmount: number;
  customer?: ReferredCustomerInput;
}

export interface BillCreatePayload extends BillPreviewPayload {
  idempotencyKey: string;
  /** settingsVersion from the preview the admin confirmed; the bill is refused if settings changed since. */
  settingsVersion?: string;
}

export interface BillCalculation {
  transactionType: BillTransactionType;
  classification: PartnerClassification;
  isFirstTime: boolean;
  billAmount: number;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  pointsBasis: PointsBasis;
  /** Amount the point percentages were applied to (bill or payable amount). */
  pointsBaseAmount: number;
  pointsRatio: { points: number; rupees: number };
  purchasePointsPercentage: number;
  purchasePoints: number;
  purchasePointsRecipient: PurchasePointsRecipient;
  /** Referral QR only; 0 for direct bills. */
  referralPointsPercentage: number;
  referralPoints: number;
  settingsVersion: string;
}

export interface BillHistorySummary {
  billCount: number;
  billAmount: number;
  discountAmount: number;
  finalAmount: number;
  purchasePoints: number;
  referralPoints: number;
}

export type BillHistoryRange = 'today' | 'all';

export interface BillRecord extends Omit<BillCalculation, 'settingsVersion'> {
  /** Settings version the bill was calculated with; null for bills created before snapshots existed. */
  settingsVersion: string | null;
  id: ID;
  billNumber: string;
  qrType: QRCodeType;
  createdAt: string;
  outlet: { id: ID; name: string };
  partner: { id: ID; name: string; mobile: string; partnerCode: string } | null;
  referrerPartner: { id: ID; name: string; mobile: string; partnerCode: string } | null;
  customer: { id: ID; name: string; mobile: string; email: string | null } | null;
  notification: BillNotification;
}

export interface PointsLedgerEntry {
  id: ID;
  type: 'PURCHASE' | 'REFERRAL';
  points: number;
  billNumber: string;
  outletName: string;
  /** Set when the points were earned as a customer before registering and claimed on registration. */
  claimedAt: string | null;
  /** When these points leave the wallet; null when they never expire. */
  expiresAt: string | null;
  /** true once expiresAt has passed: the points no longer count towards the balance. */
  expired: boolean;
  createdAt: string;
}

export interface PartnerWallet {
  balancePoints: number;
  /** Balance converted with the current Super Admin points-to-rupees ratio. */
  rupeeValue: number;
  pointsRatio: { points: number; rupees: number };
  totals: { purchasePoints: number; referralPoints: number };
  entries: PointsLedgerEntry[];
}

export interface BillCreateResponse {
  bill: BillRecord;
  /** true when this response replays an already-completed bill (retry / double submit) */
  replayed: boolean;
}

// ============================================================================
// Super Admin: read-only insights (dashboard, partners, transactions)
// ============================================================================

export interface BillTotals {
  billCount: number;
  billAmount: number;
  discountAmount: number;
  finalAmount: number;
  purchasePoints: number;
  referralPoints: number;
}

export interface DailySalesPoint {
  /** IST calendar day, YYYY-MM-DD */
  date: string;
  billCount: number;
  billAmount: number;
}

export interface AdminDashboard {
  generatedAt: string;
  partners: {
    total: number;
    byStatus: Record<PartnerStatus, number>;
    byRole: Record<PartnerRole, number>;
    newLast30Days: number;
  };
  outlets: { total: number; active: number; inactive: number };
  transactions: {
    allTime: BillTotals;
    today: BillTotals;
    last30Days: BillTotals;
    /** The 30 days before last30Days, for trend comparison. */
    previous30Days: BillTotals;
    byType: Record<BillTransactionType, number>;
    daily: DailySalesPoint[];
  };
  points: {
    /** Points credited to registered partners. */
    creditedPoints: number;
    /** Points held against referred customers who have not registered yet. */
    pendingPoints: number;
    pointsRatio: { points: number; rupees: number };
  };
  notifications: Record<BillNotificationStatus, number>;
  topOutlets: { id: ID; name: string; status: OutletStatus; billCount: number; billAmount: number }[];
  recentBills: BillRecord[];
  recentPartners: AdminPartnerListItem[];
  system: {
    database: 'connected' | 'disconnected';
    settingsConfigured: boolean;
    settingsUpdatedAt: string | null;
    messagingMode: MessagingMode;
  };
}

export type AdminPartnerSort = 'newest' | 'oldest' | 'name';

export interface AdminPartnerListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: PartnerStatus;
  role?: PartnerRole;
  sort?: AdminPartnerSort;
}

export interface AdminPartnerListItem {
  id: ID;
  partnerCode: string;
  name: string;
  mobile: string;
  email: string;
  role: PartnerRole;
  isAchariyaAssociated: boolean;
  status: PartnerStatus;
  pointsBalance: number;
  directBillCount: number;
  referredBillCount: number;
  createdAt: string;
}

export interface AdminPartnerDetail extends AdminPartnerListItem {
  employeeId: string | null;
  admissionNumber: string | null;
  /** Name / department / grade of the matched Achariya record, when there is one. */
  achariyaRecord: { name: string; detail: string | null } | null;
  qrCodes: { id: ID; code: string; type: QRCodeType; status: QRCodeStatus; createdAt: string }[];
  wallet: PartnerWallet;
  directTotals: BillTotals;
  referredTotals: BillTotals;
  recentBills: BillRecord[];
  updatedAt: string;
}

export type AdminTransactionRange = 'today' | '7d' | '30d' | 'all';

export interface AdminTransactionListQuery {
  page?: number;
  limit?: number;
  search?: string;
  outletId?: string;
  partnerId?: string;
  type?: BillTransactionType;
  notification?: BillNotificationStatus;
  range?: AdminTransactionRange;
}

export interface AdminTransactionPage {
  bills: BillRecord[];
  meta: PaginationMeta;
  summary: BillTotals;
}

// ============================================================================
// Partner sign-in
// ============================================================================

/** `identifier` is the partner's registered 10-digit mobile number or email address. */
export interface PartnerLoginPayload {
  identifier: string;
  password: string;
}
