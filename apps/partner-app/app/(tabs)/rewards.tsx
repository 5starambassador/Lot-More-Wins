import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Divider, ListSkeleton, Screen, SectionLabel, Skeleton, StateView, Txt } from '../../components/ui';
import { ActivityRow } from '../../components/rewards/ActivityRow';
import { BrandLogo } from '../../components/brand/Brand';
import { describeError, useWallet } from '../../lib/queries';
import { formatINR, formatPoints } from '../../lib/format';
import { colors, radius, space } from '../../theme/tokens';

const RECENT = 5;

export default function RewardsScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const data = wallet.data;

  return (
    <Screen
      edges={['top']}
      refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()} tintColor={colors.gold} />}
    >
      <View style={styles.header}>
        <Txt variant="title">Rewards</Txt>
        <BrandLogo size={36} />
      </View>

      {wallet.isError ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load your rewards"
          message={describeError(wallet.error)}
          actionLabel="Try again"
          onAction={() => wallet.refetch()}
        />
      ) : (
        <>
          <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
            <Txt variant="overline" tone="muted">
              Available balance
            </Txt>
            {wallet.isLoading ? (
              <View style={styles.heroSkeleton}>
                <Skeleton width={180} height={40} />
                <Skeleton width={110} height={14} style={{ marginTop: 10 }} />
              </View>
            ) : (
              <>
                <View style={styles.figureRow}>
                  <Txt variant="figure" tone="gold">
                    {formatPoints(data?.balancePoints ?? 0)}
                  </Txt>
                  <Txt variant="subheading" tone="secondary">
                    pts
                  </Txt>
                </View>
                <Txt variant="body" tone="secondary">
                  Worth {formatINR(data?.rupeeValue ?? 0)}
                </Txt>
                {data ? (
                  <Txt variant="caption" tone="muted" style={styles.ratio}>
                    {formatPoints(data.pointsRatio.points)} points = {formatINR(data.pointsRatio.rupees)}
                  </Txt>
                ) : null}
              </>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.split}>
            <View style={styles.splitCell}>
              <Txt variant="caption" tone="muted">
                From purchases
              </Txt>
              <Txt variant="heading">{wallet.isLoading ? '—' : formatPoints(data?.totals.purchasePoints ?? 0)}</Txt>
            </View>
            <View style={styles.splitDivider} />
            <View style={styles.splitCell}>
              <Txt variant="caption" tone="muted">
                From referrals
              </Txt>
              <Txt variant="heading">{wallet.isLoading ? '—' : formatPoints(data?.totals.referralPoints ?? 0)}</Txt>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.recent}>
            <SectionLabel
              label="Recent activity"
              action={data && data.entries.length > RECENT ? 'View all' : undefined}
              onAction={() => router.push('/activity')}
            />
            {wallet.isLoading ? (
              <ListSkeleton rows={3} />
            ) : data && data.entries.length > 0 ? (
              data.entries.slice(0, RECENT).map((entry, i) => (
                <View key={entry.id}>
                  {i > 0 && <Divider inset={40 + space.md} />}
                  <ActivityRow entry={entry} />
                </View>
              ))
            ) : (
              <StateView
                icon="diamond-outline"
                title="No points yet"
                message="Show your Discount QR when you shop, or share your Referral QR. Points appear here after each bill."
              />
            )}
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg, marginBottom: space.lg },
  hero: {
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.maroonSoft,
  },
  heroSkeleton: { marginTop: space.sm },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: space.xs },
  ratio: { marginTop: space.sm },
  split: {
    flexDirection: 'row',
    marginTop: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  splitCell: { flex: 1, paddingHorizontal: space.xs, gap: 2 },
  splitDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginHorizontal: space.sm },
  recent: { marginTop: space.xxl },
});
