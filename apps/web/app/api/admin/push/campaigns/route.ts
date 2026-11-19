import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { campaignSchema, createCampaign } from '@/lib/push-engine';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/admin/push/campaigns — push a template now, or schedule it (once, daily, weekly). */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    const parsed = campaignSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const result = await createCampaign(parsed.data, admin.name);
    return ok(result, 201, result.run ? 'Push sent' : 'Push scheduled');
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/push/campaigns');
  }
}
