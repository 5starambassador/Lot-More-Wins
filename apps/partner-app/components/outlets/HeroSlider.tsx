import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { colors, space } from '../../theme/tokens';

const AUTO_SLIDE_MS = 4000;

/**
 * The outlet's photos as a banner that slides by itself and by swipe. Tapping a photo opens
 * it in the viewer. Sliding pauses while a finger is on it and while `paused` (the viewer is open).
 */
export function HeroSlider({
  images,
  width,
  height,
  paused = false,
  onOpen,
  children,
}: {
  images: string[];
  width: number;
  height: number;
  paused?: boolean;
  onOpen: (index: number) => void;
  /** Drawn over the photos and under the dots (the hero's fade). */
  children?: ReactNode;
}) {
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const many = images.length > 1;

  useEffect(() => {
    if (!many || paused || dragging || width <= 0) return;
    const timer = setTimeout(() => {
      scroller.current?.scrollTo({ x: ((index + 1) % images.length) * width, animated: true });
    }, AUTO_SLIDE_MS);
    return () => clearTimeout(timer);
  }, [many, paused, dragging, index, images.length, width]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (next !== index && next >= 0 && next < images.length) setIndex(next);
  };

  return (
    <View style={{ width, height }}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        scrollEnabled={many}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
      >
        {images.map((uri, i) => (
          <Pressable
            key={uri}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open photo ${i + 1} of ${images.length}`}
            onPress={() => onOpen(i)}
            style={{ width, height }}
          >
            <Image source={{ uri }} style={styles.fill} contentFit="cover" transition={200} />
          </Pressable>
        ))}
      </ScrollView>
      {children}
      {many ? (
        <View pointerEvents="none" style={styles.dots}>
          {images.map((uri, i) => (
            <View key={uri} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  // Bottom right, clear of the logo that overlaps the middle of the bottom edge.
  dots: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.xs,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(20, 2, 2, 0.6)',
    zIndex: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.45)' },
  dotActive: { width: 16, backgroundColor: colors.gold },
});
