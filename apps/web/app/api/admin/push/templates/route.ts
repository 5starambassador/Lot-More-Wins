import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createTemplate, templateSchema } from '@/lib/push-engine';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** POST /api/admin/push/templates — a new push template. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    const parsed = templateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await createTemplate(parsed.data, admin.name), 201, 'Template created');
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/push/templates');
  }
}
