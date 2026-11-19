import { NextRequest } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { deleteTemplate, getTemplateItem, templateSchema, updateTemplate } from '@/lib/push-engine';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/push/templates/:id */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await requireSuperAdmin(req);
    return ok(await getTemplateItem((await params).id));
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/push/templates/:id');
  }
}

/** PUT /api/admin/push/templates/:id — edit. Campaigns already made keep their own copy. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    await requireSuperAdmin(req);
    const parsed = templateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await updateTemplate((await params).id, parsed.data), 200, 'Template saved');
  } catch (error) {
    return handleRouteError(error, 'PUT /api/admin/push/templates/:id');
  }
}

/** DELETE /api/admin/push/templates/:id — scheduled campaigns from it keep going. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    await requireSuperAdmin(req);
    await deleteTemplate((await params).id);
    return ok({ deleted: true }, 200, 'Template deleted');
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/admin/push/templates/:id');
  }
}
