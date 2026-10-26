import { Prisma } from '@prisma/client';
import type { Outlet as OutletRow, OfferChangeActor } from '@prisma/client';
import type {
  OutletEffectiveDiscounts,
  OutletEffectiveRewards,
  OutletOfferChangeRecord,
  OutletOfferFieldsPayload,
  OutletOfferSettings,
  OutletOfferSummary,
  PartnerCategory,
  ProgramSettings,
} from '@lotmorewins/types';
import { OUTLET_OFFER_FIELDS } from '@lotmorewins/validation';
import prisma from './prisma';

/**
 * Outlet offers. Each outlet may override the first-time (Non-Achariya and Achariya), repeat and
 * referral discounts, and the purchase / referral points and cash reward percentages; a blank
 * override uses the programme setting of the same name. GST and whether the cash reward is given
 * are per outlet only. The birthday bonus and the referral reward stay programme-wide.
 * Every change, from the Super Admin panel or the Outlet Admin app, is written to the audit log
 * and bumps the outlet's offer settings version, which each bill snapshots.
 */

type Db = Prisma.TransactionClient | typeof prisma;
type OfferRow = Pick<
  OutletRow,
  | 'firstTimeDiscount'
  | 'achariyaFirstTimeDiscount'
  | 'repeatDiscount'
  | 'referralDiscount'
  | 'gstPercentage'
  | 'purchasePointsPercentage'
  | 'referralPointsPercentage'
  | 'achariyaReferralPointsPercentage'
  | 'cashRewardPurchasePercentage'
  | 'cashRewardReferralPercentage'
  | 'givesCashReward'
  | 'canEditOffers'
  | 'offersUpdatedAt'
>;
type ProgrammeDiscounts = Pick<ProgramSettings, 'firstTimeDiscount' | 'achariyaFirstTimeDiscount' | 'repeatDiscount' | 'referralDiscount'>;
type ProgrammeRewards = Pick<ProgramSettings, keyof OutletEffectiveRewards>;

const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

export function serializeOfferSettings(outlet: OfferRow): OutletOfferSettings {
  return {
    firstTimeDiscount: num(outlet.firstTimeDiscount),
    achariyaFirstTimeDiscount: num(outlet.achariyaFirstTimeDiscount),
    repeatDiscount: num(outlet.repeatDiscount),
    referralDiscount: num(outlet.referralDiscount),
    gstPercentage: outlet.gstPercentage.toNumber(),
    purchasePointsPercentage: num(outlet.purchasePointsPercentage),
    referralPointsPercentage: num(outlet.referralPointsPercentage),
    achariyaReferralPointsPercentage: num(outlet.achariyaReferralPointsPercentage),
    cashRewardPurchasePercentage: num(outlet.cashRewardPurchasePercentage),
    cashRewardReferralPercentage: num(outlet.cashRewardReferralPercentage),
    givesCashReward: outlet.givesCashReward,
    canEditOffers: outlet.canEditOffers,
    updatedAt: outlet.offersUpdatedAt.toISOString(),
  };
}

export function programmeDiscounts(settings: ProgrammeDiscounts): OutletEffectiveDiscounts {
  return {
    firstTimeDiscount: settings.firstTimeDiscount,
    achariyaFirstTimeDiscount: settings.achariyaFirstTimeDiscount,
    repeatDiscount: settings.repeatDiscount,
    referralDiscount: settings.referralDiscount,
  };
}

/** The discount each type gets at this outlet: its override, or the programme setting. */
export function effectiveDiscounts(settings: ProgrammeDiscounts, outlet: OfferRow): OutletEffectiveDiscounts {
  return {
    firstTimeDiscount: num(outlet.firstTimeDiscount) ?? settings.firstTimeDiscount,
    achariyaFirstTimeDiscount: num(outlet.achariyaFirstTimeDiscount) ?? settings.achariyaFirstTimeDiscount,
    repeatDiscount: num(outlet.repeatDiscount) ?? settings.repeatDiscount,
    referralDiscount: num(outlet.referralDiscount) ?? settings.referralDiscount,
  };
}

export function programmeRewards(settings: ProgrammeRewards): OutletEffectiveRewards {
  return {
    purchasePointsPercentage: settings.purchasePointsPercentage,
    referralPointsPercentage: settings.referralPointsPercentage,
    achariyaReferralPointsPercentage: settings.achariyaReferralPointsPercentage,
    cashRewardPurchasePercentage: settings.cashRewardPurchasePercentage,
    cashRewardReferralPercentage: settings.cashRewardReferralPercentage,
  };
}

/** The reward percentages bills get at this outlet: its override, or the programme setting. */
export function effectiveRewards(settings: ProgrammeRewards, outlet: OfferRow): OutletEffectiveRewards {
  return {
    purchasePointsPercentage: num(outlet.purchasePointsPercentage) ?? settings.purchasePointsPercentage,
    referralPointsPercentage: num(outlet.referralPointsPercentage) ?? settings.referralPointsPercentage,
    achariyaReferralPointsPercentage: num(outlet.achariyaReferralPointsPercentage) ?? settings.achariyaReferralPointsPercentage,
    cashRewardPurchasePercentage: num(outlet.cashRewardPurchasePercentage) ?? settings.cashRewardPurchasePercentage,
    cashRewardReferralPercentage: num(outlet.cashRewardReferralPercentage) ?? settings.cashRewardReferralPercentage,
  };
}

const formatPercent = (value: number) => Number(value.toFixed(2)).toString();

/**
 * "Up to X% discount" with the highest discount type, even when every type is the same: what a
 * bill gets depends on the partner and the bill (and never more than half of it). With a category
 * only that category's first-time discount counts (what that partner can get); without one (public
 * lists, Super Admin) both do.
 */
export function offerSummary(
  discounts: OutletEffectiveDiscounts,
  givesCashReward: boolean,
  category: PartnerCategory | null = null
): OutletOfferSummary {
  const firstTime =
    category === 'ACHARIYA'
      ? [discounts.achariyaFirstTimeDiscount]
      : category === 'NON_ACHARIYA'
        ? [discounts.firstTimeDiscount]
        : [discounts.firstTimeDiscount, discounts.achariyaFirstTimeDiscount];
  const values = [...firstTime, discounts.repeatDiscount, discounts.referralDiscount];
  const maxDiscount = Math.max(...values);
  const isFlat = values.every((v) => v === maxDiscount);
  return {
    maxDiscount,
    isFlat,
    label: `Up to ${formatPercent(maxDiscount)}% discount`,
    givesCashReward,
  };
}

/** Highest discount over the active outlets ("Get up to X%"); null when there is no active outlet. */
export async function maxActiveOutletDiscount(
  settings: ProgrammeDiscounts,
  category: PartnerCategory | null = null,
  db: Db = prisma
): Promise<number | null> {
  const outlets = await db.outlet.findMany({ where: { status: 'ACTIVE' } });
  if (outlets.length === 0) return null;
  return Math.max(...outlets.map((o) => offerSummary(effectiveDiscounts(settings, o), o.givesCashReward, category).maxDiscount));
}

// ============================================================================
// Changes and the audit log
// ============================================================================

export interface OfferActor {
  type: OfferChangeActor;
  id: string;
  email: string;
}

type OfferField = (typeof OUTLET_OFFER_FIELDS)[number];

function asText(value: Prisma.Decimal | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return new Prisma.Decimal(value).toDecimalPlaces(2).toString();
}

/** Only the offer fields of a create / update payload. */
export function pickOfferFields(input: OutletOfferFieldsPayload): OutletOfferFieldsPayload {
  const picked: Record<string, unknown> = {};
  for (const field of OUTLET_OFFER_FIELDS) if (input[field] !== undefined) picked[field] = input[field];
  return picked as OutletOfferFieldsPayload;
}

/**
 * Applies offer changes to an outlet inside the caller's transaction: writes only fields whose
 * value really changes, logs one audit row per changed field and bumps the offer settings
 * version. Returns the number of fields changed (0 = nothing written).
 */
export async function applyOfferChanges(
  tx: Prisma.TransactionClient,
  outletId: string,
  input: OutletOfferFieldsPayload,
  actor: OfferActor
): Promise<number> {
  // Serialize concurrent offer edits of one outlet so each audit row's old value is exact.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`outlet:offers:${outletId}`}))`;
  const current = await tx.outlet.findUniqueOrThrow({
    where: { id: outletId },
  });

  const data: Prisma.OutletUpdateInput = {};
  const changes: Prisma.OutletOfferChangeCreateManyInput[] = [];
  for (const field of OUTLET_OFFER_FIELDS as readonly OfferField[]) {
    const next = input[field];
    if (next === undefined) continue;
    const oldValue = asText(current[field]);
    const newValue = asText(next);
    if (oldValue === newValue) continue;
    (data as Record<string, unknown>)[field] = next;
    changes.push({
      outletId,
      actorType: actor.type,
      actorId: actor.id,
      actorEmail: actor.email,
      field,
      oldValue,
      newValue,
    });
  }
  if (changes.length === 0) return 0;

  await tx.outlet.update({
    where: { id: outletId },
    data: { ...data, offersUpdatedAt: new Date() },
  });
  await tx.outletOfferChange.createMany({ data: changes });
  return changes.length;
}

export async function listOfferChanges(outletId: string, limit = 100): Promise<OutletOfferChangeRecord[]> {
  const rows = await prisma.outletOfferChange.findMany({
    where: { outletId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    actorType: r.actorType,
    actorEmail: r.actorEmail,
    field: r.field,
    oldValue: r.oldValue,
    newValue: r.newValue,
    createdAt: r.createdAt.toISOString(),
  }));
}
