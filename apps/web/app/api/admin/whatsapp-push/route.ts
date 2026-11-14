import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getWhatsAppPushOverview } from '@/lib/whatsapp-push';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/whatsapp-push — WhatsApp push templates, their switches and send progress (Super Admin only). */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    return ok(await getWhatsAppPushOverview());
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/whatsapp-push');
  }
}
