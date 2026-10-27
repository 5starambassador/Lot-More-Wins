import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button, Divider, ListSkeleton, Screen, SectionLabel, Skeleton, StateView, TopBar, Txt } from '../../components/ui';
import { TransactionRow } from '../../components/wallet/TransactionRow';
import {
  DEFAULT_TRANSACTION_FILTERS,
  isFiltered,
  TransactionFilters,
  toTransactionsQuery,
  type TransactionFilterState,
} from '../../components/wallet/TransactionFilters';
import { describeError, useTransactions, useWallet } from '../../lib/queries';
import { formatINR, formatPoints } from '../../lib/format';
import { walletFormat } from '../../lib/wallet-display';
import { colors, fonts, GUTTER, radius, space } from '../../theme/tokens';

const PAGE_SIZE = 50;

/**
 * Wallet: one balance for everything the partner earns (purchase and referral points, cashback,
 * points received from other partners), the redeem QR button (works while the Super Admin has it on; worth the
 * whole balance), sending points to another partner (up to half the balance at a time), and the history with expiry dates. There
 * are no UPI payouts: the wallet is spent in the app. Shown in points or rupees according to the
 * Super Admin's "Wallet display" setting. Every history line (bills, rewards, transfers) opens its
 * details page; the history can be filtered by type and date range.
 */
export default function WalletScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const data = wallet.data;

  const [filters, setFilters] = useState<TransactionFilterState>(DEFAULT_TRANSACTION_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const query = toTransactionsQuery(filters, limit);
  const history = useTransactions(query);
  const transactions = history.data?.items ?? [];
  const changeFilters = (next: TransactionFilterState) => {
    setFilters(next);
    setLimit(PAGE_SIZE);
  };
  const balance = data?.balancePoints ?? 0;
  const format = walletFormat(data);
  const { inRupees, noun } = format;
  const Noun = noun === 'points' ? 'Points' : 'Rewards';

  return (
    <Screen
      edges={['top']}
      refreshControl={
        <RefreshControl
          refreshing={wallet.isRefetching}
          onRefresh={() => {
            wallet.refetch();
            history.refetch();
          }}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.header}>
        <TopBar title="Wallet" onBack={() => router.navigate('/dashboard')} />
      </View>

      {wallet.isError ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load your wallet"
          message={describeError(wallet.error)}
          actionLabel="Try again"
          onAction={() => wallet.refetch()}
        />
      ) : (
        <>
          <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
            <Txt variant="overline" tone="muted" align="center">
              {inRupees ? 'Wallet balance' : 'Total points'}
            </Txt>
            {wallet.isLoading ? (
              <View style={styles.heroSkeleton}>
                <Skeleton width={200} height={56} />
                <Skeleton width={120} height={14} style={{ marginTop: 12 }} />
              </View>
            ) : (
              <>
                <Txt
                  style={styles.total}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  accessibilityLabel={inRupees ? formatINR(data?.rupeeValue ?? 0) : `${formatPoints(balance)} points`}
                >
                  {inRupees ? formatINR(data?.rupeeValue ?? 0) : formatPoints(balance)}
                </Txt>
                <Txt variant="body" tone="secondary" align="center">
                  {inRupees ? 'Spend it on your bills at any outlet' : `Worth ${formatINR(data?.rupeeValue ?? 0)}`}
                </Txt>
                {/* <View style={styles.split}>
                  <View style={styles.splitCell}>
                    <Txt variant="caption" tone="muted">
                      Purchase
                    </Txt>
                    <Txt variant="subheading">{format.amount(data?.totals.purchasePoints ?? 0)}</Txt>
                  </View>
                  <View style={styles.splitCell}>
                    <Txt variant="caption" tone="muted">
                      Referral
                    </Txt>
                    <Txt variant="subheading">{format.amount(data?.totals.referralPoints ?? 0)}</Txt>
                  </View>
                 <View style={styles.splitCell}>
                    <Txt variant="caption" tone="muted">
                      Cashback
                    </Txt>
                    <Txt variant="subheading">{format.amount(data?.totals.cashbackPoints ?? 0)}</Txt>
                  </View> 
                  {data?.totals.transferInPoints ? (
                    <View style={styles.splitCell}>
                      <Txt variant="caption" tone="muted">
                        Received
                      </Txt>
                      <Txt variant="subheading">{format.amount(data.totals.transferInPoints)}</Txt>
                    </View>
                  ) : null}
                </View> */}
              </>
            )}

            {/* Always shown; disabled (with a note below) while the Super Admin has the redeem QR off. */}
            <Button
              label={
                data?.redeemEnabled && data.redeemMaxPoints > 0
                  ? `Generate redeem QR`
                  : 'Generate redeem QR'
              }
              icon={<Ionicons name="qr-code-outline" size={18} color={colors.textOnGold} />}
              onPress={() => router.push('/redeem')}
              disabled={wallet.isLoading || !data?.redeemEnabled || (data.redeemMaxPoints ?? 0) <= 0}
              style={styles.redeem}
            />
            <Button
              label="Send to a partner"
              variant="secondary"
              icon={<Ionicons name="paper-plane-outline" size={18} color={colors.gold} />}
              onPress={() => router.push('/transfer')}
              disabled={wallet.isLoading || balance <= 0}
              style={styles.send}
            />
            {!wallet.isLoading && balance <= 0 ? (
              <Txt variant="caption" tone="muted" align="center">
                Earn {noun} and cashback on a purchase or a referral to use them here.
              </Txt>
            ) : data?.redeemEnabled ? (
              <Txt variant="caption" tone="muted" align="center">
                A redeem QR is worth your whole wallet, is valid for 10 minutes, and pays up to half of a bill. Whatever the bill
                does not use stays in your wallet.
                {inRupees ? '' : ` ${formatPoints(data.pointsRatio.points)} points = ${formatINR(data.pointsRatio.rupees)}.`}
              </Txt>
            ) : data ? (
              <Txt variant="caption" tone="muted" align="center">
                Redeem QR is not available right now. Please check back later.
                {inRupees ? '' : ` ${formatPoints(data.pointsRatio.points)} points = ${formatINR(data.pointsRatio.rupees)}.`}
              </Txt>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.history}>
            <SectionLabel
              label="Transaction history"
              action={isFiltered(filters) ? 'Clear filters' : undefined}
              onAction={() => changeFilters(DEFAULT_TRANSACTION_FILTERS)}
            />
            <TransactionFilters value={filters} onChange={changeFilters} />
            {!query ? (
              <Txt variant="small" tone="muted" align="center" style={styles.hint}>
                Enter both dates as DD/MM/YYYY, or leave one empty.
              </Txt>
            ) : history.isError ? (
              <StateView
                tone="error"
                icon="cloud-offline-outline"
                title="Couldn’t load your transactions"
                message={describeError(history.error)}
                actionLabel="Try again"
                onAction={() => history.refetch()}
              />
            ) : history.isLoading || wallet.isLoading ? (
              <ListSkeleton rows={4} />
            ) : transactions.length > 0 ? (
              <View style={history.isPlaceholderData ? styles.stale : undefined}>
                {transactions.map((transaction, i) => (
                  <View key={transaction.id}>
                    {i > 0 && <Divider inset={40 + space.md} />}
                    <TransactionRow
                      transaction={transaction}
                      format={format}
                      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
                    />
                  </View>
                ))}
                {history.data?.hasMore ? (
                  <Button
                    label="Show more"
                    variant="secondary"
                    onPress={() => setLimit((l) => l + PAGE_SIZE)}
                    loading={history.isFetching}
                    style={styles.more}
                  />
                ) : null}
              </View>
            ) : isFiltered(filters) ? (
              <StateView icon="funnel-outline" title="No matching transactions" message="Try another type or date range." />
            ) : (
              <StateView
                icon="wallet-outline"
                title={`No ${noun} yet`}
                message={`Show your Personal Discount QR when you shop, or share your Referral QR. ${Noun} and cashback appear here after each bill, with their expiry date.`}
              />
            )}
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The bar brings its own side padding; pull it out of the screen gutter.
  header: { marginHorizontal: -GUTTER, marginBottom: space.sm },
  hero: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.maroonSoft,
    gap: space.xs,
  },
  heroSkeleton: { alignItems: 'center', marginVertical: space.sm },
  total: { fontFamily: fonts.bold, fontSize: 60, lineHeight: 70, letterSpacing: -2, color: colors.gold, textAlign: 'center' },
  split: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    marginTop: space.sm,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  splitCell: { alignItems: 'center', gap: 2 },
  redeem: { marginTop: space.md },
  send: { marginTop: space.xs },
  history: { marginTop: space.xxl },
  hint: { paddingVertical: space.lg },
  stale: { opacity: 0.6 },
  more: { marginTop: space.md },
});
