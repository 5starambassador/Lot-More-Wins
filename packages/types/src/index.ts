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
// Phase 2: Partner Onboarding & QR Code Types
// ============================================================================

export type QRCodeType = 'DEFAULT_DISCOUNT' | 'REFERRAL';
export type QRCodeStatus = 'ACTIVE' | 'REVOKED';
export type PartnerStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED';
export type MessagingMode = 'email' | 'whatsapp';

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

/** Every partner registers the same way; there is a single partner role. */
export interface PartnerOnboardingPayload {
  name: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  /** YYYY-MM-DD. Optional: the birthday step can be skipped. */
  dateOfBirth?: string | null;
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
  city: string | null;
  state: string | null;
  pincode: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  photoUrl: string | null;
  status: PartnerStatus;
  createdAt: string;
}

/**
 * Profile edit. Changing mobile or email requires a code verified within the last 15 minutes
 * (POST then PUT /auth/otp) for the new mobile, or for the current mobile when only the email changes.
 */
export interface UpdatePartnerProfilePayload {
  name?: string;
  mobile?: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  dateOfBirth?: string | null;
  photoUrl?: string | null;
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

export type OutletStatus = 'ACTIVE' | 'INACTIVE';
export type BillTransactionType = 'DIRECT_PARTNER' | 'REFERRAL';

/** Amount that purchase and referral point percentages are applied to. */
export type PointsBasis = 'BILL_AMOUNT' | 'PAYABLE_AMOUNT';

/** How the Partner App shows wallet values: as points, or as their rupee worth. */
export type WalletDisplay = 'POINTS' | 'RUPEES';

/**
 * What a platform's download link points at. DIRECT: an APK file (Android) or the web app /
 * a direct page (iOS). STORE: the Google Play / Apple App Store listing.
 */
export type AppLinkType = 'DIRECT' | 'STORE';

/** Partner App download links per platform (null url = not set). Public: the landing page reads them. */
export interface AppDownloadLinks {
  android: { url: string | null; type: AppLinkType };
  ios: { url: string | null; type: AppLinkType };
}

export interface ProgramSettings {
  messagingMode: MessagingMode;
  /** Direct partner QR: discount on the partner's first ever bill. */
  firstTimeDiscount: number;
  /** Days after registration a partner can still use the first-time discount. 0 = no expiry. */
  firstTimeValidityDays: number;
  /** Direct partner QR: discount on every later bill. */
  repeatDiscount: number;
  /** Direct partner QR: extra discount added on the partner's birthday. */
  birthdayBonusDiscount: number;
  /** Referral QR: discount for the referred customer. */
  referralDiscount: number;
  /** Successful referrals needed for one referral reward. */
  referralRewardGoal: number;
  /** Referral reward: special discount on the partner's next own purchase (Personal Discount QR). */
  referralRewardDiscount: number;
  pointsToRupees: { points: number; rupees: number };
  /** Referral QR: points percentage credited to the referring partner. */
  referralPointsPercentage: number;
  /** Purchase points percentage credited to whoever made the purchase. */
  purchasePointsPercentage: number;
  /** Days earned purchase points stay in the wallet. 0 = no expiry. */
  purchasePointsValidityDays: number;
  /** Days earned referral points stay in the wallet. 0 = no expiry. */
  referralPointsValidityDays: number;
  pointsBasis: PointsBasis;
  /** Partner app download / Play Store link sent in bill messages. */
  appDownloadUrl: string | null;
  /** Image attached to the Partner App's "Invite family & friends" message. null = the app logo. */
  inviteImageUrl: string | null;
  /** Show the "new version available" popup on the Partner App home page. */
  homePopupEnabled: boolean;
  /** The popup only shows on app versions older than this, e.g. "1.1.0"; null = every version. */
  latestAppVersion: string | null;
  /** Wallet values in the Partner App (wallet, history, notifications) as points or rupees. */
  walletDisplay: WalletDisplay;
  /** Partner App download link per platform and what it points at. */
  androidAppUrl: string | null;
  androidAppLinkType: AppLinkType;
  iosAppUrl: string | null;
  iosAppLinkType: AppLinkType;
  /** false when no row exists yet and runtime defaults are being served */
  isPersisted: boolean;
  updatedAt: string | null;
}

/** Settings added after the first release are optional: omitted keeps the stored value. */
export type UpdateProgramSettingsPayload = Omit<
  ProgramSettings,
  | 'isPersisted'
  | 'updatedAt'
  | 'inviteImageUrl'
  | 'homePopupEnabled'
  | 'latestAppVersion'
  | 'walletDisplay'
  | 'androidAppUrl'
  | 'androidAppLinkType'
  | 'iosAppUrl'
  | 'iosAppLinkType'
> & {
  androidAppUrl?: string | null;
  androidAppLinkType?: AppLinkType;
  iosAppUrl?: string | null;
  iosAppLinkType?: AppLinkType;
  inviteImageUrl?: string | null;
  homePopupEnabled?: boolean;
  latestAppVersion?: string | null;
  walletDisplay?: WalletDisplay;
};

/** Web panel pages an admin can be given (Super Admins have all of them, plus Admins). */
export type AdminPage = 'dashboard' | 'partners' | 'outlets' | 'transactions' | 'settings';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';

/** The signed-in panel account and what it may do. */
export interface SuperAdminProfile {
  id: ID;
  name: string;
  email: string;
  role: AdminRole;
  position: string | null;
  /** Pages this account may open; every page for a Super Admin. */
  pages: AdminPage[];
  /** May delete partners, outlets and transactions (on pages it has). Always true for a Super Admin. */
  canDelete: boolean;
}

/** A panel account as listed on the Admins page. */
export interface AdminAccount extends SuperAdminProfile {
  mobile: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminAccountPayload {
  name: string;
  email: string;
  mobile: string;
  position: string;
  pages: AdminPage[];
  canDelete: boolean;
  isActive?: boolean;
  password: string;
}

export type UpdateAdminAccountPayload = Partial<Omit<CreateAdminAccountPayload, 'isActive'> & { isActive: boolean }>;

/** An outlet in a filter dropdown. */
export interface AdminOutletOption {
  id: ID;
  name: string;
}

/** What the dashboard's "Reset" removed: every partner, guest customer, transaction and QR code. */
export interface AdminResetResult {
  partners: number;
  customers: number;
  bills: number;
  qrCodes: number;
  redemptions: number;
}

/** What deleting a partner or outlet also removes, shown before the admin confirms. */
export interface DeletionImpact {
  /** Bills (transactions) that are deleted with it. */
  bills: number;
  /** Wallet redemptions that are deleted with it. */
  redemptions: number;
  /** Points entries removed from wallets, including other partners' points earned on those bills. */
  pointsEntries: number;
  /** Outlet only: its outlet admin logins. */
  outletAdmins?: number;
}

export interface Outlet extends Timestamps {
  id: ID;
  name: string;
  email: string;
  mobile: string;
  description: string | null;
  address: string | null;
  /** Maps link for the outlet; the address is searched when null. */
  mapUrl: string | null;
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
  description?: string | null;
  address?: string | null;
  mapUrl?: string | null;
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
  description?: string | null;
  address?: string | null;
  mapUrl?: string | null;
  logoUrl?: string | null;
  images?: string[];
  status?: OutletStatus;
  adminPassword?: string;
}

export type UpdateOutletProfilePayload = Pick<
  UpdateOutletPayload,
  'name' | 'email' | 'mobile' | 'description' | 'address' | 'mapUrl' | 'logoUrl' | 'images'
>;

export interface MediaUploadPayload {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
}

export interface MediaUploadResponse {
  id: ID;
  url: string;
}

/** Outcome of a Super Admin test push to one partner's phones. */
export interface AdminTestPushResult {
  /** Phones registered for push for this partner. */
  devices: number;
  /** Notifications Expo accepted for delivery. */
  accepted: number;
  /** Distinct Expo error codes, e.g. DeviceNotRegistered or InvalidCredentials. */
  errors: string[];
}

/** A partner's QR as a branded PNG card (logo, title, QR and code), for download and sharing. */
export interface PartnerQrCardResponse {
  mimeType: 'image/png';
  base64: string;
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
}

/** Server-computed discount basis, taken from the Super Admin settings. */
export interface DiscountBasis {
  /** Direct QR: partner's first bill ever. Referral QR: null until the customer is known. */
  isFirstTime: boolean | null;
  /** Total discount, birthday bonus included. */
  discountPercentage: number;
  /** Direct QR on the partner's birthday: the bonus included in discountPercentage. Otherwise 0. */
  birthdayBonusPercentage: number;
  /** Direct QR with a referral reward waiting: the special discount used in place of the usual one. Otherwise 0. */
  referralRewardPercentage: number;
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
  isFirstTime: boolean;
  billAmount: number;
  /** Total discount, birthday bonus included. */
  discountPercentage: number;
  /** Part of discountPercentage that is the partner's birthday bonus; 0 on any other day. */
  birthdayBonusPercentage: number;
  /** Referral reward (special discount) used on this bill in place of the usual discount; 0 when none. */
  referralRewardPercentage: number;
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

/** Points spent at an outlet through the partner's redeem QR. */
export interface PointsRedemptionRecord {
  id: ID;
  points: number;
  rupeeValue: number;
  outletName: string;
  createdAt: string;
}

export interface PartnerWallet {
  /** Purchase + referral points still available (unexpired, not yet redeemed). */
  balancePoints: number;
  /** Balance converted with the current Super Admin points-to-rupees ratio. */
  rupeeValue: number;
  pointsRatio: { points: number; rupees: number };
  /** How the Partner App shows these values (Super Admin setting). */
  walletDisplay: WalletDisplay;
  /** Available points by source. */
  totals: { purchasePoints: number; referralPoints: number };
  entries: PointsLedgerEntry[];
  redemptions: PointsRedemptionRecord[];
}

/** Short-lived QR the partner shows at an outlet to spend wallet points. */
export interface RedeemQr {
  /** Value to render as the QR. Single use. */
  code: string;
  expiresAt: string;
  partner: { id: ID; partnerCode: string; name: string; mobile: string };
  /** Wallet snapshot when the QR was generated; the outlet always sees the live balance. */
  balancePoints: number;
  rupeeValue: number;
  pointsRatio: { points: number; rupees: number };
}

/** What the Outlet Admin sees after scanning a redeem QR. */
export interface RedeemScanResult {
  partner: ScannedPartner;
  balancePoints: number;
  rupeeValue: number;
  pointsRatio: { points: number; rupees: number };
  expiresAt: string;
}

export interface RedeemPayload {
  qrCode: string;
  /** Rupee value to take off the customer's bill; converted to points with the current ratio. */
  rupees: number;
  /** The customer's bill before the wallet is used. The redeemed amount cannot be more than this. */
  billAmount?: number;
}

export interface RedemptionReceipt {
  id: ID;
  points: number;
  rupeeValue: number;
  /** The bill the redemption was taken off; null for redemptions made before bills were recorded. */
  billAmount: number | null;
  /** What the customer pays after the wallet amount: billAmount - rupeeValue. */
  payableAmount: number | null;
  partner: ScannedPartner;
  outlet: { id: ID; name: string };
  /** Wallet balance after the redemption. */
  balancePoints: number;
  balanceRupeeValue: number;
  createdAt: string;
  /** true when this response replays an already-completed redemption of the same QR. */
  replayed: boolean;
}

// ============================================================================
// Partner home, notifications & push
// ============================================================================

/** Programme offers shown while registering; public. */
export interface PartnerOffers {
  firstTimeDiscount: number;
  birthdayBonusDiscount: number;
}

export interface PartnerHome {
  referrals: {
    /** Successful referrals (bills closed with this partner's referral QR) towards the next reward. Back to 0 once a reward is used. */
    successful: number;
    goal: number;
    /** Every successful referral ever, rewards used or not. */
    total: number;
    /** The goal is reached: the special discount applies to the next purchase with the Personal Discount QR. */
    rewardAvailable: boolean;
    /** The special discount percentage of the reward. */
    rewardDiscount: number;
  };
  offers: {
    /** Discount on the partner's first purchase. */
    firstTimeDiscount: number;
    /** false once the first purchase is made or the offer window has passed. */
    firstTimeAvailable: boolean;
    /** When the first-purchase offer lapses; null when it never does. */
    firstTimeExpiresAt: string | null;
    /** Extra discount on the partner's birthday. */
    birthdayBonusDiscount: number;
    repeatDiscount: number;
    /** Discount a referred customer gets by showing the partner's referral QR. */
    referralDiscount: number;
  };
  unreadNotifications: number;
  /** Partner app download link shared with the referral QR. */
  appDownloadUrl: string | null;
  /** Image the Super Admin chose for the invite message. null = attach the app logo. */
  inviteImageUrl: string | null;
  /** Show the "new version available" popup (with appDownloadUrl) on the home page. */
  homePopupEnabled: boolean;
  /** Only app versions older than this get the popup; null = every version. */
  latestAppVersion: string | null;
  walletDisplay: WalletDisplay;
  /** Download links per platform; the update popup uses the one for this phone. */
  appLinks: AppDownloadLinks;
}

export type PartnerNotificationType =
  | 'PURCHASE_POINTS'
  | 'REFERRAL_POINTS'
  | 'POINTS_CLAIMED'
  | 'POINTS_REDEEMED'
  | 'REFERRAL_REWARD';

export interface PartnerNotification {
  id: ID;
  type: PartnerNotificationType;
  title: string;
  body: string;
  points: number | null;
  /** Validity of the points the notification is about; null when they never expire or it does not apply. */
  expiresAt: string | null;
  read: boolean;
  createdAt: string;
}

export interface PartnerNotificationPage {
  notifications: PartnerNotification[];
  unread: number;
  meta: PaginationMeta;
}

export interface PushTokenPayload {
  /** Expo push token of this device. */
  token: string;
  platform?: 'ios' | 'android' | 'web';
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

/** One bucket of the dashboard trend: an IST day (YYYY-MM-DD) or month (YYYY-MM). */
export interface AdminTrendPoint {
  date: string;
  billCount: number;
  billAmount: number;
  discountAmount: number;
  /** Bills closed with a referral QR (successful referrals). */
  referralBills: number;
  /** Taps of "Share QR" on the referral QR page. */
  referralShares: number;
  newPartners: number;
  /** Purchase + referral points issued on bills. */
  pointsCredited: number;
  pointsRedeemed: number;
}

export interface DailySalesPoint {
  /** IST calendar day, YYYY-MM-DD */
  date: string;
  billCount: number;
  billAmount: number;
}

/** Inclusive IST date filter shared by the admin lists; either end may be left out. */
export interface AdminDateRangeQuery {
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
}

/** Where the dashboard figures come from: the database, or built-in sample figures for a demo. */
export type AdminDataSource = 'live' | 'test';

export interface AdminDashboardQuery extends AdminDateRangeQuery {
  source?: AdminDataSource;
  /** One outlet ("channel"): sales, billing, referral and redemption figures cover that outlet only. */
  outletId?: string;
}

export interface AdminDashboard {
  /** 'test' when every figure below is sample data and nothing was read from the database. */
  source: AdminDataSource;
  /**
   * The outlet the bill-based figures are limited to; null for every outlet. Partner counts,
   * wallet balances and QR shares are never tied to an outlet and stay programme-wide.
   */
  outlet: AdminOutletOption | null;
  generatedAt: string;
  /** The period every "in period" figure and chart below covers. */
  range: { from: string; to: string; days: number; granularity: 'day' | 'month' };
  /** The headline programme figures for the period (the two rows of tiles above the charts). */
  programMetrics: {
    /** Partners who registered in the period. */
    appRegistrations: number;
    /** Bills in the period that used an offer: first-purchase discount, referral reward or birthday bonus. */
    offerRedemptions: number;
    /** Partners who used an offer in the period, as a percentage of all registered partners. */
    offerRedemptionRate: number;
    /** Bills closed with a referral QR in the period. */
    successfulReferrals: number;
    /** Rupee cost of referral rewards in the period: referral points credited plus referral-reward discounts given. */
    referralBonus: number;
    /** Not recorded anywhere in the database yet; null until a source exists. */
    socialFollowersAdded: number | null;
    billingCount: number;
    /** Amount collected on programme bills in the period. */
    attributedSales: number;
  };
  /** Bill totals for the period, and for the equally long period just before it. */
  period: BillTotals;
  previousPeriod: BillTotals;
  trend: AdminTrendPoint[];
  periodByType: Record<BillTransactionType, { billCount: number; billAmount: number }>;
  /** Partners whose referral QR brought in the most bills in the period. */
  topReferrers: { id: ID; name: string; partnerCode: string; referralCount: number; billAmount: number; referralPoints: number }[];
  /** Referral funnel in the period. */
  referrals: { shares: number; successful: number; uniqueCustomers: number; rewardsUsed: number };
  /** Points issued on bills vs spent through redeem QRs, in the period. */
  pointsFlow: { credited: number; redeemed: number; redemptionCount: number; redeemedRupees: number };
  partners: {
    total: number;
    byStatus: Record<PartnerStatus, number>;
    newLast30Days: number;
    /** Registered within the period. */
    newInPeriod: number;
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

/** Dashboard search: partners and outlets matching one query. */
export interface AdminSearchResult {
  partners: AdminPartnerListItem[];
  outlets: AdminOutlet[];
}

export type AdminPartnerSort = 'newest' | 'oldest' | 'name';

export interface AdminPartnerListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: PartnerStatus;
  /** Partners with / without at least one successful referral. */
  referrals?: 'with' | 'without';
  sort?: AdminPartnerSort;
  /** Registration date range. */
  from?: string;
  to?: string;
}

export interface AdminPartnerListItem {
  id: ID;
  partnerCode: string;
  name: string;
  mobile: string;
  email: string;
  city: string | null;
  status: PartnerStatus;
  pointsBalance: number;
  directBillCount: number;
  referredBillCount: number;
  /** Taps of "Share QR" on the partner's referral QR page. */
  referralShareCount: number;
  createdAt: string;
}

/** All-time referral tracking of one partner. */
export interface AdminPartnerReferralTracking {
  /** Every successful referral (bill closed with the partner's referral QR). */
  total: number;
  uniqueCustomers: number;
  /** Successful referrals towards the next reward; goes back down when a reward is used. */
  progress: number;
  goal: number;
  rewardAvailable: boolean;
  rewardDiscount: number;
  /** Own bills that used a referral reward. */
  rewardsUsed: number;
  /** Taps of "Share QR". */
  shares: number;
}

export type AdminPartnerActivityKind = 'PURCHASE' | 'REFERRAL' | 'REDEMPTION' | 'SHARE';

/** One line of a partner's activity log. */
export interface AdminPartnerActivityRow {
  id: ID;
  kind: AdminPartnerActivityKind;
  createdAt: string;
  billNumber: string | null;
  outletName: string | null;
  /** REFERRAL: the referred customer. */
  customerName: string | null;
  customerMobile: string | null;
  billAmount: number | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  finalAmount: number | null;
  /** Points this activity gave the partner; negative for a redemption. */
  points: number;
  /** REDEMPTION: rupee value taken off the bill. */
  rupeeValue: number | null;
  /** e.g. "First bill", "Birthday bonus +5%", "Referral reward 20%". */
  note: string | null;
}

/** Totals for the partner's activity under the current date / outlet filter (all kinds). */
export interface AdminPartnerActivitySummary {
  purchases: { count: number; billAmount: number; discountAmount: number; points: number };
  referrals: { count: number; uniqueCustomers: number; billAmount: number; points: number };
  redemptions: { count: number; points: number; rupeeValue: number };
  shares: number;
}

export interface AdminPartnerActivityQuery extends AdminDateRangeQuery {
  page?: number;
  limit?: number;
  outletId?: string;
  kind?: AdminPartnerActivityKind;
}

export interface AdminPartnerActivityPage {
  rows: AdminPartnerActivityRow[];
  meta: PaginationMeta;
  summary: AdminPartnerActivitySummary;
}

export interface AdminOutletListQuery extends AdminDateRangeQuery {
  search?: string;
  status?: OutletStatus;
}

export interface AdminOutletRedemption {
  id: ID;
  createdAt: string;
  partner: { id: ID; name: string; partnerCode: string; mobile: string };
  points: number;
  rupeeValue: number;
}

export interface AdminOutletRedemptionsQuery extends AdminDateRangeQuery {
  page?: number;
  limit?: number;
}

export interface AdminOutletRedemptionsPage {
  redemptions: AdminOutletRedemption[];
  meta: PaginationMeta;
  summary: { count: number; points: number; rupeeValue: number };
}

export interface AdminPartnerDetail extends AdminPartnerListItem {
  state: string | null;
  pincode: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  photoUrl: string | null;
  qrCodes: { id: ID; code: string; type: QRCodeType; status: QRCodeStatus; createdAt: string }[];
  wallet: PartnerWallet;
  directTotals: BillTotals;
  referredTotals: BillTotals;
  recentBills: BillRecord[];
  referralTracking: AdminPartnerReferralTracking;
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
  /** Explicit date range; combined with `range` when both are given. */
  from?: string;
  to?: string;
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
