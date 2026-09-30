import { NextRequest, NextResponse } from 'next/server';
import { adminPartnerListQuerySchema } from '@lotmorewins/validation';
import { requireSuperAdmin } from '@/lib/auth';
import { listPartners } from '@/lib/admin-insights';
import { handleRouteError, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** GET /api/admin/partners?page&limit&search&status&role&sort — read-only partner directory. */
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const parsed = adminPartnerListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const { page, limit } = parsed.data;

    const { total, partners } = await listPartners(parsed.data);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      data: partners,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/admin/partners');
  }
}
