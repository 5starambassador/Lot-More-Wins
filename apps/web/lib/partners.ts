import type { Partner, QRCode } from '@prisma/client';
import type { PartnerHome, PartnerOnboardingResponse, PartnerProfile, PermanentQRItem, ProgramSettings } from '@lotmorewins/types';
import prisma from './prisma';
import { HttpError, PARTNER_TOKEN_TTL_SEC, signToken } from './auth';
import { appDownloadLinks, getProgramSettings } from './settings';
import { isFirstTimeDirect } from './billing';
import { referralProgress } from './referral-rewards';

/**
 * Partner profile helpers. There is a single partner role: every partner gets the same
 * discounts and points from the Super Admin settings.
 */

/** A date of birth added or changed after registration must age this long before it earns the bonus. */
const DOB_CHANGE_COOLDOWN_MS = 30 * 86_400_000;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** @db.Date columns come back as UTC midnight; the API speaks YYYY-MM-DD. */
export function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Whether `now` falls on the birthday, by the IST calendar. 29 Feb is observed on 28 Feb in common years. */
export function isBirthday(dateOfBirth: Date | null, now = new Date()): boolean {
  if (!dateOfBirth) return false;
  const today = new Date(now.getTime() + IST_OFFSET_MS);
  const year = today.getUTCFullYear();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  let month = dateOfBirth.getUTCMonth();
  let day = dateOfBirth.getUTCDate();
  if (month === 1 && day === 29 && !isLeapYear) day = 28;
  return today.getUTCMonth() === month && today.getUTCDate() === day;
}

/**
 * Birthday bonus discount the partner is entitled to right now (0 when it is not their birthday).
 * A date of birth edited in the profile only counts after a cooldown, so the bonus cannot be
 * claimed by moving the birthday to today.
 */
export function birthdayBonusFor(
  settings: Pick<ProgramSettings, 'birthdayBonusDiscount'>,
  partner: Pick<Partner, 'dateOfBirth' | 'dobChangedAt'>,
  now = new Date()
): number {
  if (!isBirthday(partner.dateOfBirth, now)) return 0;
  if (partner.dobChangedAt && now.getTime() - partner.dobChangedAt.getTime() < DOB_CHANGE_COOLDOWN_MS) return 0;
  return settings.birthdayBonusDiscount;
}

export function serializePartner(partner: Partner): PartnerProfile {
  return {
    id: partner.id,
    partnerCode: partner.partnerCode,
    name: partner.name,
    mobile: partner.mobile,
    email: partner.email,
    city: partner.city,
    state: partner.state,
    pincode: partner.pincode,
    dateOfBirth: toDateOnly(partner.dateOfBirth),
    photoUrl: partner.photoUrl,
    status: partner.status,
    createdAt: partner.createdAt.toISOString(),
  };
}

export function serializeQrCodes(qrCodes: QRCode[]): PermanentQRItem[] {
  return qrCodes.map((qr) => ({
    id: qr.id,
    code: qr.code,
    type: qr.type,
    title: qr.type === 'DEFAULT_DISCOUNT' ? 'Personal Discount QR' : 'Referral QR',
    description:
      qr.type === 'DEFAULT_DISCOUNT'
        ? 'Show at checkout to redeem your partner discount.'
        : 'Share with friends & family to earn points whenever they shop.',
    status: qr.status,
    createdAt: qr.createdAt.toISOString(),
  }));
}

export const activeQrInclude = { qrCodes: { where: { status: 'ACTIVE' }, orderBy: { type: 'asc' } } } as const;

/** Profile, permanent QR codes and a fresh token: the session payload of registration and sign-in. */
export function partnerSession(partner: Partner & { qrCodes: QRCode[] }): PartnerOnboardingResponse {
  return {
    partner: serializePartner(partner),
    qrCodes: serializeQrCodes(partner.qrCodes),
    token: signToken(
      { typ: 'partner', partnerId: partner.id, partnerCode: partner.partnerCode, mobile: partner.mobile },
      PARTNER_TOKEN_TTL_SEC
    ),
  };
}

export async function getPartnerHome(partnerId: string): Promise<PartnerHome> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new HttpError(404, 'Partner account not found', 'PARTNER_NOT_FOUND');

  const [settings, unreadNotifications] = await Promise.all([
    getProgramSettings(),
    prisma.notification.count({ where: { partnerId, readAt: null } }),
  ]);
  const validityDays = settings.firstTimeValidityDays;
  const referrals = await referralProgress(prisma, partnerId, settings.referralRewardGoal);

  return {
    referrals: {
      // The bar stays full while a reward is waiting, then starts again once it is used.
      successful: Math.min(referrals.successful, settings.referralRewardGoal),
      goal: settings.referralRewardGoal,
      total: referrals.total,
      rewardAvailable: referrals.rewardAvailable,
      rewardDiscount: settings.referralRewardDiscount,
    },
    offers: {
      firstTimeDiscount: settings.firstTimeDiscount,
      firstTimeAvailable: await isFirstTimeDirect(prisma, partner, validityDays),
      firstTimeExpiresAt:
        validityDays > 0 ? new Date(partner.createdAt.getTime() + validityDays * 86_400_000).toISOString() : null,
      birthdayBonusDiscount: settings.birthdayBonusDiscount,
      repeatDiscount: settings.repeatDiscount,
      referralDiscount: settings.referralDiscount,
    },
    unreadNotifications,
    appDownloadUrl: settings.appDownloadUrl,
    inviteImageUrl: settings.inviteImageUrl,
    homePopupEnabled: settings.homePopupEnabled,
    latestAppVersion: settings.latestAppVersion,
    appLinks: appDownloadLinks(settings),
    walletDisplay: settings.walletDisplay,
  };
}
