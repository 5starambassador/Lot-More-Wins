import { Prisma } from '@prisma/client';
import type { Outlet as OutletRow, OfferChangeActor } from '@prisma/client';
import type {
  DiscountType,
  OutletEffectiveDiscounts,
  OutletEffectiveRewards,
  OutletOfferChangeRecord,
  OutletOfferFieldsPayload,
  OutletOfferSettings,
  OutletOfferSummary,
  OutletFlatValues,
  OutletSlabTypes,
  PartnerCategory,
  ProgramSettings,
} from '@lotmorewins/types';
import { OUTLET_OFFER_FIELDS, OUTLET_SLABS, serviceChargeError } from '@lotmorewins/validation';
import prisma from './prisma';
import { HttpError } from './auth';

/**
 * Outlet offers. Each outlet may override the first-time (Non-Achariya and Achariya), repeat and
 * referral discounts, and the purchase / referral points and cash reward percentages; a blank
 * override uses the programme setting of the same name. GST, the service charge (a % or a fixed ₹)
 * and whether the cash reward is given are per outlet only. The birthday bonus and the referral reward stay programme-wide.
 * Every change, from the Super Admin panel or the Outlet Admin app, is written to the audit log
 * and bumps the outlet's offer settings version, which each bill snapshots.
 */

type Db = Prisma.TransactionClient | typeof prisma;
/** Offer settings are read from full outlet rows. */
type OfferRow = OutletRow;
type ProgrammeDiscounts = Pick<ProgramSettings, 'firstTimeDiscount' | 'achariyaFirstTimeDiscount' | 'repeatDiscount' | 'referralDiscount'>;
type ProgrammeRewards = Pick<ProgramSettings, keyof OutletEffectiveRewards>;

const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());

export function serializeOfferSettings(outlet: OfferRow): OutletOfferSettings {
  return {
    firstTimeDiscount: num(outlet.firstTimeDiscount),
    achariyaFirstTimeDiscount: num(outlet.achariyaFirstTimeDiscount),
    repeatDiscount: num(outlet.repeatDiscount),
    referralDiscount: num(outlet.referralDiscount),
    firstTimeDiscountType: outlet.firstTimeDiscountType,
    repeatDiscountType: outlet.repeatDiscountType,
    referralDiscountType: outlet.referralDiscountType,
    purchasePointsType: outlet.purchasePointsType,
    referralPointsType: outlet.referralPointsType,
    cashRewardPurchaseType: outlet.cashRewardPurchaseType,
    cashRewardReferralType: outlet.cashRewardReferralType,
    flatFirstTimeDiscount: outlet.flatFirstTimeDiscount.toNumber(),
    flatRepeatDiscount: outlet.flatRepeatDiscount.toNumber(),
    flatReferralDiscount: outlet.flatReferralDiscount.toNumber(),
    flatPurchasePoints: outlet.flatPurchasePoints.toNumber(),
    flatReferralPoints: outlet.flatReferralPoints.toNumber(),
    flatCashRewardPurchase: outlet.flatCashRewardPurchase.toNumber(),
    flatCashRewardReferral: outlet.flatCashRewardReferral.toNumber(),
    minBillAmount: outlet.minBillAmount.toNumber(),
    walletRedemptionEnabled: outlet.walletRedemptionEnabled,
    // Older Outlet Admin builds read one type: flat only when every discount slab is.
    discountType:
      outlet.firstTimeDiscountType === 'FIXED' && outlet.repeatDiscountType === 'FIXED' && outlet.referralDiscountType === 'FIXED'
        ? 'FIXED'
        : 'PERCENTAGE',
    gstPercentage: outlet.gstPercentage.toNumber(),
    serviceChargeType: outlet.serviceChargeType,
    serviceChargeValue: outlet.serviceChargeValue.toNumber(),
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
const formatRupees = (value: number) => Number(value.toFixed(2)).toLocaleString('en-IN');

/** Each slab's type at the outlet (% or flat ₹). */
export function slabTypes(outlet: OfferRow): OutletSlabTypes {
  return Object.fromEntries(OUTLET_SLABS.map((s) => [s.key, outlet[s.typeField]])) as OutletSlabTypes;
}

/** Each slab's flat ₹ amount at the outlet (used while its type is FIXED). */
export function flatValues(outlet: OfferRow): OutletFlatValues {
  return Object.fromEntries(OUTLET_SLABS.map((s) => [s.key, outlet[s.flatField].toNumber()])) as OutletFlatValues;
}

export const PERCENT_SLAB_TYPES: OutletSlabTypes = Object.fromEntries(
  OUTLET_SLABS.map((s) => [s.key, 'PERCENTAGE' as DiscountType])
) as OutletSlabTypes;
export const NO_FLAT_VALUES: OutletFlatValues = Object.fromEntries(OUTLET_SLABS.map((s) => [s.key, 0])) as OutletFlatValues;

/** What offerSummary needs to know about the outlet's slab types. */
export interface OfferSummaryFlat {
  types: OutletSlabTypes;
  flat: OutletFlatValues;
}

/** The slab part of offerSummary's input, from an outlet row. */
export function summaryFlat(outlet: OfferRow): OfferSummaryFlat {
  return { types: slabTypes(outlet), flat: flatValues(outlet) };
}

/**
 * "Up to X% discount" with the highest discount type, even when every type is the same: what a
 * bill gets depends on the partner and the bill (and never more than half of it). With a category
 * only that category's first-time discount counts (what that partner can get); without one (public
 * lists, Super Admin) both do.
 */
export function offerSummary(
  discounts: OutletEffectiveDiscounts,
  givesCashReward: boolean,
  category: PartnerCategory | null = null,
  flat: OfferSummaryFlat | null = null
): OutletOfferSummary {
  const types = flat?.types ?? PERCENT_SLAB_TYPES;
  const amounts = flat?.flat ?? NO_FLAT_VALUES;
  const firstTime =
    category === 'ACHARIYA'
      ? [discounts.achariyaFirstTimeDiscount]
      : category === 'NON_ACHARIYA'
        ? [discounts.firstTimeDiscount]
        : [discounts.firstTimeDiscount, discounts.achariyaFirstTimeDiscount];
  const percents: number[] = [];
  const rupees: number[] = [];
  const add = (type: DiscountType, pct: number[], flatAmount: number) =>
    type === 'FIXED' ? rupees.push(flatAmount) : percents.push(...pct);
  add(types.firstTimeDiscount, firstTime, amounts.firstTimeDiscount);
  add(types.repeatDiscount, [discounts.repeatDiscount], amounts.repeatDiscount);
  add(types.referralDiscount, [discounts.referralDiscount], amounts.referralDiscount);
  const maxDiscount = percents.length ? Math.max(...percents) : 0;
  const maxFlat = rupees.length ? Math.max(...rupees) : 0;
  // The headline is the % unless only the flat slabs give anything.
  const headlineFlat = maxDiscount <= 0 && maxFlat > 0;
  const pctText = `${formatPercent(maxDiscount)}%`;
  const flatText = `₹${formatRupees(maxFlat)}`;
  return {
    // Older apps print maxDiscount as a %, so flat slabs never count in it.
    maxDiscount,
    isFlat: rupees.length === 0 && percents.every((v) => v === maxDiscount),
    discountType: headlineFlat ? 'FIXED' : 'PERCENTAGE',
    maxFlatDiscount: maxFlat,
    badge: `Upto ${headlineFlat ? flatText : pctText}`,
    label:
      maxDiscount > 0 && maxFlat > 0
        ? `Up to ${pctText} or ${flatText} discount`
        : `Up to ${headlineFlat ? flatText : pctText} discount`,
    givesCashReward,
  };
}

/** Highest % discount over the active outlets ("Get up to X%"); flat ₹ outlets count as 0. Null when there is no active outlet. */
export async function maxActiveOutletDiscount(
  settings: ProgrammeDiscounts,
  category: PartnerCategory | null = null,
  db: Db = prisma
): Promise<number | null> {
  const outlets = await db.outlet.findMany({ where: { status: 'ACTIVE' } });
  if (outlets.length === 0) return null;
  return Math.max(
    ...outlets.map((o) => offerSummary(effectiveDiscounts(settings, o), o.givesCashReward, category, summaryFlat(o)).maxDiscount)
  );
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

function asText(value: Prisma.Decimal | number | boolean | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  return new Prisma.Decimal(value).toDecimalPlaces(2).toString();
}

/** Every offer field a payload may carry (the stored ones and the older single discount type). */
export const OFFER_PAYLOAD_KEYS: ReadonlySet<string> = new Set<string>([...OUTLET_OFFER_FIELDS, 'discountType']);

/** Only the offer fields of a create / update payload. */
export function pickOfferFields(input: OutletOfferFieldsPayload): OutletOfferFieldsPayload {
  const picked: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input)) if (OFFER_PAYLOAD_KEYS.has(field) && value !== undefined) picked[field] = value;
  return picked as OutletOfferFieldsPayload;
}

/** Everything but the offer fields (the profile fields an update writes directly). */
export function withoutOfferFields<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([field]) => !OFFER_PAYLOAD_KEYS.has(field))) as Partial<T>;
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

  // The service charge value must suit its type, whichever of the two this edit changes.
  const chargeType = input.serviceChargeType ?? current.serviceChargeType;
  const chargeValue = input.serviceChargeValue ?? current.serviceChargeValue.toNumber();
  const chargeError = serviceChargeError(chargeType, chargeValue);
  if (chargeError) throw new HttpError(422, chargeError, 'VALIDATION_ERROR');

  // Older Outlet Admin builds send one discount type for every discount slab.
  if (input.discountType !== undefined) {
    input = {
      ...input,
      firstTimeDiscountType: input.firstTimeDiscountType ?? input.discountType,
      repeatDiscountType: input.repeatDiscountType ?? input.discountType,
      referralDiscountType: input.referralDiscountType ?? input.discountType,
    };
  }

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
