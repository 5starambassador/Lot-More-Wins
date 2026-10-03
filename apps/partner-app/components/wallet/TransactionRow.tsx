import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PointsLedgerEntry, PointsRedemptionRecord } from '@lotmorewins/types';
import { formatDate, formatINR, formatPoints } from '../../lib/format';
import type { WalletFormat } from '../../lib/wallet-display';
import { colors, space } from '../../theme/tokens';
import { Txt } from '../ui';

/** A wallet history line: earned on a bill, or redeemed at an outlet. */
export type WalletTransaction =
  | { kind: 'EARNED'; id: string; createdAt: string; entry: PointsLedgerEntry }
  | { kind: 'REDEEMED'; id: string; createdAt: string; redemption: PointsRedemptionRecord };

/** Earned and redeemed points in one list, newest first. */
export function mergeTransactions(entries: PointsLedgerEntry[], redemptions: PointsRedemptionRecord[]): WalletTransaction[] {
  return [
    ...entries.map((entry) => ({ kind: 'EARNED' as const, id: entry.id, createdAt: entry.createdAt, entry })),
    ...redemptions.map((redemption) => ({ kind: 'REDEEMED' as const, id: redemption.id, createdAt: redemption.createdAt, redemption })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function ExpiryLine({ entry }: { entry: PointsLedgerEntry }) {
  if (!entry.expiresAt) {
    return (
      <Txt variant="caption" tone="muted">
        No expiry
      </Txt>
    );
  }
  return (
    <View style={styles.expiry}>
      <Ionicons name="time-outline" size={12} color={entry.expired ? colors.danger : colors.gold} />
      <Txt variant="caption" tone={entry.expired ? 'danger' : 'gold'}>
        {entry.expired ? 'Expired on' : 'Valid till'} {formatDate(entry.expiresAt)}
      </Txt>
    </View>
  );
}

/** Amounts follow the wallet display setting: points (with their ₹ worth) or rupees. */
export function TransactionRow({ transaction, format }: { transaction: WalletTransaction; format: WalletFormat }) {
  const { inRupees } = format;
  if (transaction.kind === 'REDEEMED') {
    const { redemption } = transaction;
    // Redemptions keep the exact rupee value they were made for.
    const amount = inRupees ? formatINR(redemption.rupeeValue) : formatPoints(redemption.points);
    return (
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`Redeemed ${amount}${inRupees ? '' : ' points'} at ${redemption.outletName}`}
      >
        <View style={styles.icon}>
          <Ionicons name="arrow-up-outline" size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.text}>
          <Txt variant="bodyMedium" numberOfLines={1}>
            {inRupees ? 'Redeemed' : 'Points redeemed'}
          </Txt>
          <Txt variant="small" tone="secondary" numberOfLines={1}>
            {redemption.outletName} · {formatDate(redemption.createdAt)}
          </Txt>
          {inRupees ? null : (
            <Txt variant="caption" tone="muted">
              Worth {formatINR(redemption.rupeeValue)}
            </Txt>
          )}
        </View>
        <Txt variant="bodyMedium" tone="secondary">
          −{amount}
        </Txt>
      </View>
    );
  }

  const { entry } = transaction;
  const isReferral = entry.type === 'REFERRAL';
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${isReferral ? 'Referral' : 'Purchase'} ${format.noun} at ${entry.outletName}, plus ${format.amount(entry.points)}${inRupees ? '' : ' points'}`}
    >
      <View style={[styles.icon, styles.iconGold]}>
        <Ionicons name={isReferral ? 'people-outline' : 'bag-handle-outline'} size={18} color={colors.gold} />
      </View>
      <View style={styles.text}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {isReferral ? 'Referral' : 'Purchase'} {inRupees ? 'reward' : 'points'}
        </Txt>
        <Txt variant="small" tone="secondary" numberOfLines={1}>
          {entry.outletName} · {formatDate(entry.createdAt)}
        </Txt>
        <ExpiryLine entry={entry} />
        {entry.claimedAt ? (
          <Txt variant="caption" tone="muted">
            Earned before registering · added {formatDate(entry.claimedAt)}
          </Txt>
        ) : null}
      </View>
      <Txt variant="bodyMedium" tone={entry.expired ? 'muted' : 'gold'} style={entry.expired ? styles.struck : undefined}>
        +{format.amount(entry.points)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGold: { borderColor: colors.goldLine },
  text: { flex: 1, gap: 1 },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  struck: { textDecorationLine: 'line-through' },
});
