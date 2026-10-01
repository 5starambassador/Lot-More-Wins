import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts, goldFrame } from '../../theme/tokens';
import { Txt } from '../ui/Txt';

const LOGO = require('../../assets/brand/logo.png');

const RING = 2;
/** The square artwork is drawn a little smaller than its white disc so the round crop never touches it. */
const ART_SCALE = 0.8;

/** The Lot More logo on a round white disc inside the gradient gold ring. */
export function BrandLogo({ size = 64 }: { size?: number }) {
  const disc = size - RING * 2;
  const art = Math.round(disc * ART_SCALE);
  return (
    <View style={[styles.ring, goldFrame, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2 }]}>
        <Image source={LOGO} accessibilityLabel="Lot More" contentFit="contain" style={{ width: art, height: art }} />
      </View>
    </View>
  );
}

/** Horizontal wordmark with the "Wins" accent in gold. */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const fontSize = size === 'sm' ? 15 : 18;
  return (
    <Txt style={{ fontFamily: fonts.semibold, fontSize, lineHeight: fontSize * 1.4, letterSpacing: 2.4, color: colors.text }}>
      LOT MORE <Txt style={{ fontFamily: fonts.semibold, fontSize, color: colors.gold, letterSpacing: 2.4 }}>WINS</Txt>
    </Txt>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  disc: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
