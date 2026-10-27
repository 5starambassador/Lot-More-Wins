import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerTransaction, WalletEntryType } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { formatDate, formatINR, formatPoints } from '../../lib/format';
import type { WalletFormat } from '../../lib/wallet-display';
import { colors, space } from '../../theme/tokens';
import { Txt } from '../ui';

type IconName = keyof typeof Ionicons.glyphMap;

export const ENTRY_LOOK: Record<WalletEntryType, { icon: IconName; points: string; rupees: string }> = {
  PURCHASE: { icon: 'bag-handle-outline', points: 'Purchase points', rupees: 'Purchase reward' },
  REFERRAL: { icon: 'people-outline', points: 'Referral points', rupees: 'Referral reward' },
  CASHBACK_PURCHASE: { icon: 'cash-outline', points: 'Purchase cashback', rupees: 'Purchase cashback' },
  CASHBACK_REFERRAL: { icon: 'cash-outline', points: 'Referral cashback', rupees: 'Referral cashback' },
  TRANSFER_IN: { icon: 'arrow-down-outline', points: 'Points received', rupees: 'Received' },
  CASH_WALLET_MERGE: { icon: 'wallet-outline', points: 'Cash reward balance moved in', rupees: 'Cash reward balance moved in' },
};

export const isRedeemBill = (t: PartnerTransaction) => t.kind === 'BILL' && t.bill?.transactionType === 'WALLET_REDEEM';

export function transactionIcon(t: PartnerTransaction): IconName {
  switch (t.kind) {
    case 'BILL':
      return isRedeemBill(t) ? 'qr-code-outline' : 'receipt-outline';
    case 'SENT':
      return 'paper-plane-outline';
    case 'REDEEMED':
      return 'arrow-up-outline';
    default:
      return (t.entryType && ENTRY_LOOK[t.entryType]?.icon) || 'wallet-outline';
  }
}

export function transactionTitle(t: PartnerTransaction, inRupees: boolean): string {
  switch (t.kind) {
    case 'BILL':
      return isRedeemBill(t) ? 'Bill paid with wallet' : 'Bill paid';
    case 'SENT':
      return `Sent to ${t.counterparty?.name ?? 'a partner'}`;
    case 'REDEEMED':
      return inRupees ? 'Redeemed' : 'Points redeemed';
    default: {
      const look = (t.entryType && ENTRY_LOOK[t.entryType]) || ENTRY_LOOK.PURCHASE;
      return inRupees ? look.rupees : look.points;
    }
  }
}

/** Where it happened: the outlet, the other partner, or what it was. */
export function transactionSubtitle(t: PartnerTransaction): string {
  if (t.kind === 'SENT') return t.counterparty ? `+91 ${t.counterparty.mobile}` : '';
  if (t.kind === 'REWARD') {
    if (t.entryType === 'TRANSFER_IN') return `From ${t.counterparty?.name ?? 'a partner'}`;
    if (t.entryType === 'CASH_WALLET_MERGE') return 'Your cash rewards, now in one wallet';
    if (t.bill?.role === 'REFERRER') return `${t.bill.buyerName ?? 'Your friend'} · ${t.bill.outletName}`;
  }
  return t.outletName ?? '';
}

/** A wallet amount as shown (no sign): points, or rupees when the wallet is shown in rupees. */
export function walletAmount(t: { points: number; rupeeValue: number }, format: WalletFormat): string {
  return format.inRupees ? formatINR(Math.abs(t.rupeeValue)) : formatPoints(Math.abs(t.points));
}

function Trailing({ transaction: t, format }: { transaction: PartnerTransaction; format: WalletFormat }) {
  if (t.kind === 'BILL' && !isRedeemBill(t)) {
    const earned = t.rewards.reduce((sum, r) => sum + r.points, 0);
    return (
      <View style={styles.trailing}>
        <Txt variant="bodyMedium">{formatINR(t.bill?.finalAmount ?? 0)}</Txt>
        {earned > 0 ? (
          <Txt variant="caption" tone="gold">
            +{format.amount(earned)} earned
          </Txt>
        ) : (
          <Txt variant="caption" tone="muted">
            Paid
          </Txt>
        )}
      </View>
    );
  }
  if (t.points < 0) {
    return (
      <View style={styles.trailing}>
        <Txt variant="bodyMedium" tone="secondary">
          −{walletAmount(t, format)}
        </Txt>
        {isRedeemBill(t) && t.bill ? (
          <Txt variant="caption" tone="muted">
            Paid {formatINR(t.bill.finalAmount)}
          </Txt>
        ) : null}
      </View>
    );
  }
  return (
    <Txt variant="bodyMedium" tone={t.expired ? 'muted' : 'gold'} style={t.expired ? styles.struck : undefined}>
      +{format.amount(t.points)}
    </Txt>
  );
}

/** A wallet history line; tapping it opens the transaction's details page. */
export function TransactionRow({
  transaction: t,
  format,
  onPress,
}: {
  transaction: PartnerTransaction;
  format: WalletFormat;
  onPress: () => void;
}) {
  const title = transactionTitle(t, format.inRupees);
  const subtitle = transactionSubtitle(t);
  const credit = t.kind === 'REWARD';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}, ${formatDate(t.createdAt)}. Opens the details.`}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <View style={[styles.icon, credit && styles.iconGold]}>
        <Ionicons name={transactionIcon(t)} size={18} color={credit ? colors.gold : colors.textSecondary} />
      </View>
      <View style={styles.text}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {title}
        </Txt>
        <Txt variant="small" tone="secondary" numberOfLines={1}>
          {subtitle ? `${subtitle} · ` : ''}
          {formatDate(t.createdAt)}
        </Txt>
        {credit && t.expiresAt ? (
          <View style={styles.expiry}>
            <Ionicons name="time-outline" size={12} color={t.expired ? colors.danger : colors.gold} />
            <Txt variant="caption" tone={t.expired ? 'danger' : 'gold'}>
              {t.expired ? 'Expired on' : 'Valid till'} {formatDate(t.expiresAt)}
            </Txt>
          </View>
        ) : null}
      </View>
      <Trailing transaction={t} format={format} />
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
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
  trailing: { alignItems: 'flex-end', gap: 1 },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  struck: { textDecorationLine: 'line-through' },
});
