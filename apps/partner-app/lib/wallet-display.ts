import type { PartnerWallet } from '@lotmorewins/types';
import { formatINR, formatPoints } from './format';
import { useWallet } from './queries';

/**
 * How wallet values are shown, from the Super Admin's "Wallet display" setting (served with
 * the wallet). Every screen that shows wallet amounts formats them through this, so the
 * setting is the single source of truth. Notifications arrive already worded by the server.
 */
export interface WalletFormat {
  inRupees: boolean;
  /** A points amount as shown: "1,250" in points mode, "₹125.00" in rupees mode. */
  amount: (points: number) => string;
  /** "points" or "rewards", for labels such as "Purchase points" / "Purchase rewards". */
  noun: 'points' | 'rewards';
}

export function walletFormat(wallet: Pick<PartnerWallet, 'walletDisplay' | 'pointsRatio'> | undefined): WalletFormat {
  const inRupees = wallet?.walletDisplay === 'RUPEES';
  const ratio = wallet?.pointsRatio ?? { points: 1, rupees: 1 };
  // Rounded down to the paisa, as the server values the wallet.
  const toRupees = (points: number) => Math.floor(((points * ratio.rupees) / ratio.points) * 100 + 1e-6) / 100;
  return {
    inRupees,
    amount: (points) => (inRupees ? formatINR(toRupees(points)) : formatPoints(points)),
    noun: inRupees ? 'rewards' : 'points',
  };
}

export function useWalletFormat(): WalletFormat {
  return walletFormat(useWallet().data);
}
