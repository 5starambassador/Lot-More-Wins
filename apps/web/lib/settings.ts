import type { Prisma, ProgramSetting } from '@prisma/client';
import type { MessagingMode, ProgramSettings, UpdateProgramSettingsPayload } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError } from './auth';

/**
 * Runtime settings service. The ProgramSetting row (id GLOBAL) is the source of truth.
 * When no row exists yet, defaults are served and the messaging mode falls back to the
 * MESSAGING_MODE environment variable. The env var never overrides a stored row.
 */

export const SETTINGS_ID = 'GLOBAL';

export function envMessagingMode(): MessagingMode {
  return (process.env.MESSAGING_MODE || '').toLowerCase().trim() === 'whatsapp' ? 'whatsapp' : 'email';
}

function toDto(row: ProgramSetting | null): ProgramSettings {
  if (!row) {
    return {
      messagingMode: envMessagingMode(),
      firstTimeDiscount: 20,
      firstTimeValidityDays: 0,
      repeatDiscount: 10,
      birthdayBonusDiscount: 5,
      referralDiscount: 10,
      referralRewardGoal: 10,
      referralRewardDiscount: 20,
      pointsToRupees: { points: 10, rupees: 1 },
      referralPointsPercentage: 0,
      purchasePointsPercentage: 0,
      purchasePointsValidityDays: 0,
      referralPointsValidityDays: 0,
      pointsBasis: 'PAYABLE_AMOUNT',
      appDownloadUrl: null,
      isPersisted: false,
      updatedAt: null,
    };
  }
  return {
    messagingMode: row.messagingMode === 'WHATSAPP' ? 'whatsapp' : 'email',
    firstTimeDiscount: row.firstTimeDiscount.toNumber(),
    firstTimeValidityDays: row.firstTimeValidityDays,
    repeatDiscount: row.repeatDiscount.toNumber(),
    birthdayBonusDiscount: row.birthdayBonusDiscount.toNumber(),
    referralDiscount: row.referralDiscount.toNumber(),
    referralRewardGoal: row.referralRewardGoal,
    referralRewardDiscount: row.referralRewardDiscount.toNumber(),
    pointsToRupees: { points: row.pointsRatioPoints.toNumber(), rupees: row.pointsRatioRupees.toNumber() },
    referralPointsPercentage: row.referralPointsPercentage.toNumber(),
    purchasePointsPercentage: row.purchasePointsPercentage.toNumber(),
    purchasePointsValidityDays: row.purchasePointsValidityDays,
    referralPointsValidityDays: row.referralPointsValidityDays,
    pointsBasis: row.pointsBasis,
    appDownloadUrl: row.appDownloadUrl,
    isPersisted: true,
    updatedAt: row.updatedAt.toISOString(),
  };
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function getProgramSettings(db: Db = prisma): Promise<ProgramSettings> {
  return toDto(await db.programSetting.findUnique({ where: { id: SETTINGS_ID } }));
}

export type ConfiguredProgramSettings = ProgramSettings & { isPersisted: true; updatedAt: string };

/**
 * Settings for anything that moves money or points. The saved Super Admin row is the only
 * source: when it has never been saved, billing is refused instead of running on defaults.
 */
export async function requireConfiguredSettings(db: Db = prisma): Promise<ConfiguredProgramSettings> {
  const settings = await getProgramSettings(db);
  if (!settings.isPersisted || !settings.updatedAt) {
    throw new HttpError(
      409,
      'Programme settings have not been configured by the Super Admin yet. Billing is unavailable.',
      'SETTINGS_NOT_CONFIGURED'
    );
  }
  return settings as ConfiguredProgramSettings;
}

/** Messaging mode stored in the database, or null when settings were never saved. */
export async function getStoredMessagingMode(): Promise<MessagingMode | null> {
  const row = await prisma.programSetting.findUnique({
    where: { id: SETTINGS_ID },
    select: { messagingMode: true },
  });
  if (!row) return null;
  return row.messagingMode === 'WHATSAPP' ? 'whatsapp' : 'email';
}

export async function updateProgramSettings(
  input: UpdateProgramSettingsPayload,
  updatedBy: string
): Promise<ProgramSettings> {
  const data = {
    messagingMode: input.messagingMode === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
    firstTimeDiscount: input.firstTimeDiscount,
    firstTimeValidityDays: input.firstTimeValidityDays,
    repeatDiscount: input.repeatDiscount,
    birthdayBonusDiscount: input.birthdayBonusDiscount,
    referralDiscount: input.referralDiscount,
    referralRewardGoal: input.referralRewardGoal,
    referralRewardDiscount: input.referralRewardDiscount,
    pointsRatioPoints: input.pointsToRupees.points,
    pointsRatioRupees: input.pointsToRupees.rupees,
    referralPointsPercentage: input.referralPointsPercentage,
    purchasePointsPercentage: input.purchasePointsPercentage,
    purchasePointsValidityDays: input.purchasePointsValidityDays,
    referralPointsValidityDays: input.referralPointsValidityDays,
    pointsBasis: input.pointsBasis,
    appDownloadUrl: input.appDownloadUrl,
    updatedBy,
  } as const;

  const row = await prisma.programSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
  return toDto(row);
}
