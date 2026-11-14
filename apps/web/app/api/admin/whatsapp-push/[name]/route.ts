import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import { getWhatsAppPushOverview, setTemplateApproved } from '@/lib/whatsapp-push';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const schema = z.object({ approved: z.boolean() }).strict();

/** PUT /api/admin/whatsapp-push/:name — turn a template on (approved in MSG91) or off. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const admin = await requireSuperAdmin(req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { name } = await params;
    await setTemplateApproved(name, parsed.data.approved, admin.name);
    return ok(await getWhatsAppPushOverview(), 200, parsed.data.approved ? 'Template turned on' : 'Template turned off');
  } catch (error) {
    return handleRouteError(error, 'PUT /api/admin/whatsapp-push/:name');
  }
}
