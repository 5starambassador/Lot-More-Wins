import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { AppState, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { Outlet } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Avatar, Glass, ListSkeleton, Screen, SectionLabel, StateView, Txt } from '../../components/ui';
import { OutletLogo } from '../../components/outlets/OutletLogo';
import { BrandLogo, Wordmark } from '../../components/brand/Brand';
import { WelcomeGift } from '../../components/home/WelcomeGift';
import { UpdatePopup } from '../../components/home/UpdatePopup';
import { ReferralProgress } from '../../components/home/ReferralProgress';
import { HomeStats, InviteCard } from '../../components/home/HomeExtras';
import { useAuthStore } from '../../store/auth-store';
import { describeError, useHome, useOutlets, useWallet } from '../../lib/queries';
import { firstName, greeting } from '../../lib/format';
import { walletFormat } from '../../lib/wallet-display';
import { APP_VERSION, isOlderVersion } from '../../lib/app-version';
import { colors, fonts, goldFrame, space } from '../../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Shown until the server's goal arrives. */
const DEFAULT_REFERRAL_GOAL = 10;

function QrButton({ icon, title, caption, onPress }: { icon: IconName; title: string; caption: string; onPress: () => void }) {
  return (
    <Glass onPress={onPress} accessibilityLabel={title} style={styles.qrButton}>
      <View style={styles.qrIcon}>
        <Ionicons name={icon} size={22} color={colors.gold} />
      </View>
      <Txt variant="bodyMedium" style={styles.qrTitle}>
        {title}
      </Txt>
      <View style={styles.qrCaption}>
        <Txt variant="caption" tone="muted" style={styles.flex}>
          {caption}
        </Txt>
        <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
      </View>
    </Glass>
  );
}

function OutletButton({ outlet, onPress }: { outlet: Outlet; onPress: () => void }) {
  return (
    <Glass onPress={onPress} accessibilityLabel={outlet.name} style={styles.outlet}>
      <OutletLogo outlet={outlet} size={48} />
      <Txt variant="bodyMedium" numberOfLines={1} style={styles.flex}>
        {outlet.name}
      </Txt>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Glass>
  );
}

/**
 * The Super Admin's "new version" popup (Settings → Home popup), on the phone app only: it asks
 * for the Play Store install, which the web version cannot use. It shows every time the app is
 * opened or brought back to the foreground, while this build is older than the "Latest app
 * version" set there (any version when that is empty), and only while Home is on screen.
 * Closing it hides it until the next open.
 */
function useUpdatePopup(enabled: boolean, latestVersion: string | null | undefined) {
  const [focused, setFocused] = useState(true);
  const [closed, setClosed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  // Coming back from the background counts as opening the app again.
  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') setClosed(false);
      previous = next;
    });
    return () => subscription.remove();
  }, []);

  const outdated = !latestVersion || isOlderVersion(APP_VERSION, latestVersion);
  return { visible: Platform.OS !== 'web' && enabled && outdated && focused && !closed, close: () => setClosed(true) };
}

/** The greeting for the current local time, re-checked every minute while Home is open. */
function useGreeting() {
  const [text, setText] = useState(() => greeting());
  useEffect(() => {
    const timer = setInterval(() => setText(greeting()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return text;
}

export default function HomeScreen() {
  const router = useRouter();
  const { partner, welcome, setWelcome } = useAuthStore();
  const home = useHome();
  const outlets = useOutlets();
  const wallet = useWallet();
  const format = walletFormat(wallet.data);
  const greetingText = useGreeting();
  const update = useUpdatePopup(!!home.data?.homePopupEnabled, home.data?.latestAppVersion);

  const unread = home.data?.unreadNotifications ?? 0;
  const refreshing = home.isRefetching || outlets.isRefetching;

  return (
    <>
      <Screen
        edges={['top']}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              home.refetch();
              outlets.refetch();
              wallet.refetch();
            }}
            tintColor={colors.gold}
          />
        }
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.navbar}>
          <BrandLogo size={48} />
          <View style={styles.flex}>
            <Wordmark size="sm" />
            <View style={styles.tag}>
              <Txt style={styles.tagText}>PARTNER APP</Txt>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={8}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/notifications');
            }}
            style={({ pressed }) => [styles.bell, goldFrame, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.bellFace}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
            </View>
            {unread > 0 ? (
              <View style={styles.dot}>
                <Txt style={styles.dotText}>{unread > 9 ? '9+' : unread}</Txt>
              </View>
            ) : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" hitSlop={6} onPress={() => router.navigate('/profile')}>
            <Avatar name={partner?.name} photoUrl={partner?.photoUrl} size={40} />
          </Pressable>
        </Animated.View>

        <View style={styles.greeting}>
          <Txt variant="small" tone="secondary">
            {greetingText},
          </Txt>
          <Txt variant="title">{firstName(partner?.name)}</Txt>
        </View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.qrRow}>
          <QrButton
            icon="qr-code-outline"
            title="Personal Discount QR"
            caption="Show it at billing"
            onPress={() => router.push({ pathname: '/qr/[type]', params: { type: 'discount' } })}
          />
          <QrButton
            icon="people-outline"
            title="Referral QR"
            caption={`Share and earn ${format.noun}`}
            onPress={() => router.push({ pathname: '/qr/[type]', params: { type: 'referral' } })}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(400)}>
          <ReferralProgress
            successful={home.data?.referrals.successful ?? 0}
            goal={home.data?.referrals.goal ?? DEFAULT_REFERRAL_GOAL}
            rewardAvailable={home.data?.referrals.rewardAvailable ?? false}
            rewardDiscount={home.data?.referrals.rewardDiscount}
            loading={home.isLoading}
            onUseReward={() => router.push({ pathname: '/qr/[type]', params: { type: 'discount' } })}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.outlets}>
          <SectionLabel label="Outlets" />
          {outlets.isLoading ? (
            <ListSkeleton rows={4} />
          ) : outlets.isError ? (
            <StateView
              tone="error"
              icon="cloud-offline-outline"
              title="Couldn’t load outlets"
              message={describeError(outlets.error)}
              actionLabel="Try again"
              onAction={() => outlets.refetch()}
            />
          ) : outlets.data && outlets.data.length > 0 ? (
            <View style={styles.outletList}>
              {outlets.data.map((outlet) => (
                <OutletButton
                  key={outlet.id}
                  outlet={outlet}
                  onPress={() => router.push({ pathname: '/outlet/[id]', params: { id: outlet.id } })}
                />
              ))}
            </View>
          ) : (
            <StateView icon="storefront-outline" title="No outlets yet" message="Participating outlets will appear here as they join." />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={styles.extras}>
          <HomeStats home={home.data} wallet={wallet.data} />
          <InviteCard partnerName={partner?.name} downloadUrl={home.data?.appDownloadUrl} imageUrl={home.data?.inviteImageUrl} />
        </Animated.View>
      </Screen>

      {welcome ? (
        <WelcomeGift
          firstTimeDiscount={home.data?.offers.firstTimeDiscount}
          claimedPoints={welcome.claimedPoints}
          onClose={() => setWelcome(null)}
        />
      ) : update.visible ? (
        <UpdatePopup
          // This phone's platform link from Settings → App downloads; the general app link otherwise.
          downloadUrl={(Platform.OS === 'ios' ? home.data?.appLinks?.ios.url : home.data?.appLinks?.android.url) ?? home.data?.appDownloadUrl}
          onClose={update.close}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  tagText: { fontFamily: fonts.semibold, fontSize: 9, lineHeight: 13, letterSpacing: 1.2, color: colors.gold },
  navbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md },
  // The gradient gold ring; the face sits inside it.
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bellFace: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 14, color: colors.textOnGold },
  greeting: { marginTop: space.xl, marginBottom: space.lg },
  qrRow: { flexDirection: 'row', gap: space.sm },
  qrButton: { flex: 1, padding: space.md, minHeight: 148 },
  qrIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrTitle: { marginTop: space.sm, flex: 1 },
  qrCaption: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  outlets: { marginTop: space.xxl },
  outletList: { gap: space.sm },
  extras: { marginTop: space.xxl, gap: space.lg },
  outlet: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.md },
});
