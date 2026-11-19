import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth';
import { changeCampaign, listRuns } from '@/lib/push-engine';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ action: z.enum(['pause', 'resume', 'cancel', 'sendNow']) }).strict();
const MESSAGES = { pause: 'Paused', resume: 'Resumed', cancel: 'Cancelled', sendNow: 'Sent' } as const;

/** GET /api/admin/push/campaigns/:id — its sends. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireSuperAdmin(req);
    return ok(await listRuns((await params).id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/push/campaigns/:id');
  }
}

/** PATCH /api/admin/push/campaigns/:id — pause, resume, cancel, or send once more now. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    await requireSuperAdmin(req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await changeCampaign((await params).id, parsed.data.action), 200, MESSAGES[parsed.data.action]);
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/admin/push/campaigns/:id');
  }
}
