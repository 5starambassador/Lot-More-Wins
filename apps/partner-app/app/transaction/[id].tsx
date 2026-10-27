import { RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerTransaction, PartnerTransactionBill } from '@lotmorewins/types';
import { Divider, FullScreenLoader, Screen, SectionLabel, StateView, TopBar, Txt } from '../../components/ui';
import {
  ENTRY_LOOK,
  isRedeemBill,
  transactionIcon,
  transactionSubtitle,
  transactionTitle,
  walletAmount,
} from '../../components/wallet/TransactionRow';
import { describeError, useTransaction } from '../../lib/queries';
import { formatDate, formatINR, formatPercent, formatPoints } from '../../lib/format';
import { useWalletFormat, type WalletFormat } from '../../lib/wallet-display';
import { colors, fonts, radius, space } from '../../theme/tokens';

const QR_USED: Record<PartnerTransactionBill['transactionType'], string> = {
  DIRECT_PARTNER: 'Personal Discount QR',
  REFERRAL: 'Referral QR',
  WALLET_REDEEM: 'Wallet redeem QR',
};

function formatDateTimeFull(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Line({ label, value, tone, strong = false }: { label: string; value: string; tone?: 'gold' | 'success' | 'muted'; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Txt variant={strong ? 'bodyMedium' : 'body'} tone="secondary" style={styles.lineLabel}>
        {label}
      </Txt>
      <Txt variant={strong ? 'subheading' : 'bodyMedium'} tone={tone ?? 'default'} selectable style={styles.lineValue}>
        {value}
      </Txt>
    </View>
  );
}

function Note({ children }: { children: string }) {
  return (
    <Txt variant="caption" tone="gold">
      {children}
    </Txt>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.section}>
      <SectionLabel label={title} />
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}

/** What the partner paid: the full breakdown when they bought, the essentials when a friend did. */
function BillCard({ bill, format }: { bill: PartnerTransactionBill; format: WalletFormat }) {
  const redeem = bill.transactionType === 'WALLET_REDEEM';
  if (bill.role === 'REFERRER') {
    return (
      <Card title="Your friend’s bill">
        <Line label="Bought by" value={bill.buyerName ?? 'Your friend'} />
        <Line label="Outlet" value={bill.outletName} />
        <Line label="Bill number" value={bill.billNumber} />
        <Line label="Bill amount" value={formatINR(bill.billAmount)} />
        <Txt variant="caption" tone="muted">
          They shopped with your Referral QR, so this reward was added to your wallet.
        </Txt>
      </Card>
    );
  }
  return (
    <Card title="Bill details">
      <Line label="Outlet" value={bill.outletName} />
      <Line label="Bill number" value={bill.billNumber} />
      <Line label="QR used" value={QR_USED[bill.transactionType]} />
      <View style={styles.gap}>
        <Divider />
      </View>
      <Line label="Bill amount" value={formatINR(bill.billAmount)} />
      {!redeem && bill.discountAmount > 0 ? (
        <>
          <Line label={`Discount (${formatPercent(bill.discountPercentage)})`} value={`− ${formatINR(bill.discountAmount)}`} tone="success" />
          {bill.isFirstTime ? <Note>First purchase at this outlet</Note> : null}
          {bill.birthdayBonusPercentage > 0 ? <Note>{`Includes ${formatPercent(bill.birthdayBonusPercentage)} birthday bonus`}</Note> : null}
          {bill.referralRewardPercentage > 0 ? <Note>{`Referral reward: ${formatPercent(bill.referralRewardPercentage)} discount`}</Note> : null}
          <Line label="After discount" value={formatINR(bill.taxableAmount)} />
        </>
      ) : null}
      {bill.gstPercentage > 0 ? <Line label={`GST (${formatPercent(bill.gstPercentage)})`} value={`+ ${formatINR(bill.gstAmount)}`} /> : null}
      {redeem ? (
        <>
          <Line label="Paid from wallet" value={`− ${formatINR(bill.walletRedeemAmount)}`} tone="success" />
          {!format.inRupees ? (
            <Txt variant="caption" tone="muted">
              {formatPoints(bill.walletRedeemPoints)} points · at most half the bill. The rest of the QR’s value stayed in your wallet.
            </Txt>
          ) : (
            <Txt variant="caption" tone="muted">
              At most half the bill. The rest of the QR’s value stayed in your wallet.
            </Txt>
          )}
        </>
      ) : null}
      {bill.roundOffAmount ? (
        <Line label="Round off" value={`${bill.roundOffAmount > 0 ? '+' : '−'} ${formatINR(Math.abs(bill.roundOffAmount))}`} />
      ) : null}
      <View style={styles.gap}>
        <Divider />
      </View>
      <Line label="You paid the outlet" value={formatINR(bill.finalAmount)} tone="gold" strong />
    </Card>
  );
}

function RewardsCard({ transaction: t, format }: { transaction: PartnerTransaction; format: WalletFormat }) {
  if (t.kind !== 'BILL' || isRedeemBill(t)) return null;
  return (
    <Card title="Added to your wallet">
      {t.rewards.length === 0 ? (
        <Txt variant="small" tone="muted">
          This bill did not add anything to your wallet.
        </Txt>
      ) : (
        t.rewards.map((r) => {
          const look = ENTRY_LOOK[r.type] ?? ENTRY_LOOK.PURCHASE;
          return (
            <View key={r.id} style={styles.reward}>
              <Line label={format.inRupees ? look.rupees : look.points} value={`+${format.amount(r.points)}`} tone={r.expired ? 'muted' : 'gold'} />
              <Txt variant="caption" tone={r.expired ? 'danger' : 'muted'}>
                {r.expiresAt ? `${r.expired ? 'Expired on' : 'Valid till'} ${formatDate(r.expiresAt)}` : 'No expiry'}
              </Txt>
            </View>
          );
        })
      )}
    </Card>
  );
}

function DetailsCard({ transaction: t, format }: { transaction: PartnerTransaction; format: WalletFormat }) {
  const worth = !format.inRupees && t.points !== 0 ? formatINR(Math.abs(t.rupeeValue)) : null;
  if (t.kind === 'SENT') {
    return (
      <Card title="Transfer details">
        <Line label="Sent to" value={t.counterparty?.name ?? '—'} />
        {t.counterparty ? <Line label="Mobile" value={`+91 ${t.counterparty.mobile}`} /> : null}
        <Line label="Amount" value={`${walletAmount(t, format)}${format.inRupees ? '' : ' points'}`} />
        {worth ? <Line label="Worth" value={worth} /> : null}
        {t.reference ? <Line label="Transfer number" value={t.reference} /> : null}
      </Card>
    );
  }
  if (t.kind === 'REDEEMED') {
    return (
      <Card title="Redemption details">
        <Line label="Outlet" value={t.outletName ?? '—'} />
        <Line label="Redeemed" value={`${walletAmount(t, format)}${format.inRupees ? '' : ' points'}`} />
        {worth ? <Line label="Worth" value={worth} /> : null}
        {t.redemptionBillAmount ? <Line label="Bill amount" value={formatINR(t.redemptionBillAmount)} /> : null}
      </Card>
    );
  }
  if (t.kind === 'REWARD') {
    const look = (t.entryType && ENTRY_LOOK[t.entryType]) || ENTRY_LOOK.PURCHASE;
    return (
      <Card title="Reward details">
        <Line label="Type" value={format.inRupees ? look.rupees : look.points} />
        <Line label="Amount" value={`+${format.amount(t.points)}`} tone="gold" />
        {worth ? <Line label="Worth" value={worth} /> : null}
        <Line
          label={t.expired ? 'Expired on' : 'Valid till'}
          value={t.expiresAt ? formatDate(t.expiresAt) : 'No expiry'}
          tone={t.expired ? 'muted' : undefined}
        />
        {t.entryType === 'TRANSFER_IN' && t.counterparty ? (
          <>
            <Line label="From" value={t.counterparty.name} />
            <Line label="Mobile" value={`+91 ${t.counterparty.mobile}`} />
          </>
        ) : null}
        {t.reference ? <Line label="Transfer number" value={t.reference} /> : null}
        {t.claimedAt ? (
          <Txt variant="caption" tone="muted">
            Earned before you registered · added {formatDate(t.claimedAt)}
          </Txt>
        ) : null}
        {t.entryType === 'CASH_WALLET_MERGE' ? (
          <Txt variant="caption" tone="muted">
            Your cash rewards balance, moved into your one wallet when UPI payouts ended.
          </Txt>
        ) : null}
      </Card>
    );
  }
  return null;
}

/** One wallet transaction: a bill, a reward, a transfer or a redemption, with everything recorded about it. */
export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useTransaction(id);
  const format = useWalletFormat();
  const t = query.data;

  if (query.isLoading) return <FullScreenLoader />;

  if (!t) {
    return (
      <Screen>
        <TopBar title="Transaction" />
        <StateView
          tone="error"
          icon={query.isError ? 'cloud-offline-outline' : 'receipt-outline'}
          title="Couldn’t load this transaction"
          message={query.isError ? describeError(query.error) : undefined}
          actionLabel={query.isError ? 'Try again' : 'Back to wallet'}
          onAction={query.isError ? () => query.refetch() : () => router.back()}
        />
      </Screen>
    );
  }

  const title = transactionTitle(t, format.inRupees);
  const subtitle = transactionSubtitle(t);
  const paidBill = t.kind === 'BILL' && !isRedeemBill(t);
  const headline = paidBill
    ? formatINR(t.bill?.finalAmount ?? 0)
    : `${t.points < 0 ? '−' : '+'}${t.kind === 'REWARD' ? format.amount(t.points) : walletAmount(t, format)}`;
  const credit = t.kind === 'REWARD';

  return (
    <Screen refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.gold} />}>
      <TopBar title="Transaction" />
      <Animated.View entering={FadeIn.duration(350)} style={styles.hero}>
        <View style={[styles.heroIcon, credit && styles.heroIconGold]}>
          <Ionicons name={transactionIcon(t)} size={26} color={credit ? colors.gold : colors.textSecondary} />
        </View>
        <Txt variant="bodyMedium" align="center">
          {title}
        </Txt>
        <Txt style={[styles.amount, !credit && styles.amountPlain]} adjustsFontSizeToFit numberOfLines={1}>
          {headline}
        </Txt>
        {paidBill ? (
          <Txt variant="caption" tone="muted" align="center">
            Paid at the outlet
          </Txt>
        ) : isRedeemBill(t) ? (
          <Txt variant="caption" tone="muted" align="center">
            From your wallet · you paid {formatINR(t.bill?.finalAmount ?? 0)} at the outlet
          </Txt>
        ) : null}
        <Txt variant="small" tone="secondary" align="center">
          {subtitle ? `${subtitle} · ` : ''}
          {formatDateTimeFull(t.createdAt)}
        </Txt>
      </Animated.View>

      {t.bill ? <BillCard bill={t.bill} format={format} /> : null}
      <RewardsCard transaction={t} format={format} />
      <DetailsCard transaction={t} format={format} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.maroonSoft,
    marginTop: space.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  heroIconGold: { borderColor: colors.goldLine },
  amount: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, letterSpacing: -1, color: colors.gold, textAlign: 'center' },
  amountPlain: { color: colors.text },
  section: { marginTop: space.xl },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  lineLabel: { flex: 1 },
  lineValue: { flexShrink: 1, textAlign: 'right' },
  gap: { marginVertical: space.xxs },
  reward: { gap: 2 },
});
