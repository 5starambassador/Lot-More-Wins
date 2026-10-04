import { z } from 'zod';

/**
 * Common Primitive Validators
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number');

export const emailSchema = z
  .string()
  .trim()
  .email('Please enter a valid email address')
  .toLowerCase();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Health Check Schema
 */
export const healthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  service: z.string(),
  version: z.string().optional(),
  timestamp: z.string(),
  database: z
    .object({
      status: z.enum(['connected', 'disconnected', 'not_configured']),
      latencyMs: z.number().optional(),
    })
    .optional(),
});

/**
 * Phase 2 Validation Schemas
 */

export const otpSendSchema = z.object({
  identifier: z.string().trim().min(5, 'Mobile number or email is required'),
  name: z.string().trim().optional(),
  /** Delivery address used in email mode when the identifier is a mobile number. */
  email: emailSchema.optional(),
});

export const otpVerifySchema = z.object({
  identifier: z.string().trim().min(5, 'Mobile number or email is required'),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

const partnerNameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);

/** Calendar date as YYYY-MM-DD: a real date, not in the future and not more than 120 years ago. */
export const dateOfBirthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
  .refine((v) => {
    const [y, m, d] = v.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
    const now = new Date();
    return date.getTime() <= now.getTime() && y >= now.getUTCFullYear() - 120;
  }, 'Please enter a valid date of birth');

const partnerAddressFields = {
  city: z.string().trim().min(2, 'Please enter your city').max(80),
  state: z.string().trim().min(2, 'Please enter your state').max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, 'Please enter a valid 6-digit pincode'),
};

/** One registration path for every partner: contact, address, optional birthday, OTP and password. */
export const partnerOnboardingSchema = z
  .object({
    name: partnerNameSchema,
    mobile: phoneSchema,
    email: emailSchema,
    ...partnerAddressFields,
    dateOfBirth: dateOfBirthSchema.optional().nullable(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters'),
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PartnerOnboardingFormValues = z.infer<typeof partnerOnboardingSchema>;

/** Step-level schemas for the registration wizard (same rules as the full payload). */
export const partnerContactStepSchema = z.object({ name: partnerNameSchema, mobile: phoneSchema, email: emailSchema });
export const partnerAddressStepSchema = z.object(partnerAddressFields);


/**
 * Phase 3 Validation Schemas
 */

/** Normalizes +91 / 0 prefixes, spaces and dashes to a bare 10-digit Indian mobile. */
export function normalizeIndianMobile(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export const normalizedMobileSchema = z
  .string()
  .transform(normalizeIndianMobile)
  .pipe(phoneSchema);

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

export const percentageSchema = z
  .number({ invalid_type_error: 'Percentage must be a number' })
  .finite()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100')
  .refine(hasAtMostTwoDecimals, 'Percentage can have at most 2 decimal places');

const ratioPartSchema = z
  .number({ invalid_type_error: 'Ratio must be a number' })
  .finite()
  .positive('Ratio values must be greater than 0')
  .max(1_000_000, 'Ratio value is too large')
  .refine(hasAtMostTwoDecimals, 'Ratio can have at most 2 decimal places');

/** 0 means no expiry. */
const validityDaysSchema = z
  .number({ invalid_type_error: 'Validity must be a number of days' })
  .int('Validity must be a whole number of days')
  .min(0, 'Validity cannot be negative')
  .max(3650, 'Validity cannot exceed 3650 days')
  .default(0);

const appLinkUrlSchema = (label: string) =>
  z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), `${label} must be an http(s) URL`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const appLinkTypeSchema = z
  .enum(['DIRECT', 'STORE'], { errorMap: () => ({ message: 'Link type must be "DIRECT" or "STORE"' }) })
  .optional();

export const programSettingsUpdateSchema = z
  .object({
    messagingMode: z.enum(['email', 'whatsapp'], {
      errorMap: () => ({ message: 'Messaging mode must be "email" or "whatsapp"' }),
    }),
    firstTimeDiscount: percentageSchema,
    firstTimeValidityDays: validityDaysSchema,
    repeatDiscount: percentageSchema,
    birthdayBonusDiscount: percentageSchema,
    referralDiscount: percentageSchema,
    referralRewardGoal: z
      .number({ invalid_type_error: 'Referral goal must be a number' })
      .int('Referral goal must be a whole number')
      .min(1, 'Referral goal must be at least 1')
      .max(1000, 'Referral goal cannot exceed 1000'),
    referralRewardDiscount: percentageSchema,
    pointsToRupees: z.object({ points: ratioPartSchema, rupees: ratioPartSchema }).strict(),
    referralPointsPercentage: percentageSchema,
    purchasePointsPercentage: percentageSchema,
    purchasePointsValidityDays: validityDaysSchema,
    referralPointsValidityDays: validityDaysSchema,
    pointsBasis: z.enum(['BILL_AMOUNT', 'PAYABLE_AMOUNT'], {
      errorMap: () => ({ message: 'Points basis must be "BILL_AMOUNT" or "PAYABLE_AMOUNT"' }),
    }),
    /** Empty string clears the link. */
    appDownloadUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'App download link must be an http(s) URL')
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    /** Image attached to the partner invite message; null clears it, omitted keeps it. */
    inviteImageUrl: z.lazy(() => imageUrlSchema).nullable().optional(),
    homePopupEnabled: z.boolean({ invalid_type_error: 'Home popup must be on or off' }).optional(),
    /** e.g. "1.1.0"; empty string or null clears it, omitted keeps it. */
    latestAppVersion: z
      .string()
      .trim()
      .max(20)
      .refine((v) => v === '' || /^\d+(\.\d+){0,3}$/.test(v), 'Latest app version must look like 1.1.0')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    walletDisplay: z
      .enum(['POINTS', 'RUPEES'], { errorMap: () => ({ message: 'Wallet display must be "POINTS" or "RUPEES"' }) })
      .optional(),
    /** Empty string or null clears a link; omitted keeps it. */
    androidAppUrl: appLinkUrlSchema('Android download link'),
    androidAppLinkType: appLinkTypeSchema,
    iosAppUrl: appLinkUrlSchema('iOS download link'),
    iosAppLinkType: appLinkTypeSchema,
  })
  .strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

/** Either an absolute http(s) URL or an asset served by this API (/api/media/<uuid>). */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => /^https?:\/\/\S+$/i.test(v) || /^\/api\/media\/[0-9a-f-]{36}$/i.test(v),
    'Image must be an http(s) URL or an uploaded image'
  );

/** Gallery size limit of an outlet, enforced by the API and mirrored by the upload forms. */
export const MAX_OUTLET_IMAGES = 12;

/** Free text where an empty value means "not set". */
const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable();

const outletProfileFields = {
  name: z.string().trim().min(2, 'Outlet name must be at least 2 characters').max(120),
  email: emailSchema,
  mobile: normalizedMobileSchema,
  description: optionalTextSchema(1000),
  address: optionalTextSchema(300),
  /** Empty string clears the link. */
  mapUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Map link must be an http(s) URL')
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  logoUrl: imageUrlSchema.nullable(),
  images: z.array(imageUrlSchema).max(MAX_OUTLET_IMAGES, `At most ${MAX_OUTLET_IMAGES} outlet images are allowed`),
};

const outletPasswordSchema = z.string().min(8, 'Password must be at least 8 characters').max(200);

export const outletCreateSchema = z
  .object({
    ...outletProfileFields,
    description: outletProfileFields.description.optional(),
    address: outletProfileFields.address.optional(),
    mapUrl: outletProfileFields.mapUrl.optional(),
    logoUrl: outletProfileFields.logoUrl.optional(),
    images: outletProfileFields.images.optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    adminEmail: emailSchema,
    adminPassword: outletPasswordSchema,
  })
  .strict();

export const outletUpdateSchema = z
  .object({
    ...outletProfileFields,
    status: z.enum(['ACTIVE', 'INACTIVE']),
    adminPassword: outletPasswordSchema,
  })
  .partial()
  .strict();

/** Outlet Admins may edit profile fields only — never status or credentials. */
export const outletProfileUpdateSchema = z.object(outletProfileFields).partial().strict();

// ============================================================================
// Web panel admin accounts
// ============================================================================

/**
 * Pages a Super Admin can give an admin. "Admins" (account management) is never in this list:
 * only Super Admins have it.
 */
export const ADMIN_PAGES = ['dashboard', 'partners', 'outlets', 'transactions', 'settings'] as const;

export const ADMIN_PAGE_LABELS: Record<(typeof ADMIN_PAGES)[number], string> = {
  dashboard: 'Dashboard',
  partners: 'Partners',
  outlets: 'Outlets',
  transactions: 'Transactions',
  settings: 'Programme settings',
};

const adminPasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain letters and numbers');

const adminAccountFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
  mobile: normalizedMobileSchema,
  position: z.string().trim().min(2, 'Position must be at least 2 characters').max(80),
  pages: z.array(z.enum(ADMIN_PAGES)).max(ADMIN_PAGES.length).transform((pages) => [...new Set(pages)]),
  canDelete: z.boolean(),
  isActive: z.boolean(),
};

export const adminAccountCreateSchema = z
  .object({ ...adminAccountFields, isActive: adminAccountFields.isActive.optional(), password: adminPasswordSchema })
  .strict();

/** Every field optional; a password resets the account's password. */
export const adminAccountUpdateSchema = z.object({ ...adminAccountFields, password: adminPasswordSchema }).partial().strict();

export const mediaUploadSchema = z
  .object({
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    base64: z.string().min(1).max(4_000_000, 'Image is too large (max ~3 MB)'),
  })
  .strict();

export const qrCodeInputSchema = z.string().trim().min(1, 'QR code is required').max(512);

export const scanRequestSchema = z.object({ qrCode: qrCodeInputSchema }).strict();

export const billAmountSchema = z
  .number({ invalid_type_error: 'Bill amount must be a number' })
  .finite()
  .positive('Bill amount must be greater than 0')
  .max(10_000_000, 'Bill amount is too large')
  .refine(hasAtMostTwoDecimals, 'Bill amount can have at most 2 decimal places');

export const referredCustomerSchema = z
  .object({
    name: z.string().trim().min(2, 'Customer name must be at least 2 characters').max(100),
    mobile: normalizedMobileSchema,
    email: z
      .union([emailSchema, z.literal('')])
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .strict();

/**
 * Strict: any client attempt to send discount, partner type, first-time status,
 * outlet or partner identifiers is rejected rather than silently trusted.
 */
export const billPreviewSchema = z
  .object({
    qrCode: qrCodeInputSchema,
    billAmount: billAmountSchema,
    customer: referredCustomerSchema.optional(),
  })
  .strict();

export const billCreateSchema = billPreviewSchema
  .extend({
    idempotencyKey: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Invalid idempotency key'),
    settingsVersion: z.string().datetime({ message: 'Invalid settings version' }).optional(),
  })
  .strict();

export const billHistoryQuerySchema = paginationQuerySchema.extend({
  range: z.enum(['today', 'all']).default('all'),
});

export const customerLookupQuerySchema = z.object({ mobile: normalizedMobileSchema }).strict();

// ============================================================================
// Super Admin: read-only list queries
// ============================================================================

/** A real calendar date as YYYY-MM-DD (IST calendar on the server). */
const adminDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be in YYYY-MM-DD format')
  .refine((v) => {
    const [y, m, d] = v.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Please enter a valid date');

/**
 * Shared by every admin list: an inclusive from–to date filter (either end optional) and
 * `format=csv` to download the whole filtered result instead of one JSON page.
 */
const adminFilterFields = {
  from: adminDateSchema.optional(),
  to: adminDateSchema.optional(),
  format: z.enum(['json', 'csv']).default('json'),
};

const fromNotAfterTo = (v: { from?: string; to?: string }) => !v.from || !v.to || v.from <= v.to;
const fromNotAfterToError = { message: 'The start date cannot be after the end date', path: ['from'] };

export const adminPartnerListQuerySchema = paginationQuerySchema
  .extend({
    status: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED']).optional(),
    /** Partners with / without at least one successful referral. */
    referrals: z.enum(['with', 'without']).optional(),
    sort: z.enum(['newest', 'oldest', 'name']).default('newest'),
    ...adminFilterFields,
  })
  .refine(fromNotAfterTo, fromNotAfterToError);

export const adminTransactionListQuerySchema = paginationQuerySchema
  .extend({
    outletId: z.string().uuid().optional(),
    partnerId: z.string().uuid().optional(),
    type: z.enum(['DIRECT_PARTNER', 'REFERRAL']).optional(),
    notification: z.enum(['PENDING', 'SENT', 'FAILED', 'SKIPPED']).optional(),
    range: z.enum(['today', '7d', '30d', 'all']).default('all'),
    ...adminFilterFields,
  })
  .refine(fromNotAfterTo, fromNotAfterToError);

export const adminOutletListQuerySchema = z
  .object({
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    ...adminFilterFields,
  })
  .refine(fromNotAfterTo, fromNotAfterToError);

/** Single partner: the activity log (own purchases, successful referrals, redemptions, QR shares). */
export const adminPartnerActivityQuerySchema = paginationQuerySchema
  .extend({
    outletId: z.string().uuid().optional(),
    kind: z.enum(['PURCHASE', 'REFERRAL', 'REDEMPTION', 'SHARE']).optional(),
    ...adminFilterFields,
  })
  .refine(fromNotAfterTo, fromNotAfterToError);

/** Single outlet: wallet redemptions made there. */
export const adminOutletRedemptionsQuerySchema = paginationQuerySchema
  .extend(adminFilterFields)
  .refine(fromNotAfterTo, fromNotAfterToError);

/** Dashboard period; defaults to the last 30 days. */
export const adminDashboardQuerySchema = z
  .object({ ...adminFilterFields, source: z.enum(['live', 'test']).default('live'), outletId: z.string().trim().min(1).max(64).optional() })
  .refine(fromNotAfterTo, fromNotAfterToError);

/** Dashboard search across partners and outlets. */
export const adminSearchQuerySchema = z.object({ q: z.string().trim().min(1, 'Enter something to search for').max(100) });

/** Partner sign-in: registered mobile number (any common Indian format) or email, plus password. */
export const partnerLoginSchema = z
  .object({
    identifier: z.string().trim().min(3, 'Enter your mobile number or email').max(200),
    password: z.string().min(1, 'Password is required').max(200),
  })
  .transform(({ identifier, password }) => {
    if (identifier.includes('@')) return { kind: 'email' as const, value: identifier.toLowerCase(), password };
    return { kind: 'mobile' as const, value: normalizeIndianMobile(identifier), password };
  })
  .refine((v) => (v.kind === 'email' ? emailSchema.safeParse(v.value).success : /^[6-9]\d{9}$/.test(v.value)), {
    message: 'Enter a valid 10-digit mobile number or email address',
    path: ['identifier'],
  });

/** Partner profile edit: any subset of the registration details, plus the profile photo. */
export const partnerProfileUpdateSchema = z
  .object({
    name: partnerNameSchema,
    mobile: normalizedMobileSchema,
    email: emailSchema,
    ...partnerAddressFields,
    dateOfBirth: dateOfBirthSchema.nullable(),
    photoUrl: imageUrlSchema.nullable(),
  })
  .partial()
  .strict();

// ============================================================================
// Wallet redemption, notifications & push
// ============================================================================

export const redeemScanSchema = z.object({ qrCode: z.string().trim().min(1, 'QR code is required').max(1024) }).strict();

export const redeemSchema = z
  .object({
    qrCode: z.string().trim().min(1, 'QR code is required').max(1024),
    rupees: z
      .number({ invalid_type_error: 'Amount must be a number' })
      .finite()
      .positive('Amount must be greater than 0')
      .max(10_000_000, 'Amount is too large')
      .refine(hasAtMostTwoDecimals, 'Amount can have at most 2 decimal places'),
    billAmount: z
      .number({ invalid_type_error: 'Bill amount must be a number' })
      .finite()
      .positive('Bill amount must be greater than 0')
      .max(10_000_000, 'Bill amount is too large')
      .refine(hasAtMostTwoDecimals, 'Bill amount can have at most 2 decimal places')
      .optional(),
  })
  .strict()
  .refine((v) => v.billAmount === undefined || v.rupees <= v.billAmount, {
    message: 'The amount to redeem cannot be more than the bill',
    path: ['rupees'],
  });

/** Dashboard "Reset": the PIN that confirms it. */
export const adminResetSchema = z.object({ pin: z.string().min(1, 'Enter the PIN').max(100) }).strict();

export const pushTokenSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^(Expo|Exponent)PushToken\[[^\]]+\]$/, 'Invalid push token'),
    platform: z.enum(['ios', 'android', 'web']).optional(),
  })
  .strict();
