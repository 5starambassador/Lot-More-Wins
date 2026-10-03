import { useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button, Divider, ListSkeleton, Screen, SectionLabel, Skeleton, StateView, TopBar, Txt } from '../../components/ui';
import { mergeTransactions, TransactionRow } from '../../components/wallet/TransactionRow';
import { describeError, useWallet } from '../../lib/queries';
import { formatINR, formatPoints } from '../../lib/format';
import { walletFormat } from '../../lib/wallet-display';
import { colors, fonts, GUTTER, radius, space } from '../../theme/tokens';

/**
 * Wallet: the balance (purchase + referral), the redeem QR, and the history with expiry dates.
 * Shown in points or rupees according to the Super Admin's "Wallet display" setting.
 */
export default function WalletScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const data = wallet.data;

  const transactions = useMemo(() => (data ? mergeTransactions(data.entries, data.redemptions) : []), [data]);
  const balance = data?.balancePoints ?? 0;
  const format = walletFormat(data);
  const { inRupees, noun } = format;
  const Noun = noun === 'points' ? 'Points' : 'Rewards';

  return (
    <Screen
      edges={['top']}
      refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()} tintColor={colors.gold} />}
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
                  {inRupees ? 'Available to redeem at any outlet' : `Worth ${formatINR(data?.rupeeValue ?? 0)}`}
                </Txt>
                <View style={styles.split}>
                  <View style={styles.splitCell}>
                    <Txt variant="caption" tone="muted">
                      Purchase {noun}
                    </Txt>
                    <Txt variant="subheading">{format.amount(data?.totals.purchasePoints ?? 0)}</Txt>
                  </View>
                  <Txt variant="heading" tone="muted">
                    +
                  </Txt>
                  <View style={styles.splitCell}>
                    <Txt variant="caption" tone="muted">
                      Referral {noun}
                    </Txt>
                    <Txt variant="subheading">{format.amount(data?.totals.referralPoints ?? 0)}</Txt>
                  </View>
                </View>
              </>
            )}

            <Button
              label="Redeem QR"
              icon={<Ionicons name="qr-code-outline" size={18} color={colors.textOnGold} />}
              onPress={() => router.push('/redeem')}
              disabled={wallet.isLoading || balance <= 0}
              style={styles.redeem}
            />
            {!wallet.isLoading && balance <= 0 ? (
              <Txt variant="caption" tone="muted" align="center">
                Earn {noun} on a purchase or a referral to redeem them here.
              </Txt>
            ) : data && !inRupees ? (
              <Txt variant="caption" tone="muted" align="center">
                {formatPoints(data.pointsRatio.points)} points = {formatINR(data.pointsRatio.rupees)}
              </Txt>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.history}>
            <SectionLabel label={inRupees ? 'Transaction history' : 'Points history'} />
            {wallet.isLoading ? (
              <ListSkeleton rows={4} />
            ) : transactions.length > 0 ? (
              transactions.map((transaction, i) => (
                <View key={`${transaction.kind}-${transaction.id}`}>
                  {i > 0 && <Divider inset={40 + space.md} />}
                  <TransactionRow transaction={transaction} format={format} />
                </View>
              ))
            ) : (
              <StateView
                icon="wallet-outline"
                title={`No ${noun} yet`}
                message={`Show your Personal Discount QR when you shop, or share your Referral QR. ${Noun} appear here after each bill, with their expiry date.`}
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
  history: { marginTop: space.xxl },
});
