import type { PartnerOffers } from '@lotmorewins/types';
import { getProgramSettings } from '@/lib/settings';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/offers — public. The first-purchase and birthday discounts the partner
 * app advertises during registration, straight from the Super Admin settings.
 */
export async function GET() {
  try {
    const settings = await getProgramSettings();
    const offers: PartnerOffers = {
      firstTimeDiscount: settings.firstTimeDiscount,
      birthdayBonusDiscount: settings.birthdayBonusDiscount,
    };
    return ok(offers);
  } catch (error) {
    return handleRouteError(error, 'GET /api/partner/offers');
  }
}
