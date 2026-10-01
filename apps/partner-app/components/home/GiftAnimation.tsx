import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../theme/tokens';

const GIFT = require('../../assets/Gift.gif');

/** Gift.gif is drawn on this opaque backdrop, so it is shown on a disc of the same colour. */
const GIFT_BACKDROP = '#F2F3F6';

/** The looping gift box on a gold-ringed disc. expo-image loops animated GIFs by default. */
export function GiftAnimation({ size }: { size: number }) {
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={GIFT} style={{ width: size, height: size }} contentFit="cover" autoplay accessibilityLabel="A gift box" />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { overflow: 'hidden', backgroundColor: GIFT_BACKDROP, borderWidth: 2, borderColor: colors.gold },
});
