import { NextRequest } from 'next/server';
import type { AdminTestPushResult } from '@lotmorewins/types';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { sendPush } from '@/lib/push';
import { fail, handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/partners/:id/test-push — sends a test notification to the partner's phones
 * and reports what Expo accepted, to check push delivery without creating a bill.
 * Nothing is added to the partner's Notifications page.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req, 'partners');
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');
    const partner = await prisma.partner.findUnique({ where: { id }, select: { id: true } });
    if (!partner) return fail(404, 'Partner not found', 'PARTNER_NOT_FOUND');

    const result = await sendPush([
      {
        partnerId: partner.id,
        title: 'Lot More Wins notifications are on',
        body: 'You will get an alert here whenever you earn, receive or redeem rewards.',
        data: { type: 'TEST' },
      },
    ]);
    const data: AdminTestPushResult = { ...result, errors: [...new Set(result.errors)] };
    return ok(data);
  } catch (error) {
    return handleRouteError(error, 'POST /api/admin/partners/[id]/test-push');
  }
}
