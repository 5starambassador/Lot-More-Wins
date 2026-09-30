import { useState } from 'react';
import { Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { QRCodeType } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, Screen, Segmented, Skeleton, Txt } from '../../components/ui';
import { QrPanel } from '../../components/qr/QrPanel';
import { BrandLogo } from '../../components/brand/Brand';
import { useAuthStore } from '../../store/auth-store';
import { useWallet } from '../../lib/queries';
import { firstName, formatINR, formatPoints, greeting, tierLabel } from '../../lib/format';
import { colors, radius, space } from '../../theme/tokens';

const COPY: Record<QRCodeType, { title: string; body: string }> = {
  DEFAULT_DISCOUNT: {
    title: 'Your discount code',
    body: 'Show this at the billing counter of any participating outlet to receive your partner discount.',
  },
  REFERRAL: {
    title: 'Your referral code',
    body: 'Share it with family and friends. You earn points whenever they shop with it.',
  },
};

function BalanceStrip() {
  const router = useRouter();
  const wallet = useWallet();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open rewards"
      onPress={() => {
        Haptics.selectionAsync();
        router.push('/rewards');
      }}
      style={({ pressed }) => [styles.balance, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <View style={styles.flex}>
        <Txt variant="overline" tone="muted">
          Rewards balance
        </Txt>
        {wallet.isLoading ? (
          <Skeleton width={120} height={24} style={{ marginTop: 6 }} />
        ) : wallet.isError ? (
          <Txt variant="small" tone="secondary" style={{ marginTop: 4 }}>
            Balance unavailable · tap to retry
          </Txt>
        ) : (
          <View style={styles.balanceRow}>
            <Txt variant="heading" tone="gold">
              {formatPoints(wallet.data?.balancePoints ?? 0)} pts
            </Txt>
            <Txt variant="small" tone="secondary">
              ≈ {formatINR(wallet.data?.rupeeValue ?? 0)}
            </Txt>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { partner, qrCodes } = useAuthStore();
  const wallet = useWallet();
  const [activeTab, setActiveTab] = useState<QRCodeType>('DEFAULT_DISCOUNT');

  const currentQr = qrCodes.find((q) => q.type === activeTab);

  const handleShare = async (code: string, title: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Join Lot More Wins with my partner referral code: ${code}! Enjoy exclusive discounts across participating stores.`,
        title: `Lot More Wins — ${title}`,
      });
    } catch (error) {
      console.error('Error sharing QR:', error);
    }
  };

  return (
    <Screen
      edges={['top']}
      refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()} tintColor={colors.gold} />}
    >
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <BrandLogo size={44} />
        <View style={styles.flex}>
          <Txt variant="small" tone="secondary">
            {greeting()},
          </Txt>
          <Txt variant="title">{firstName(partner?.name)}</Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </Pressable>
      </Animated.View>
      <View style={styles.tierRow}>
        <Badge label={tierLabel(partner)} />
        <Txt variant="caption" tone="muted">
          {partner?.partnerCode}
        </Txt>
      </View>

      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <BalanceStrip />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.qrSection}>
        <Segmented
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'DEFAULT_DISCOUNT', label: 'Discount' },
            { value: 'REFERRAL', label: 'Referral' },
          ]}
        />

        <View style={styles.qrBody}>
          <Txt variant="heading" align="center">
            {COPY[activeTab].title}
          </Txt>
          <Txt variant="small" tone="secondary" align="center" style={styles.qrCopy}>
            {COPY[activeTab].body}
          </Txt>

          <View style={styles.qrWrap}>
            <QrPanel code={currentQr?.code} />
          </View>

          {activeTab === 'REFERRAL' && currentQr ? (
            <Button
              label="Share referral code"
              variant="secondary"
              icon={<Ionicons name="share-outline" size={18} color={colors.gold} />}
              onPress={() => handleShare(currentQr.code, 'Referral QR')}
            />
          ) : (
            <View style={styles.hint}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
              <Txt variant="caption" tone="muted">
                Permanent code — it never changes
              </Txt>
            </View>
          )}
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, marginBottom: space.xl },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.goldLine,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: 2 },
  qrSection: { marginTop: space.xxl },
  qrBody: { paddingTop: space.xl },
  qrCopy: { marginTop: space.xs, marginHorizontal: space.md },
  qrWrap: { marginVertical: space.xl },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 54 },
});
