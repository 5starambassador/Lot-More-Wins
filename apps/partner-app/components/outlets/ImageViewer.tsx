import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { colors, space } from '../../theme/tokens';
import { Txt } from '../ui';

/**
 * Full-screen photo viewer with previous, next and close buttons.
 *
 * An overlay inside the screen rather than a native Modal: the Modal laid its content out at
 * zero size here, which hid the photo and left the buttons outside any touchable area. Render
 * it as the last child of a full-screen view.
 */
export function ImageViewer({
  images,
  index,
  onChange,
  onClose,
}: {
  images: string[];
  /** Image being shown, or null when the viewer is closed. */
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const open = index !== null && images.length > 0;

  // The Android back button closes the viewer instead of leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!open) return null;

  const current = Math.min(index, images.length - 1);
  const hasMany = images.length > 1;

  // Previous and next wrap around the gallery.
  const step = (delta: number) => {
    Haptics.selectionAsync();
    onChange((current + delta + images.length) % images.length);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      accessibilityViewIsModal
      style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.header}>
        <Txt variant="smallMedium" tone="secondary">
          {current + 1} / {images.length}
        </Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.round}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <Image source={{ uri: images[current] }} style={styles.image} contentFit="contain" transition={150} />
        {hasMany ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              hitSlop={10}
              onPress={() => step(-1)}
              style={[styles.round, styles.side, styles.sideLeft]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              hitSlop={10}
              onPress={() => step(1)}
              style={[styles.round, styles.side, styles.sideRight]}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </>
        ) : null}
      </View>

      {hasMany ? (
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" onPress={() => step(-1)} style={styles.control}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Txt variant="smallMedium">Previous</Txt>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next photo" onPress={() => step(1)} style={styles.control}>
            <Txt variant="smallMedium">Next</Txt>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Above everything else on the screen, including elevated cards.
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 24, backgroundColor: 'rgb(12, 1, 1)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { flex: 1, justifyContent: 'center' },
  image: { ...StyleSheet.absoluteFillObject },
  side: { position: 'absolute', backgroundColor: 'rgba(20, 2, 2, 0.6)' },
  sideLeft: { left: space.sm },
  sideRight: { right: space.sm },
  controls: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  control: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
});
