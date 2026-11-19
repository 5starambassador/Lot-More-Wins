import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import { sendTestPush } from '@/lib/push-engine';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    partner: z.string().trim().min(3, 'Enter a partner code or mobile number').max(40),
    platforms: z.array(z.enum(['android', 'ios'])).min(1).default(['android', 'ios']),
  })
  .strict();

/** POST /api/admin/push/templates/:id/test — send the template to one partner only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin(req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await sendTestPush((await params).id, parsed.data.partner, parsed.data.platforms));
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/push/templates/:id/test');
  }
}
