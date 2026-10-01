import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { colors } from '../../theme/tokens';

const PALETTE = [colors.gold, colors.goldBright, '#FFFFFF', colors.maroonBright, '#F6DCD6', '#FFD76A'];

interface Piece {
  /** Launch angle in radians, measured from the positive x axis (screen y points down). */
  angle: number;
  distance: number;
  /** How far the piece falls back under gravity by the end of the burst. */
  fall: number;
  spin: number;
  size: number;
  color: string;
  round: boolean;
}

function makePieces(count: number, from: number, to: number, reach: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: from + Math.random() * (to - from),
    distance: reach * (0.45 + Math.random() * 0.55),
    fall: reach * (0.25 + Math.random() * 0.35),
    spin: (Math.random() - 0.5) * 1080,
    size: 6 + Math.random() * 7,
    color: PALETTE[i % PALETTE.length],
    round: i % 3 === 0,
  }));
}

function ConfettiPiece({ piece, progress }: { piece: Piece; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Fast out, slowing as it travels; gravity pulls it back down over the second half.
    const travel = 1 - (1 - p) * (1 - p);
    return {
      opacity: p === 0 ? 0 : p < 0.7 ? 1 : (1 - p) / 0.3,
      transform: [
        { translateX: Math.cos(piece.angle) * piece.distance * travel },
        { translateY: -Math.sin(piece.angle) * piece.distance * travel + piece.fall * p * p },
        { rotate: `${piece.spin * p}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.size, height: piece.round ? piece.size : piece.size * 0.55, borderRadius: piece.round ? piece.size / 2 : 1.5, backgroundColor: piece.color },
        style,
      ]}
    />
  );
}

/** One party popper: a fan of confetti fired from a point. */
function Burst({ pieces, x, y, delay }: { pieces: Piece[]; x: number; y: number; delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }));
  }, [delay, progress]);
  return (
    <View style={[styles.origin, { left: x, top: y }]}>
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} progress={progress} />
      ))}
    </View>
  );
}

/**
 * Party-popper confetti: two poppers fire inwards from the bottom corners and a third
 * bursts from the gift itself. Mount it to play once; `delay` holds it for the box to open.
 */
export function Confetti({ delay = 0, centerY }: { delay?: number; centerY: number }) {
  const { width, height } = useWindowDimensions();
  const reach = Math.min(width, height) * 0.9;
  const bursts = useMemo(
    () => ({
      left: makePieces(26, Math.PI * 0.18, Math.PI * 0.46, reach),
      right: makePieces(26, Math.PI * 0.54, Math.PI * 0.82, reach),
      center: makePieces(30, 0, Math.PI * 2, reach * 0.55),
    }),
    [reach]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Burst pieces={bursts.center} x={width / 2} y={centerY} delay={delay} />
      <Burst pieces={bursts.left} x={0} y={height * 0.86} delay={delay + 120} />
      <Burst pieces={bursts.right} x={width} y={height * 0.86} delay={delay + 240} />
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0 },
  piece: { position: 'absolute' },
});
