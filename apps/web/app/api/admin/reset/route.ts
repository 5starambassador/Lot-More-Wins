import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { adminResetSchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { resetProgrammeData } from '@/lib/admin-deletions';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** The PIN that confirms a reset. ADMIN_RESET_PIN replaces the built-in one without a code change. */
const RESET_PIN = process.env.ADMIN_RESET_PIN || 'lotmorewins@26';

function pinMatches(pin: string): boolean {
  const digest = (value: string) => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(digest(pin), digest(RESET_PIN));
}

/**
 * POST /api/admin/reset — removes every partner, guest customer, transaction and QR code.
 * Super Admin only, and only with the reset PIN. Outlets, outlet admins, panel accounts,
 * settings and media stay as they are. This cannot be undone.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    const parsed = adminResetSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    if (!pinMatches(parsed.data.pin)) return fail(403, 'The PIN is not correct', 'INVALID_PIN');

    const removed = await resetProgrammeData();
    console.warn(`Programme data reset by ${admin.email}:`, removed);
    return ok(removed, 200, 'Partners, customers, transactions and QR codes removed');
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/reset');
  }
}
