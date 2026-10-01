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

export const validateEmployeeSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(3, 'Employee ID must be at least 3 characters')
    .toUpperCase(),
  role: z.enum(['STAFF', 'TEACHER']).optional(),
});

export const validateAdmissionSchema = z.object({
  admissionNumber: z
    .string()
    .trim()
    .min(3, 'Admission number must be at least 3 characters')
    .toUpperCase(),
});

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

export const partnerOnboardingSchema = z
  .object({
    isAchariyaAssociated: z.boolean(),
    role: z.enum(['NON_ACHARIYA', 'STAFF', 'TEACHER', 'PARENT']),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    mobile: phoneSchema,
    email: emailSchema,
    employeeId: z.string().trim().toUpperCase().optional().nullable(),
    admissionNumber: z.string().trim().toUpperCase().optional().nullable(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters'),
    otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.isAchariyaAssociated === (data.role !== 'NON_ACHARIYA'), {
    message: 'Achariya association does not match the selected role',
    path: ['isAchariyaAssociated'],
  })
  .refine(
    (data) => {
      if (data.isAchariyaAssociated && (data.role === 'STAFF' || data.role === 'TEACHER')) {
        return !!data.employeeId && data.employeeId.length >= 3;
      }
      return true;
    },
    {
      message: 'Valid Employee ID is required for Achariya Staff / Teachers',
      path: ['employeeId'],
    }
  )
  .refine(
    (data) => {
      if (data.isAchariyaAssociated && data.role === 'PARENT') {
        return !!data.admissionNumber && data.admissionNumber.length >= 3;
      }
      return true;
    },
    {
      message: "Valid Child's Admission Number is required for Achariya Parents",
      path: ['admissionNumber'],
    }
  );

export type PartnerOnboardingFormValues = z.infer<typeof partnerOnboardingSchema>;


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

const classificationPercentagesSchema = z
  .object({ achariya: percentageSchema, nonAchariya: percentageSchema })
  .strict();

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

export const programSettingsUpdateSchema = z
  .object({
    messagingMode: z.enum(['email', 'whatsapp'], {
      errorMap: () => ({ message: 'Messaging mode must be "email" or "whatsapp"' }),
    }),
    firstTimeDiscount: classificationPercentagesSchema,
    firstTimeValidityDays: validityDaysSchema,
    repeatDiscount: classificationPercentagesSchema,
    referralDiscount: classificationPercentagesSchema,
    pointsToRupees: z.object({ points: ratioPartSchema, rupees: ratioPartSchema }).strict(),
    referralPoints: classificationPercentagesSchema,
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

const outletProfileFields = {
  name: z.string().trim().min(2, 'Outlet name must be at least 2 characters').max(120),
  email: emailSchema,
  mobile: normalizedMobileSchema,
  logoUrl: imageUrlSchema.nullable(),
  images: z.array(imageUrlSchema).max(10, 'At most 10 outlet images are allowed'),
};

const outletPasswordSchema = z.string().min(8, 'Password must be at least 8 characters').max(200);

export const outletCreateSchema = z
  .object({
    ...outletProfileFields,
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

export const adminPartnerListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED', 'REJECTED']).optional(),
  role: z.enum(['NON_ACHARIYA', 'STAFF', 'TEACHER', 'PARENT']).optional(),
  sort: z.enum(['newest', 'oldest', 'name']).default('newest'),
});

export const adminTransactionListQuerySchema = paginationQuerySchema.extend({
  outletId: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
  type: z.enum(['DIRECT_PARTNER', 'REFERRAL']).optional(),
  notification: z.enum(['PENDING', 'SENT', 'FAILED', 'SKIPPED']).optional(),
  range: z.enum(['today', '7d', '30d', 'all']).default('all'),
});

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
