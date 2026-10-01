import type { Prisma } from '@prisma/client';
import prisma from './prisma';

/**
 * Referral reward. Every successful referral (a bill closed with the partner's referral QR)
 * counts towards the goal in the Super Admin settings. When the goal is reached the partner's
 * next own purchase (Personal Discount QR) gets the special reward discount; that bill records
 * how many referrals it used up, which takes the partner's progress back down by one goal.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export interface ReferralProgress {
  /** Every successful referral ever. */
  total: number;
  /** Successful referrals not yet used up by a reward. */
  successful: number;
  rewardAvailable: boolean;
}

export async function referralProgress(db: Db, partnerId: string, goal: number): Promise<ReferralProgress> {
  const [total, used] = await Promise.all([
    db.bill.count({ where: { referrerPartnerId: partnerId, transactionType: 'REFERRAL' } }),
    db.bill.aggregate({
      where: { partnerId, referralRewardReferrals: { gt: 0 } },
      _sum: { referralRewardReferrals: true },
    }),
  ]);
  const successful = Math.max(0, total - (used._sum.referralRewardReferrals ?? 0));
  return { total, successful, rewardAvailable: goal > 0 && successful >= goal };
}
