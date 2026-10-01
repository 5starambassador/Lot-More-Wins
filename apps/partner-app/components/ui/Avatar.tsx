import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import apiClient from '../../lib/api';
import { initials } from '../../lib/format';
import { colors, fonts, goldFrame } from '../../theme/tokens';
import { Txt } from './Txt';

const RING = 2;

/** The partner's profile photo, or their initials on a brand-red disc, inside the gradient gold ring. */
export function Avatar({ name, photoUrl, size = 40 }: { name: string | null | undefined; photoUrl: string | null | undefined; size?: number }) {
  const uri = apiClient.resolveAssetUrl(photoUrl);
  const inner = size - RING * 2;
  const shape = { width: inner, height: inner, borderRadius: inner / 2 };
  return (
    <View style={[styles.ring, goldFrame, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={shape} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.fallback, shape]}>
          <Txt style={{ fontFamily: fonts.semibold, fontSize: size * 0.36, lineHeight: size * 0.5, color: colors.text }}>
            {initials(name)}
          </Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  fallback: { backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
});
