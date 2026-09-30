import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../lib/api';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, FullScreenLoader, SectionLabel, StateView, TopBar, Txt } from '../../components/ui';
import { OutletLogo } from '../../components/outlets/OutletLogo';
import { describeError, useOutlets } from '../../lib/queries';
import { colors, GUTTER, radius, space } from '../../theme/tokens';

const WIDTH = Dimensions.get('window').width;

function ContactAction({ icon, label, onPress }: { icon: 'call-outline' | 'mail-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.contact, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <Ionicons name={icon} size={18} color={colors.gold} />
      <Txt variant="smallMedium">{label}</Txt>
    </Pressable>
  );
}

/** Outlet details, read from the same active-outlet list the Outlets tab loads. */
export default function OutletDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const outlets = useOutlets();
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
          actionLabel={outlets.isError ? 'Try again' : 'Back to outlets'}
          onAction={outlets.isError ? () => outlets.refetch() : () => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <TopBar title={outlet.name} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {images.length > 0 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} accessibilityLabel="Outlet photos">
              {images.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.hero} contentFit="cover" transition={200} />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <Txt variant="caption" tone="muted" style={styles.photoCount}>
                {images.length} photos · swipe to view
              </Txt>
            )}
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.body}>
          <View style={styles.identity}>
            <OutletLogo outlet={outlet} size={64} />
            <View style={styles.flex}>
              <Txt variant="title">{outlet.name}</Txt>
              <Badge label="Participating outlet" />
            </View>
          </View>

          <View style={styles.contacts}>
            <ContactAction icon="call-outline" label="Call" onPress={() => Linking.openURL(`tel:${outlet.mobile}`)} />
            <ContactAction icon="mail-outline" label="Email" onPress={() => Linking.openURL(`mailto:${outlet.email}`)} />
          </View>

          <SectionLabel label="Contact" />
          <View style={styles.detail}>
            <Txt variant="small" tone="muted">
              Phone
            </Txt>
            <Txt variant="body" selectable>
              {outlet.mobile}
            </Txt>
          </View>
          <View style={styles.detail}>
            <Txt variant="small" tone="muted">
              Email
            </Txt>
            <Txt variant="body" selectable>
              {outlet.email}
            </Txt>
          </View>

          <View style={styles.howTo}>
            <SectionLabel label="Using your codes here" />
            <View style={styles.step}>
              <Txt variant="smallMedium" tone="gold" style={styles.stepNo}>
                1
              </Txt>
              <Txt variant="small" tone="secondary" style={styles.flex}>
                At billing, show your Discount QR from the Home tab. The outlet scans it and your discount is applied.
              </Txt>
            </View>
            <View style={styles.step}>
              <Txt variant="smallMedium" tone="gold" style={styles.stepNo}>
                2
              </Txt>
              <Txt variant="small" tone="secondary" style={styles.flex}>
                Friends and family can show your Referral QR here, and you earn points on their bill.
              </Txt>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Show my discount code" onPress={() => router.navigate('/dashboard')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, gap: 6 },
  scroll: { paddingBottom: space.xl },
  hero: { width: WIDTH, height: 220, backgroundColor: colors.surface },
  photoCount: { paddingHorizontal: GUTTER, marginTop: space.xs },
  body: { paddingHorizontal: GUTTER, paddingTop: space.xl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  contacts: { flexDirection: 'row', gap: space.sm, marginVertical: space.xl },
  contact: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  detail: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  howTo: { marginTop: space.xxl },
  step: { flexDirection: 'row', gap: space.md, paddingVertical: space.xs },
  stepNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.goldLine,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
