import { NextRequest } from 'next/server';
import { programSettingsUpdateSchema } from '@lotmorewins/validation';
import { requireAdmin } from '@/lib/auth';
import { getProgramSettings, updateProgramSettings } from '@/lib/settings';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/settings — current programme settings (Super Admin only). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req, 'settings');
    return ok(await getProgramSettings());
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/settings');
  }
}

/** PUT /api/admin/settings — replace programme settings (Super Admin only). */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req, 'settings');
    const parsed = programSettingsUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    return ok(await updateProgramSettings(parsed.data, admin.id), 200, 'Settings saved');
  } catch (error) {
    return handleRouteError(error, 'PUT /api/admin/settings');
  }
}
