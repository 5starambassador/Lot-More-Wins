import type { Prisma, ProgramSetting } from '@prisma/client';
import type { AppDownloadLinks, MessagingMode, ProgramSettings, UpdateProgramSettingsPayload } from '@lotmorewins/types';
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
      inviteImageUrl: null,
      homePopupEnabled: false,
      latestAppVersion: null,
      walletDisplay: 'POINTS',
      androidAppUrl: null,
      androidAppLinkType: 'DIRECT',
      iosAppUrl: null,
      iosAppLinkType: 'DIRECT',
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
    inviteImageUrl: row.inviteImageUrl,
    homePopupEnabled: row.homePopupEnabled,
    latestAppVersion: row.latestAppVersion,
    walletDisplay: row.walletDisplay,
    androidAppUrl: row.androidAppUrl,
    androidAppLinkType: row.androidAppLinkType,
    iosAppUrl: row.iosAppUrl,
    iosAppLinkType: row.iosAppLinkType,
    isPersisted: true,
    updatedAt: row.updatedAt.toISOString(),
  };
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * A file-sharing page link turned into a link that downloads the file itself, so "Download for
 * Android" starts the APK download instead of opening a preview page:
 * - Google Drive share links (…/file/d/<id>/view, open?id=, uc?id=) → Drive's direct download,
 *   with confirm=t so files too large for Google's virus scan do not stop at a warning page;
 * - Dropbox ?dl=0 → ?dl=1.
 * Any other link is returned unchanged.
 */
export function directDownloadUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const id = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(parsed.pathname)?.[1] ?? parsed.searchParams.get('id');
    if (id) return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  }
  if ((host === 'www.dropbox.com' || host === 'dropbox.com') && parsed.searchParams.get('dl') !== '1') {
    parsed.searchParams.set('dl', '1');
    return parsed.toString();
  }
  return url;
}

/** The Partner App download links per platform, as served to the landing page and the app. */
export function appDownloadLinks(
  settings: Pick<ProgramSettings, 'androidAppUrl' | 'androidAppLinkType' | 'iosAppUrl' | 'iosAppLinkType'>
): AppDownloadLinks {
  // A direct Android link must download the APK straight away; store links stay as they are.
  const android =
    settings.androidAppUrl && settings.androidAppLinkType === 'DIRECT' ? directDownloadUrl(settings.androidAppUrl) : settings.androidAppUrl;
  return {
    android: { url: android, type: settings.androidAppLinkType },
    ios: { url: settings.iosAppUrl, type: settings.iosAppLinkType },
  };
}

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
    // Settings added after the first release: omitted keeps the stored value.
    ...(input.inviteImageUrl !== undefined && { inviteImageUrl: input.inviteImageUrl }),
    ...(input.homePopupEnabled !== undefined && { homePopupEnabled: input.homePopupEnabled }),
    ...(input.latestAppVersion !== undefined && { latestAppVersion: input.latestAppVersion }),
    ...(input.walletDisplay !== undefined && { walletDisplay: input.walletDisplay }),
    ...(input.androidAppUrl !== undefined && { androidAppUrl: input.androidAppUrl }),
    ...(input.androidAppLinkType !== undefined && { androidAppLinkType: input.androidAppLinkType }),
    ...(input.iosAppUrl !== undefined && { iosAppUrl: input.iosAppUrl }),
    ...(input.iosAppLinkType !== undefined && { iosAppLinkType: input.iosAppLinkType }),
    updatedBy,
  } as const;

  const row = await prisma.programSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
  return toDto(row);
}
