import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts } from '../../theme/tokens';
import { Txt } from '../ui/Txt';

const LOGO = require('../../assets/brand/logo.png');

/** The Lot More logo on its white tile, edged with a fine gold ring so it sits cleanly on the maroon canvas. */
export function BrandLogo({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={LOGO}
      accessibilityLabel="Lot More"
      contentFit="contain"
      style={[styles.logo, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}
    />
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
  logo: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.gold },
});
