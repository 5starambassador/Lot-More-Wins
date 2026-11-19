import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { dispatchDuePushes, getOverview, listCampaigns, listRuns, listTemplates } from '@/lib/push-engine';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/push — the push engine page: reach, templates, campaigns and recent sends
 * (Super Admin only). Sends anything that is due first, so an open page also keeps schedules
 * going when the cron trigger is late.
 */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    try {
      await dispatchDuePushes();
    } catch (error) {
      console.error('Push dispatch from the admin page failed:', error);
    }
    const [overview, templates, campaigns, runs] = await Promise.all([getOverview(), listTemplates(), listCampaigns(), listRuns()]);
    return ok({ overview, templates, campaigns, runs });
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/push');
  }
}
