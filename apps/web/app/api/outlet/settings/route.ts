import { NextRequest } from 'next/server';
import type { Outlet as OutletRow } from '@prisma/client';
import type { OutletSettingsView } from '@lotmorewins/types';
import { outletOffersUpdateSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { requireOutletAdmin } from '@/lib/auth';
import { getProgramSettings } from '@/lib/settings';
import {
  applyOfferChanges,
  effectiveDiscounts,
  effectiveRewards,
  listOfferChanges,
  offerSummary,
  programmeDiscounts,
  programmeRewards,
  serializeOfferSettings,
} from '@/lib/outlet-offers';
import { handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

async function view(outlet: OutletRow): Promise<OutletSettingsView> {
  const [settings, changes] = await Promise.all([getProgramSettings(), listOfferChanges(outlet.id, 20)]);
  const effective = effectiveDiscounts(settings, outlet);
  return {
    offers: serializeOfferSettings(outlet),
    effectiveDiscounts: effective,
    programmeDiscounts: programmeDiscounts(settings),
    effectiveRewards: effectiveRewards(settings, outlet),
    programmeRewards: programmeRewards(settings),
    summary: offerSummary(effective, outlet.givesCashReward),
    changes,
  };
}

/** GET /api/outlet/settings — this outlet's discounts, rewards, GST and cash reward, and the change log. */
export async function GET(req: NextRequest) {
  try {
    const { outlet } = await requireOutletAdmin(req);
    return ok(await view(outlet));
  } catch (error) {
    return handleRouteError(error, 'GET /api/outlet/settings');
  }
}

/**
 * PATCH /api/outlet/settings — change this outlet's slabs: discounts, reward rates and GST. Every
 * Outlet Admin may do this; whether the outlet gives cash reward stays Super Admin only. Every
 * changed field is audit-logged with the Outlet Admin's login.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { outlet, adminId, adminEmail } = await requireOutletAdmin(req);
    const parsed = outletOffersUpdateSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.$transaction(
      async (tx) => {
        await applyOfferChanges(tx, outlet.id, parsed.data, {
          type: 'OUTLET_ADMIN',
          id: adminId,
          email: adminEmail,
        });
        return tx.outlet.findUniqueOrThrow({ where: { id: outlet.id } });
      },
      { maxWait: 10_000, timeout: 20_000 }
    );
    return ok(await view(updated), 200, 'Outlet offers updated');
  } catch (error) {
    return handleRouteError(error, 'PATCH /api/outlet/settings');
  }
}
