import { NextRequest } from 'next/server';
import { scanRequestSchema } from '@lotmorewins/validation';
import { requireOutletAdmin } from '@/lib/auth';
import { scanQr } from '@/lib/billing';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/outlet/scan — validate a scanned partner QR and return server-resolved partner details. */
export async function POST(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    const parsed = scanRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await scanQr(outlet, parsed.data.qrCode));
  } catch (error) {
    return handleRouteError(error, 'POST /api/outlet/scan');
  }
}
