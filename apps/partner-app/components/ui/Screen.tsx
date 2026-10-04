import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { canvasFill, colors, GUTTER, space } from '../../theme/tokens';
import { Txt } from './Txt';
import { BrandLogo } from '../brand/Brand';

/**
 * Page container: maroon canvas, safe areas, optional scrolling and a footer pinned
 * above the keyboard for the screen's primary action.
 */
export function Screen({
  children,
  footer,
  scroll = true,
  edges = ['top', 'bottom'],
  refreshControl,
  padded = true,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
  padded?: boolean;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, styles.grow]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.grow, padded && styles.padded]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={styles.root}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Minimal top bar: back arrow, optional centred title and a right-hand slot.
 * Untitled bars centre the logo; titled bars carry it on the right unless `right` is given.
 * The back arrow is always shown (pass `onBack={false}` to hide it): it goes back in history,
 * or to the start of the app when this screen was opened directly.
 */
export function TopBar({
  title,
  onBack,
  right,
  showLogo = true,
}: {
  title?: string;
  onBack?: (() => void) | false;
  right?: ReactNode;
  showLogo?: boolean;
}) {
  const router = useRouter();
  const showBack = onBack !== false;
  const goBack = onBack || (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={goBack}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <Txt variant="subheading" numberOfLines={1} style={styles.topTitle}>
          {title}
        </Txt>
      ) : (
        <View style={[styles.topTitle, styles.topCenter]}>{showLogo ? <BrandLogo size={42} /> : null}</View>
      )}
      <View style={[styles.topSide, styles.topRight]}>{right ?? (title && showLogo ? <BrandLogo size={38} /> : null)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, ...canvasFill },
  grow: { flexGrow: 1 },
  padded: { paddingHorizontal: GUTTER, paddingBottom: space.xl },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: 'transparent',
  },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
  topSide: { width: 48, justifyContent: 'center' },
  topRight: { alignItems: 'flex-end', paddingRight: space.xs },
  topTitle: { flex: 1, textAlign: 'center' },
  topCenter: { alignItems: 'center' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
