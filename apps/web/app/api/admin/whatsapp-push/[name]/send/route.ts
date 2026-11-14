import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { sendNextBatch } from '@/lib/whatsapp-push';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/whatsapp-push/:name/send — send the template to the next batch of active
 * partners (starting the run on the first call). Call again until the status is 'sent'.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const admin = await requireSuperAdmin(req);
    const { name } = await params;
    return ok(await sendNextBatch(name, admin.name));
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/whatsapp-push/:name/send');
  }
}
