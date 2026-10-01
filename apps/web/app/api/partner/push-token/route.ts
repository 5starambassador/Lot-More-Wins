import { NextRequest } from 'next/server';
import { pushTokenSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requirePartnerId } from '@/lib/auth';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/push-token — register this device for the partner's push notifications.
 * A token belongs to one device: registering it moves it to the partner now signed in there.
 */
export async function POST(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = pushTokenSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);
    const { token, platform } = parsed.data;

    await prisma.pushDevice.upsert({
      where: { token },
      create: { token, partnerId, platform: platform ?? null },
      update: { partnerId, platform: platform ?? null },
    });
    return ok({ registered: true });
  } catch (error) {
    return handleRouteError(error, 'POST /api/partner/push-token');
  }
}

/** DELETE /api/partner/push-token?token=… — stop pushing to this device (sign-out). */
export async function DELETE(req: NextRequest) {
  try {
    const partnerId = requirePartnerId(req);
    const parsed = pushTokenSchema.safeParse({ token: req.nextUrl.searchParams.get('token') ?? '' });
    if (!parsed.success) return validationError(parsed.error);

    const removed = await prisma.pushDevice.deleteMany({ where: { token: parsed.data.token, partnerId } });
    return ok({ removed: removed.count > 0 });
  } catch (error) {
    return handleRouteError(error, 'DELETE /api/partner/push-token');
  }
}
