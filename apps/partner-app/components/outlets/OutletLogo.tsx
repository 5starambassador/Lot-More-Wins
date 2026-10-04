import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { Outlet } from '@lotmorewins/types';
import apiClient from '../../lib/api';
import { colors, fonts, radius } from '../../theme/tokens';
import { Txt } from '../ui';

/** Outlet logo, or a monogram tile in brand colours when none is uploaded. `round` makes it a circle. */
export function OutletLogo({ outlet, size = 52, round = false }: { outlet: Outlet; size?: number; round?: boolean }) {
  const uri = apiClient.resolveAssetUrl(outlet.logoUrl);
  const shape = { width: size, height: size, ...(round ? { borderRadius: size / 2 } : {}) };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.box, shape]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.box, styles.fallback, shape]}>
      <Txt style={{ fontFamily: fonts.semibold, fontSize: size * 0.4, lineHeight: size * 0.55, color: colors.gold }}>
        {outlet.name.charAt(0).toUpperCase()}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline },
  fallback: { backgroundColor: colors.maroonSoft, alignItems: 'center', justifyContent: 'center', borderColor: colors.goldLine },
});
