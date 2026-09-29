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
 * Base Entity Validation Schemas (Foundation for Phase 2+)
 */
export const partnerRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: phoneSchema,
  email: emailSchema.optional().nullable(),
});

export const outletSchema = z.object({
  name: z.string().min(2, 'Outlet name must be at least 2 characters'),
  code: z.string().min(2).max(20).toUpperCase(),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/, 'Please enter a valid 6-digit PIN code'),
  phone: phoneSchema,
});

export const billCreateSchema = z.object({
  outletId: z.string().min(1, 'Outlet ID is required'),
  customerPhone: phoneSchema,
  customerName: z.string().optional().nullable(),
  billNumber: z.string().min(1, 'Bill number is required'),
  subtotal: z.number().positive('Subtotal must be positive'),
  discountAmount: z.number().nonnegative('Discount amount cannot be negative').default(0),
  qrCode: z.string().optional().nullable(),
});
