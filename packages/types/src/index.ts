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

/** Who introduced the partner to the programme: the optional "Referred by" answer at registration. */
export type ReferredByType = 'PARTNER' | 'OUTLET' | 'MARKETING_REP' | 'OTHER';

export interface PartnerReferredByPayload {
  type: ReferredByType;
  /** PARTNER: the referring partner's ID (partner code) as typed. */
  partnerCode?: string;
  /** OUTLET: the outlet chosen from the list. */
  outletId?: string;
  /** OTHER: free text. */
  other?: string;
}

/** An outlet in the registration "Referred by" list. */
export interface OutletOption {
  id: ID;
  name: string;
}

/** Set by the Super Admin; decides the first-time discount and referral points a partner gets. */
export type PartnerCategory = 'ACHARIYA' | 'NON_ACHARIYA';

/** Every partner registers the same way; the Super Admin may classify them afterwards. */
export interface PartnerOnboardingPayload {
  name: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  /** YYYY-MM-DD. Optional: the birthday step can be skipped. */
  dateOfBirth?: string | null;
  /** Optional: omitted or null when the partner did not answer. */
  referredBy?: PartnerReferredByPayload | null;
  /** UPI ID (name@handle) for cash reward payouts. Not asked at registration; added later in Profile. */
  upiId?: string | null;
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
  /** Cash reward payouts go here; null until the partner adds it. */
  upiId: string | null;
  category: PartnerCategory;
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
  /** Changing it also moves payouts that are still Pending to the new UPI ID. */
  upiId?: string;
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
/** WALLET_REDEEM: paid partly from the partner's wallet with a redeem QR (no discount, no rewards). */
export type BillTransactionType = 'DIRECT_PARTNER' | 'REFERRAL' | 'WALLET_REDEEM';

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
  /**
   * Achariya partners' first-time discount and referral points %. firstTimeDiscount and
   * referralPointsPercentage above are the Non-Achariya values.
   */
  achariyaFirstTimeDiscount: number;
  achariyaReferralPointsPercentage: number;
  /** Cash reward % of the purchase, for the purchaser, at outlets with cash reward on. */
  cashRewardPurchasePercentage: number;
  /** Cash reward % of a referred friend's purchase, for the referring partner, at outlets with cash reward on. */
  cashRewardReferralPercentage: number;
  /** Weekly run that creates Pending payouts for balances at or above payoutMinimumAmount. */
  weeklyPayoutEnabled: boolean;
  payoutMinimumAmount: number;
  /** IST weekday of the weekly payout run: 0 = Sunday … 6 = Saturday. */
  payoutWeekday: number;
  /** The redeem QR for spending points at an outlet. Off by default: the revised flow has no redemption step. */
  redeemQrEnabled: boolean;
  /** false when no row exists yet and runtime defaults are being served */
  isPersisted: boolean;
  updatedAt: string | null;
}

type RevisedFlowSettingKey =
  | 'achariyaFirstTimeDiscount'
  | 'achariyaReferralPointsPercentage'
  | 'cashRewardPurchasePercentage'
  | 'cashRewardReferralPercentage'
  | 'weeklyPayoutEnabled'
  | 'payoutMinimumAmount'
  | 'payoutWeekday'
  | 'redeemQrEnabled';

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
  | RevisedFlowSettingKey
> &
  Partial<Pick<ProgramSettings, RevisedFlowSettingKey>> & {
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
export type AdminPage = 'dashboard' | 'partners' | 'outlets' | 'transactions' | 'settings' | 'finance';

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

/** What deleting a partner or outlet also removes, shown before the admin confirms. */
/** DELETE /admin/transactions/:id: what deleting the bill reversed. */
export interface BillDeletionResult {
  billNumber: string;
  pointsEntries: number;
  /** Wallet points given back because the bill's redeem QR payment was undone. */
  refundedPoints: number;
  /** Points already spent from this bill's credits, now taken from the same wallets' other points. */
  respentPoints: number;
  notifications: number;
}

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
  /** The outlet's discount label for the Partner App ("Flat 5% discount", "Up to 20% discount"). */
  offer?: OutletOfferSummary;
}

/** An outlet's own offer settings. A null discount uses the programme setting of the same type. */
export interface OutletOfferSettings {
  /** Non-Achariya partners' first purchase. */
  firstTimeDiscount: number | null;
  achariyaFirstTimeDiscount: number | null;
  repeatDiscount: number | null;
  /** A referred friend's purchase with a partner's referral QR. */
  referralDiscount: number | null;
  /** Charged on the discounted amount. */
  gstPercentage: number;
  /** Reward overrides; null = the programme setting. */
  purchasePointsPercentage: number | null;
  referralPointsPercentage: number | null;
  achariyaReferralPointsPercentage: number | null;
  /** Used only while givesCashReward is on. */
  cashRewardPurchasePercentage: number | null;
  cashRewardReferralPercentage: number | null;
  /** Bills here also credit the cash reward into the wallet. */
  givesCashReward: boolean;
  /** No longer enforced: every Outlet Admin may edit the outlet's slabs. Kept for older clients. */
  canEditOffers: boolean;
  /** Offer settings version, snapshotted on every bill. */
  updatedAt: string;
}

/** The discount each type actually gets at an outlet: its override, or the programme setting. */
export interface OutletEffectiveDiscounts {
  firstTimeDiscount: number;
  achariyaFirstTimeDiscount: number;
  repeatDiscount: number;
  referralDiscount: number;
}

/** The reward percentages each bill gets at an outlet: its override, or the programme setting. */
export interface OutletEffectiveRewards {
  purchasePointsPercentage: number;
  referralPointsPercentage: number;
  achariyaReferralPointsPercentage: number;
  cashRewardPurchasePercentage: number;
  cashRewardReferralPercentage: number;
}

export interface OutletOfferSummary {
  /** Highest discount the outlet gives (birthday bonus and referral reward aside). */
  maxDiscount: number;
  /** Every discount type is the same percentage. */
  isFlat: boolean;
  /** Always "Up to 20% discount" (never "Flat"): what a bill gets depends on the partner and the bill. */
  label: string;
  givesCashReward: boolean;
}

/** One changed field in the outlet offer audit log. */
export interface OutletOfferChangeRecord {
  id: ID;
  actorType: 'SUPER_ADMIN' | 'OUTLET_ADMIN';
  actorEmail: string;
  field: string;
  /** null = not set (uses the programme setting). */
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface AdminOutlet extends Outlet {
  adminEmail: string | null;
  billCount: number;
  offers: OutletOfferSettings;
  effectiveDiscounts: OutletEffectiveDiscounts;
  effectiveRewards: OutletEffectiveRewards;
}

/** Outlet Admin app: this outlet's offers, what they resolve to, and the recent change log. */
export interface OutletSettingsView {
  offers: OutletOfferSettings;
  effectiveDiscounts: OutletEffectiveDiscounts;
  /** The programme values a blank discount falls back to. */
  programmeDiscounts: OutletEffectiveDiscounts;
  effectiveRewards: OutletEffectiveRewards;
  /** The programme values a blank reward falls back to. */
  programmeRewards: OutletEffectiveRewards;
  summary: OutletOfferSummary;
  changes: OutletOfferChangeRecord[];
}

/** Outlet Admin edit of its slabs: null clears a discount back to the programme setting. */
export interface UpdateOutletOffersPayload {
  firstTimeDiscount?: number | null;
  achariyaFirstTimeDiscount?: number | null;
  repeatDiscount?: number | null;
  referralDiscount?: number | null;
  gstPercentage?: number;
  purchasePointsPercentage?: number | null;
  referralPointsPercentage?: number | null;
  achariyaReferralPointsPercentage?: number | null;
  cashRewardPurchasePercentage?: number | null;
  cashRewardReferralPercentage?: number | null;
}

/** Super Admin outlet create / edit: the Outlet Admin fields plus the cash reward and edit permission. */
export interface OutletOfferFieldsPayload extends UpdateOutletOffersPayload {
  givesCashReward?: boolean;
  canEditOffers?: boolean;
}

export interface CreateOutletPayload extends OutletOfferFieldsPayload {
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

export interface UpdateOutletPayload extends OutletOfferFieldsPayload {
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
  /** Direct QR: partner's first bill at this outlet. Referral QR: null until the customer is known. */
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
  /** This outlet's GST %, charged on the discounted amount. */
  gstPercentage: number;
  /** Bills here credit the cash reward wallet. */
  givesCashReward: boolean;
  /** Pricing version the scan was evaluated with (later of the programme settings and the outlet's offers). */
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
  /** Amount after discount, before GST (whole rupees). */
  taxableAmount: number;
  /** The outlet's GST %, charged on the taxable amount; 0 = no GST. */
  gstPercentage: number;
  gstAmount: number;
  /** WALLET_REDEEM only: wallet points spent and their rupee worth (at most half the bill); 0 otherwise. */
  walletRedeemPoints: number;
  walletRedeemAmount: number;
  /**
   * Paise added or taken off to bring the payable to whole rupees (−0.49 to +0.50); 0 on bills from
   * before round-off.
   */
  roundOffAmount: number;
  /** Final payable by the customer, whole rupees: taxableAmount + gstAmount − walletRedeemAmount + roundOffAmount. */
  finalAmount: number;
  /** Classification of the partner whose QR was scanned (first-time discount and referral points follow it). */
  partnerCategory: PartnerCategory;
  pointsBasis: PointsBasis;
  /** Amount the point and cash reward percentages were applied to (bill or taxable amount; never GST). */
  pointsBaseAmount: number;
  pointsRatio: { points: number; rupees: number };
  purchasePointsPercentage: number;
  purchasePoints: number;
  purchasePointsRecipient: PurchasePointsRecipient;
  /** Referral QR only; 0 for direct bills. */
  referralPointsPercentage: number;
  referralPoints: number;
  /** Cash reward (₹) for the purchaser, same recipient as the purchase points; 0 unless the outlet gives cash reward. */
  cashRewardPurchasePercentage: number;
  cashRewardPurchaseAmount: number;
  /** Referral QR only: cash reward (₹) for the referring partner. */
  cashRewardReferralPercentage: number;
  cashRewardReferralAmount: number;
  /** Pricing version: the later of the programme settings and the outlet's offer settings versions. */
  settingsVersion: string;
  /** The outlet's offer settings version used. */
  outletSettingsVersion: string;
}

export interface BillHistorySummary {
  billCount: number;
  billAmount: number;
  discountAmount: number;
  gstAmount: number;
  finalAmount: number;
  purchasePoints: number;
  referralPoints: number;
  /** Purchase + referral cash reward credited. */
  cashReward: number;
}

export type BillHistoryRange = 'today' | 'all';

export interface BillRecord extends Omit<BillCalculation, 'settingsVersion' | 'outletSettingsVersion' | 'partnerCategory'> {
  /** Programme settings version the bill was calculated with; null for bills created before snapshots existed. */
  settingsVersion: string | null;
  /** null for bills created before outlet offers existed. */
  outletSettingsVersion: string | null;
  /** null for bills created before the classification existed (they were all Non-Achariya). */
  partnerCategory: PartnerCategory | null;
  id: ID;
  billNumber: string;
  /** The permanent QR scanned; null on WALLET_REDEEM bills. */
  qrType: QRCodeType | null;
  createdAt: string;
  outlet: { id: ID; name: string };
  partner: { id: ID; name: string; mobile: string; partnerCode: string } | null;
  referrerPartner: {
    id: ID;
    name: string;
    mobile: string;
    partnerCode: string;
  } | null;
  customer: {
    id: ID;
    name: string;
    mobile: string;
    email: string | null;
  } | null;
  notification: BillNotification;
}

/**
 * PURCHASE / REFERRAL: points; CASHBACK_*: the cash reward, credited as points at the ratio;
 * TRANSFER_IN: from another partner; CASH_WALLET_MERGE: the cash reward balance moved in when the
 * two wallets became one.
 */
export type WalletEntryType = 'PURCHASE' | 'REFERRAL' | 'CASHBACK_PURCHASE' | 'CASHBACK_REFERRAL' | 'TRANSFER_IN' | 'CASH_WALLET_MERGE';

export interface PointsLedgerEntry {
  id: ID;
  type: WalletEntryType;
  points: number;
  /** null for entries without a bill (transfers, the merged cash balance). */
  billNumber: string | null;
  outletName: string | null;
  /** TRANSFER_IN: who sent it. */
  fromPartnerName: string | null;
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
  /** The redeem bill it paid part of; null for redemptions from before redeem bills. */
  billNumber: string | null;
  billAmount: number | null;
  createdAt: string;
}

/** A partner-to-partner wallet transfer, from this partner's side. */
export interface WalletTransferRecord {
  id: ID;
  transferNumber: string;
  direction: 'IN' | 'OUT';
  points: number;
  rupeeValue: number;
  /** The other partner. */
  counterparty: { name: string; mobile: string };
  createdAt: string;
}

/**
 * The partner's one wallet: purchase and referral points, cash rewards (credited as points),
 * transfers received; minus redemptions and transfers sent.
 */
export interface PartnerWallet {
  /** Everything still available (unexpired, not yet redeemed or sent). */
  balancePoints: number;
  /** Balance converted with the current Super Admin points-to-rupees ratio. */
  rupeeValue: number;
  pointsRatio: { points: number; rupees: number };
  /** How the Partner App shows these values (Super Admin setting). */
  walletDisplay: WalletDisplay;
  /** Available points by source. */
  totals: {
    purchasePoints: number;
    referralPoints: number;
    /** Cash rewards (purchase + referral) and the merged cash balance. */
    cashbackPoints: number;
    transferInPoints: number;
  };
  entries: PointsLedgerEntry[];
  redemptions: PointsRedemptionRecord[];
  transfers: WalletTransferRecord[];
  /** The redeem QR is turned on (Super Admin setting); the app hides it otherwise. */
  redeemEnabled: boolean;
  /** A redeem QR is worth the whole balance (the outlet takes at most half the bill). */
  redeemMaxPoints: number;
  redeemMaxRupees: number;
  /** The most one transfer can send: half the balance. */
  transferMaxPoints: number;
  transferMaxRupees: number;
  /**
   * @deprecated The cash wallet merged into this one and UPI payouts ended. Always empty; kept so
   * app versions from before the merge do not break.
   */
  cash: CashWallet;
}

/** Wallet page filter: one kind of transaction, or everything. */
export type PartnerTransactionFilter = 'ALL' | 'BILLS' | 'PURCHASE' | 'REFERRAL' | 'CASHBACK' | 'RECEIVED' | 'SENT' | 'REDEEMED';

/**
 * BILL: a bill this partner paid (with their discount QR, a friend's referral QR before they
 * registered, or their redeem QR). REWARD: a wallet credit (points, cashback, a transfer received,
 * the merged cash balance). SENT: a transfer to another partner. REDEEMED: a redemption from before
 * redeem bills (newer ones are BILL rows).
 */
export type PartnerTransactionKind = 'BILL' | 'REWARD' | 'SENT' | 'REDEEMED';

/** A bill as the partner sees it: their own purchase, or the purchase of a friend they referred. */
export interface PartnerTransactionBill {
  billNumber: string;
  outletName: string;
  transactionType: BillTransactionType;
  /** BUYER: this partner paid the bill. REFERRER: a friend paid it with this partner's referral QR. */
  role: 'BUYER' | 'REFERRER';
  /** REFERRER: the friend who bought. */
  buyerName: string | null;
  isFirstTime: boolean;
  billAmount: number;
  discountPercentage: number;
  discountAmount: number;
  birthdayBonusPercentage: number;
  referralRewardPercentage: number;
  /** After discount, before GST. */
  taxableAmount: number;
  gstPercentage: number;
  gstAmount: number;
  walletRedeemPoints: number;
  walletRedeemAmount: number;
  /** Paise added or taken off to reach whole rupees; 0 on bills from before round-off. */
  roundOffAmount: number;
  /** What the buyer paid the outlet. */
  finalAmount: number;
  createdAt: string;
}

/** A wallet credit a bill gave this partner. */
export interface PartnerTransactionReward {
  id: ID;
  type: WalletEntryType;
  points: number;
  rupeeValue: number;
  expiresAt: string | null;
  expired: boolean;
}

export interface PartnerTransaction {
  /** Unique across kinds, used for the details page: "bill_<id>", "entry_<id>", "transfer_<id>", "redemption_<id>". */
  id: string;
  kind: PartnerTransactionKind;
  /** REWARD: what the credit is. */
  entryType: WalletEntryType | null;
  /** Wallet points moved: positive in, negative out, 0 for a bill paid without the wallet. */
  points: number;
  /** Rupee worth of `points` (REWARD rows at the current ratio; the others as recorded). */
  rupeeValue: number;
  createdAt: string;
  outletName: string | null;
  /** BILL rows, and REWARD rows earned on a bill. */
  bill: PartnerTransactionBill | null;
  /** BILL: the credits this bill added to this partner's wallet. */
  rewards: PartnerTransactionReward[];
  /** REWARD: when it leaves the wallet; null when it never expires. */
  expiresAt: string | null;
  expired: boolean;
  /** REWARD: earned as a customer before registering, added on registration. */
  claimedAt: string | null;
  /** SENT: the recipient. REWARD TRANSFER_IN: the sender. */
  counterparty: { name: string; mobile: string } | null;
  /** Transfer number (SENT and received transfers). */
  reference: string | null;
  /** REDEEMED: the bill the redemption was taken off, when recorded. */
  redemptionBillAmount: number | null;
}

export interface PartnerTransactionsPage {
  items: PartnerTransaction[];
  /** More transactions match than were returned: ask again with a larger limit. */
  hasMore: boolean;
}

export interface PartnerTransactionsQuery {
  type?: PartnerTransactionFilter;
  /** Inclusive IST calendar dates, YYYY-MM-DD. */
  from?: string;
  to?: string;
  limit?: number;
}

export type CashEntryType = 'PURCHASE' | 'REFERRAL' | 'PAYOUT';
export type PayoutStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type PayoutSource = 'WEEKLY' | 'MANUAL';

export interface CashWalletEntry {
  id: ID;
  /** PURCHASE / REFERRAL credit the wallet; PAYOUT is the amount paid out. */
  type: CashEntryType;
  amount: number;
  billNumber: string | null;
  outletName: string | null;
  payoutNumber: string | null;
  /** Earned as a referred customer before registering, claimed on registration. */
  claimedAt: string | null;
  createdAt: string;
}

export interface PayoutRecord {
  id: ID;
  /** The payout ID on the Finance sheet. */
  payoutNumber: string;
  amount: number;
  status: PayoutStatus;
  source: PayoutSource;
  upiId: string;
  requestedAt: string;
  /** PAID: the amount Finance actually paid (the wallet went down by this). */
  paidAmount: number | null;
  /** PAID: YYYY-MM-DD. */
  paidOn: string | null;
  upiTxnRef: string | null;
  failureNote: string | null;
  settledAt: string | null;
}

export interface CashWallet {
  /** Credits minus amounts paid out. */
  balance: number;
  /** Held by Pending payouts. */
  pendingPayout: number;
  /** balance - pendingPayout: what a new payout request would be for. */
  available: number;
  upiId: string | null;
  /** Weekly run threshold. */
  minimumPayout: number;
  weeklyPayoutEnabled: boolean;
  /** 0 = Sunday … 6 = Saturday (IST). */
  payoutWeekday: number;
  /** A request would succeed now: UPI ID set, something available and no payout already Pending. */
  canRequestPayout: boolean;
  totals: { purchase: number; referral: number; paidOut: number };
  entries: CashWalletEntry[];
  payouts: PayoutRecord[];
}

export interface PayoutRequestResponse {
  payout: PayoutRecord;
  wallet: CashWallet;
}

/**
 * Short-lived, single-use QR the partner shows at an outlet to pay part of a bill from the wallet.
 * It is worth the whole wallet; at the outlet at most half the bill is taken, and whatever is not
 * used simply stays in the wallet (nothing is held when the QR is generated).
 */
export interface RedeemQr {
  /** Value to render as the QR. Single use. */
  code: string;
  expiresAt: string;
  partner: { id: ID; partnerCode: string; name: string; mobile: string };
  /** Wallet snapshot when the QR was generated; the outlet always sees the live balance. */
  balancePoints: number;
  rupeeValue: number;
  /** What this QR is worth at most: the whole balance. */
  maxPoints: number;
  maxRupees: number;
  pointsRatio: { points: number; rupees: number };
}

/** What the Outlet Admin sees after scanning a redeem QR, before entering the bill. */
export interface RedeemScanResult {
  partner: ScannedPartner;
  balancePoints: number;
  rupeeValue: number;
  /** The QR's worth (capped by the live balance). At most half the bill is taken. */
  maxPoints: number;
  maxRupees: number;
  pointsRatio: { points: number; rupees: number };
  /** This outlet's GST %, charged on the bill. */
  gstPercentage: number;
  expiresAt: string;
  /** Pricing version for the bill preview / create calls. */
  settingsVersion: string;
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
  /** Highest discount any active outlet gives ("Get up to X%"); null when there is no active outlet. */
  maxOutletDiscount: number | null;
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
  /** Highest discount this partner can get at any active outlet; null when there is none. */
  maxOutletDiscount: number | null;
  /** Active outlets with their own discount label. */
  outlets: Outlet[];
  /** @deprecated The cash wallet merged into the one wallet. Always 0. */
  cashBalance: number;
  /** @deprecated UPI payouts ended. Always false. */
  upiMissing: boolean;
  redeemEnabled: boolean;
}

export type PartnerNotificationType =
  | 'PURCHASE_POINTS'
  | 'REFERRAL_POINTS'
  | 'POINTS_CLAIMED'
  | 'POINTS_REDEEMED'
  | 'REFERRAL_REWARD'
  | 'BILL_RECEIPT'
  | 'CASH_REWARD'
  | 'PAYOUT_REQUESTED'
  | 'PAYOUT_PAID'
  | 'PAYOUT_FAILED'
  | 'WALLET_TRANSFER_IN'
  | 'WALLET_TRANSFER_OUT';

export interface PartnerNotification {
  id: ID;
  type: PartnerNotificationType;
  title: string;
  body: string;
  points: number | null;
  /** Rupee amount for cash reward and payout notifications. */
  amount: number | null;
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

// ============================================================================
// Partner-to-partner wallet transfer
// ============================================================================

/** The partner registered with a mobile number, shown before sending. */
export interface WalletTransferRecipient {
  name: string;
  partnerCode: string;
  mobile: string;
}

export interface WalletTransferOtpPayload {
  mobile: string;
  points: number;
}

/** The confirmation code went out on the Super Admin's messaging channel. */
export interface WalletTransferOtpResponse {
  mode: MessagingMode;
  /** Masked email address or mobile number of the sender. */
  destination: string;
  expiresAt: string;
  /** Only in development (or with ENABLE_DEV_OTP=true). */
  devOtp?: string;
}

export interface WalletTransferPayload {
  mobile: string;
  /** Wallet points to send. */
  points: number;
  otp: string;
  idempotencyKey: string;
}

export interface WalletTransferResponse {
  transfer: WalletTransferRecord;
  /** The sender's balance after the transfer. */
  balancePoints: number;
  rupeeValue: number;
  /** true when this response replays an already-completed transfer of the same key. */
  replayed: boolean;
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
  gstAmount: number;
  finalAmount: number;
  purchasePoints: number;
  referralPoints: number;
  /** Purchase + referral cash reward credited. */
  cashReward: number;
  /** Paid from partner wallets on redeem bills (not in finalAmount, which is what customers paid). */
  walletRedeemAmount: number;
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
  range: {
    from: string;
    to: string;
    days: number;
    granularity: 'day' | 'month';
  };
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
  topReferrers: {
    id: ID;
    name: string;
    partnerCode: string;
    referralCount: number;
    billAmount: number;
    referralPoints: number;
  }[];
  /** Referral funnel in the period. */
  referrals: {
    shares: number;
    successful: number;
    uniqueCustomers: number;
    rewardsUsed: number;
  };
  /** Points issued on bills vs spent through redeem QRs, in the period. */
  pointsFlow: {
    credited: number;
    redeemed: number;
    redemptionCount: number;
    redeemedRupees: number;
  };
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
  topOutlets: {
    id: ID;
    name: string;
    status: OutletStatus;
    billCount: number;
    billAmount: number;
  }[];
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

/** A partner's "Referred by" answer from registration, as shown in the Super Admin panel. */
export interface AdminPartnerReferredBy {
  type: ReferredByType;
  /** The partner ID typed, the outlet's name, or the "Others" text; null for a marketing rep. */
  detail: string | null;
  /** PARTNER: the partner the typed ID matched; null when it matched none. */
  partner: { id: ID; name: string; partnerCode: string } | null;
  /** OUTLET: the chosen outlet; null once that outlet has been deleted. */
  outlet: AdminOutletOption | null;
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
  /** null when the partner did not answer "Referred by". */
  referredBy: AdminPartnerReferredBy | null;
  category: PartnerCategory;
  upiId: string | null;
  /** Cash reward wallet balance (₹), Pending payouts included. */
  cashBalance: number;
  createdAt: string;
}

/** Super Admin partner edit: activate / deactivate and classification. */
export interface UpdateAdminPartnerPayload {
  status?: PartnerStatus;
  category?: PartnerCategory;
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
  purchases: {
    count: number;
    billAmount: number;
    discountAmount: number;
    points: number;
  };
  referrals: {
    count: number;
    uniqueCustomers: number;
    billAmount: number;
    points: number;
  };
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
  qrCodes: {
    id: ID;
    code: string;
    type: QRCodeType;
    status: QRCodeStatus;
    createdAt: string;
  }[];
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
// Finance: partner wallets and payouts (Super Admin panel, "finance" page)
// ============================================================================

export interface FinancePartnerRef {
  id: ID;
  name: string;
  partnerCode: string;
  mobile: string;
  upiId: string | null;
  category: PartnerCategory;
}

export interface FinancePartnerBalance {
  partner: FinancePartnerRef;
  /** Cash reward credited in the date range (all time without one). */
  earned: number;
  /** Paid out in the date range (all time without one). */
  paid: number;
  /** Current balance, Pending payouts included. */
  balance: number;
  pending: number;
  available: number;
}

export interface FinancePayoutRow extends PayoutRecord {
  partner: FinancePartnerRef;
}

export interface FinanceReportQuery extends AdminDateRangeQuery {
  search?: string;
  partnerId?: string;
  status?: PayoutStatus;
  page?: number;
  limit?: number;
}

export interface FinanceReport {
  totals: {
    /** All partners, current. */
    balance: number;
    pending: number;
    available: number;
    partnersWithBalance: number;
    /** In the date range (all time without one). */
    earned: number;
    paid: number;
    pendingCount: number;
  };
  /** Partners with a balance or activity, largest balance first. */
  balances: FinancePartnerBalance[];
  /** Payouts requested in the date range, newest first. */
  payouts: FinancePayoutRow[];
  meta: PaginationMeta;
}

export interface PayoutUploadPayload {
  fileName: string;
  /** The .xlsx (or .csv) file, base64. */
  base64: string;
  /** false: validate and preview only. true: validate again and apply everything in one transaction. */
  apply: boolean;
}

export type PayoutSheetAction = 'PAID' | 'FAILED' | 'UNCHANGED' | 'ERROR';

export interface PayoutSheetRowResult {
  /** Row number in the sheet (the header is row 1). */
  row: number;
  payoutNumber: string | null;
  partnerName: string | null;
  amount: number | null;
  action: PayoutSheetAction;
  /** Why an UNCHANGED row changes nothing, e.g. "Already paid by an earlier upload". */
  note: string | null;
  errors: string[];
}

export interface PayoutUploadResult {
  applied: boolean;
  /** Set once applied. */
  uploadId: string | null;
  fileName: string;
  rowCount: number;
  paidCount: number;
  failedCount: number;
  unchangedCount: number;
  errorCount: number;
  paidAmount: number;
  rows: PayoutSheetRowResult[];
}

export interface PayoutUploadRecord {
  id: ID;
  fileName: string;
  uploadedByEmail: string;
  rowCount: number;
  paidCount: number;
  failedCount: number;
  unchangedCount: number;
  paidAmount: number;
  createdAt: string;
}

/** Outcome of one weekly payout run. */
export interface WeeklyPayoutRunResult {
  weekKey: string;
  /** false when today is not the payout weekday or the weekly run is off (nothing was created). */
  ran: boolean;
  reason: string | null;
  created: number;
  createdAmount: number;
  /** Balances at or above the minimum that have no UPI ID yet. */
  skippedNoUpi: number;
  /** Already had a Pending payout, or this week's payout exists. */
  skippedExisting: number;
}

// ============================================================================
// Partner sign-in
// ============================================================================

/**
 * Partners sign in with a one-time code only (no password). `identifier` is the partner's
 * registered 10-digit mobile number or email address; the code goes out on the channel the
 * Super Admin chose in Settings (email or WhatsApp), never one the partner picks.
 */
export interface PartnerLoginOtpRequestPayload {
  identifier: string;
}

/** POST /partner/onboarding/check: which of the entered contact details are already registered. */
export interface PartnerRegistrationCheckPayload {
  mobile: string;
  email: string;
}

export interface PartnerRegistrationCheckResponse {
  mobileTaken: boolean;
  emailTaken: boolean;
}

export interface PartnerLoginOtpResponse {
  /** The channel the code was sent on (the Super Admin messaging setting). */
  mode: MessagingMode;
  /** Masked email address or mobile number the code was sent to, for display. */
  destination: string;
  expiresAt: string;
  /** Seconds until another code can be requested (absent from servers before the resend gap). */
  resendAfterSec?: number;
  /** Only in development (or with ENABLE_DEV_OTP=true). */
  devOtp?: string;
}

export interface PartnerLoginPayload {
  identifier: string;
  otp: string;
}
