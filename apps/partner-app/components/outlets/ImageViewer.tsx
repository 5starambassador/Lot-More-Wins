import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { colors, space } from '../../theme/tokens';
import { Txt } from '../ui';

/** Full-screen photo viewer with previous, next and close buttons. */
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
  const open = index !== null && images.length > 0;
  const current = open ? Math.min(index, images.length - 1) : 0;
  const hasMany = images.length > 1;

  // Previous and next wrap around the gallery.
  const step = (delta: number) => {
    Haptics.selectionAsync();
    onChange((current + delta + images.length) % images.length);
  };

  return (
    <Modal visible={open} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.flex}>
          <View style={styles.header}>
            <Txt variant="smallMedium" tone="secondary">
              {current + 1} / {images.length}
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.round}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.stage}>
            {open ? <Image source={{ uri: images[current] }} style={styles.image} contentFit="contain" transition={150} /> : null}
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
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 0, 0, 0.96)' },
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
  image: { width: '100%', height: '100%' },
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
