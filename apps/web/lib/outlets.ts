import type { Outlet as OutletRow, Prisma } from '@prisma/client';
import type { AdminOutlet, Outlet, PartnerCategory, ProgramSettings } from '@lotmorewins/types';
import { effectiveDiscounts, effectiveRewards, offerSummary, serializeOfferSettings } from './outlet-offers';

type DiscountSettings = Pick<ProgramSettings, 'firstTimeDiscount' | 'achariyaFirstTimeDiscount' | 'repeatDiscount' | 'referralDiscount'>;
type RewardSettings = Pick<
  ProgramSettings,
  | 'purchasePointsPercentage'
  | 'referralPointsPercentage'
  | 'achariyaReferralPointsPercentage'
  | 'cashRewardPurchasePercentage'
  | 'cashRewardReferralPercentage'
>;

/**
 * With settings, the outlet's discount label is included (for the Partner App: a category
 * limits "Up to X%" to what that partner can get).
 */
export function serializeOutlet(outlet: OutletRow, settings?: DiscountSettings, category: PartnerCategory | null = null): Outlet {
  return {
    id: outlet.id,
    name: outlet.name,
    email: outlet.email,
    mobile: outlet.mobile,
    description: outlet.description,
    address: outlet.address,
    mapUrl: outlet.mapUrl,
    logoUrl: outlet.logoUrl,
    images: outlet.images,
    status: outlet.status,
    createdAt: outlet.createdAt.toISOString(),
    updatedAt: outlet.updatedAt.toISOString(),
    ...(settings && {
      offer: offerSummary(effectiveDiscounts(settings, outlet), outlet.givesCashReward, category),
    }),
  };
}

export const adminOutletInclude = {
  admins: { select: { email: true }, orderBy: { createdAt: 'asc' }, take: 1 },
  _count: { select: { bills: true } },
} satisfies Prisma.OutletInclude;

export function serializeAdminOutlet(
  outlet: Prisma.OutletGetPayload<{ include: typeof adminOutletInclude }>,
  settings: DiscountSettings & RewardSettings
): AdminOutlet {
  return {
    ...serializeOutlet(outlet, settings),
    offers: serializeOfferSettings(outlet),
    effectiveDiscounts: effectiveDiscounts(settings, outlet),
    effectiveRewards: effectiveRewards(settings, outlet),
    adminEmail: outlet.admins[0]?.email ?? null,
    billCount: outlet._count.bills,
  };
}
