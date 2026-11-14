import { NextRequest } from 'next/server';
import { z } from 'zod';
import { normalizedMobileSchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { sendTestMessage } from '@/lib/whatsapp-push';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({ mobile: normalizedMobileSchema }).strict();

/** POST /api/admin/whatsapp-push/:name/test — send the template to one number to check it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    await requireSuperAdmin(req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { name } = await params;
    return ok(await sendTestMessage(name, parsed.data.mobile), 200, 'Test message sent');
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/whatsapp-push/:name/test');
  }
}
