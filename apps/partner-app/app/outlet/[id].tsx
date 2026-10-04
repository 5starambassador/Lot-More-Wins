import { useState, type ComponentProps } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Outlet } from '@lotmorewins/types';
import apiClient from '../../lib/api';
import * as Haptics from '../../lib/haptics';
import { Button, FullScreenLoader, Glass, SectionLabel, StateView, TopBar, Txt } from '../../components/ui';
import { OutletLogo } from '../../components/outlets/OutletLogo';
import { ImageViewer } from '../../components/outlets/ImageViewer';
import { HeroSlider } from '../../components/outlets/HeroSlider';
import { describeError, useHome, useOutlets } from '../../lib/queries';
import { formatPercent } from '../../lib/format';
import { canvasFill, colors, GUTTER, radius, space } from '../../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const GALLERY_COLUMNS = 3;
const GALLERY_GAP = space.xs;
const HERO_HEIGHT = 230;
const LOGO_SIZE = 104;

function mapsUrl(outlet: Outlet): string | null {
  if (outlet.mapUrl) return outlet.mapUrl;
  if (!outlet.address) return null;
  const query = encodeURIComponent(`${outlet.name}, ${outlet.address}`);
  return Platform.OS === 'ios' ? `http://maps.apple.com/?q=${query}` : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * A smooth fade over the hero photo: slightly dark at the top for the status bar and back
 * button, clear in the middle, melting into the page colour at the bottom.
 */
function HeroShade() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="heroShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#140202" stopOpacity={0.5} />
            <Stop offset="0.3" stopColor="#140202" stopOpacity={0} />
            <Stop offset="0.55" stopColor={colors.canvas} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.canvas} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#heroShade)" />
      </Svg>
    </View>
  );
}

/** Round glass button floating over the hero photo. */
function HeroButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

/** Call / Email / Directions: a glass tile with a gold icon. */
function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Glass onPress={onPress} accessibilityLabel={label} style={styles.quick} rounded={radius.lg}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <Txt variant="smallMedium">{label}</Txt>
    </Glass>
  );
}

function DetailRow({ icon, label, value, last = false }: { icon: IconName; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detail, !last && styles.detailDivider]}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
      <View style={styles.flex}>
        <Txt variant="caption" tone="muted">
          {label}
        </Txt>
        <Txt variant="body" selectable>
          {value}
        </Txt>
      </View>
    </View>
  );
}

/** Outlet details: photo hero, logo, name and description, contact details, location and a square photo gallery. */
export default function OutletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const outlets = useOutlets();
  const home = useHome();
  const [viewing, setViewing] = useState<number | null>(null);

  const outlet = outlets.data?.find((o) => o.id === id);
  const images = (outlet?.images ?? []).map((u) => apiClient.resolveAssetUrl(u)).filter((u): u is string => !!u);

  if (outlets.isLoading) return <FullScreenLoader />;

  if (!outlet) {
    return (
      <SafeAreaView style={styles.root}>
        <TopBar />
        <StateView
          tone={outlets.isError ? 'error' : 'neutral'}
          icon={outlets.isError ? 'cloud-offline-outline' : 'storefront-outline'}
          title={outlets.isError ? 'Couldn’t load this outlet' : 'Outlet unavailable'}
          message={outlets.isError ? describeError(outlets.error) : 'This outlet is no longer participating.'}
          actionLabel={outlets.isError ? 'Try again' : 'Back to home'}
          onAction={outlets.isError ? () => outlets.refetch() : () => router.back()}
        />
      </SafeAreaView>
    );
  }

  const tile = Math.floor((width - GUTTER * 2 - GALLERY_GAP * (GALLERY_COLUMNS - 1)) / GALLERY_COLUMNS);
  const directions = mapsUrl(outlet);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/dashboard'));
  const open = (url: string) => {
    Haptics.selectionAsync();
    Linking.openURL(url).catch(() => {});
  };

  const offers = home.data?.offers;
  const discount = offers ? (offers.firstTimeAvailable && offers.firstTimeDiscount > 0 ? offers.firstTimeDiscount : offers.repeatDiscount) : 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} showsVerticalScrollIndicator={false}>
        {/* Hero: the gallery photos sliding by, darkened towards the page so the logo and name sit on it cleanly. */}
        <View style={styles.hero}>
          {images.length > 0 ? (
            <HeroSlider images={images} width={width} height={HERO_HEIGHT} paused={viewing !== null} onOpen={setViewing}>
              <HeroShade />
            </HeroSlider>
          ) : (
            <View style={[styles.fill, styles.heroEmpty]}>
              <Ionicons name="storefront-outline" size={64} color={colors.goldLine} />
              <HeroShade />
            </View>
          )}
        </View>

        <Animated.View entering={FadeIn.duration(350)} style={styles.identity}>
          <View style={styles.logoRing}>
            <OutletLogo outlet={outlet} size={LOGO_SIZE} round />
          </View>
          <Txt variant="title" align="center" style={styles.name}>
            {outlet.name}
          </Txt>
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.gold} />
            <Txt variant="caption" tone="gold">
              Lot More partner outlet
            </Txt>
          </View>
          {outlet.description ? (
            <Txt variant="body" tone="secondary" align="center" style={styles.description}>
              {outlet.description}
            </Txt>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={[styles.pad, styles.quickRow]}>
          <QuickAction icon="call" label="Call" onPress={() => open(`tel:${outlet.mobile}`)} />
          <QuickAction icon="mail" label="Email" onPress={() => open(`mailto:${outlet.email}`)} />
          {directions ? <QuickAction icon="navigate" label="Directions" onPress={() => open(directions)} /> : null}
        </Animated.View>

        {discount > 0 ? (
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.pad}>
            <View style={styles.offer}>
              <View style={styles.offerFigure}>
                <Txt variant="heading" tone="onGold">
                  {formatPercent(discount)}
                </Txt>
                <Txt variant="caption" tone="onGold">
                  off
                </Txt>
              </View>
              <View style={styles.flex}>
                <Txt variant="bodyMedium">Your partner discount here</Txt>
                <Txt variant="small" tone="secondary">
                  Show your Personal Discount QR at billing.
                </Txt>
              </View>
              <Button
                label="Show QR"
                compact
                onPress={() => router.push({ pathname: '/qr/[type]', params: { type: 'discount' } })}
              />
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={[styles.pad, styles.section]}>
          <SectionLabel label="Contact details" />
          <Glass rounded={radius.lg} style={styles.card}>
            <DetailRow icon="call-outline" label="Phone" value={outlet.mobile} />
            <DetailRow icon="mail-outline" label="Email" value={outlet.email} last />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.pad, styles.section]}>
          <SectionLabel label="Location" />
          <Glass rounded={radius.lg} style={styles.card}>
            <DetailRow
              icon="location-outline"
              label="Address"
              value={outlet.address ?? 'This outlet hasn’t added its address yet. Call them for directions.'}
              last={!directions}
            />
            {directions ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open in Maps"
                onPress={() => open(directions)}
                style={({ pressed }) => [styles.mapLink, pressed && { backgroundColor: colors.glassPressed }]}
              >
                <Ionicons name="map-outline" size={16} color={colors.gold} />
                <Txt variant="smallMedium" tone="gold" style={styles.flex}>
                  Open in Maps
                </Txt>
                <Ionicons name="open-outline" size={16} color={colors.gold} />
              </Pressable>
            ) : null}
          </Glass>
        </Animated.View>

        {images.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(240).duration(400)} style={[styles.pad, styles.section]}>
            <SectionLabel label={`Gallery · ${images.length}`} />
            <View style={styles.gallery}>
              {images.map((uri, index) => (
                <Pressable
                  key={uri}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`Photo ${index + 1} of ${images.length}`}
                  onPress={() => setViewing(index)}
                  style={({ pressed }) => pressed && { opacity: 0.8 }}
                >
                  <Image source={{ uri }} style={[styles.tile, { width: tile, height: tile }]} contentFit="cover" transition={150} />
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Fixed over the hero so the way back is always in reach. */}
      <View pointerEvents="box-none" style={[styles.topActions, { top: insets.top + space.xs }]}>
        <HeroButton icon="arrow-back" label="Go back" onPress={goBack} />
      </View>

      <ImageViewer images={images} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, ...canvasFill },
  flex: { flex: 1 },
  fill: { ...StyleSheet.absoluteFillObject },
  pad: { paddingHorizontal: GUTTER },
  hero: { height: HERO_HEIGHT, backgroundColor: colors.surface },
  heroEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  topActions: { position: 'absolute', left: space.md, right: space.md, flexDirection: 'row', justifyContent: 'space-between' },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20, 2, 2, 0.55)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { alignItems: 'center', marginTop: -LOGO_SIZE / 2, paddingHorizontal: GUTTER },
  logoRing: {
    padding: 4,
    borderRadius: LOGO_SIZE / 2 + 5,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.gold,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  name: { marginTop: space.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  description: { marginTop: space.md },
  quickRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  quick: { flex: 1, alignItems: 'center', paddingVertical: space.md, gap: space.xs },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.maroonSoft,
  },
  offerFigure: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: space.xxl },
  card: { paddingHorizontal: space.md },
  detail: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  detailDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassBorder },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
  },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: GALLERY_GAP },
  tile: { borderRadius: radius.md, backgroundColor: colors.surface },
});
