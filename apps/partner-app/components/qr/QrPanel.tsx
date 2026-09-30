import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import QRCodeSvg from 'react-native-qrcode-svg';
import { colors, radius, space } from '../../theme/tokens';
import { Txt } from '../ui';

const QR_SIZE = 196;

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = pos[0] === 't';
  const left = pos[1] === 'l';
  return (
    <View
      style={[
        styles.corner,
        top ? { top: 0, borderTopWidth: 2 } : { bottom: 0, borderBottomWidth: 2 },
        left ? { left: 0, borderLeftWidth: 2 } : { right: 0, borderRightWidth: 2 },
      ]}
    />
  );
}

/**
 * The QR on an ivory plate (maximum scan contrast) framed by gold corner brackets,
 * with the permanent code printed beneath it.
 */
export function QrPanel({ code }: { code: string | undefined }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.frame}>
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
        <View style={styles.plate}>
          {code ? (
            <Animated.View key={code} entering={FadeIn.duration(250)}>
              <QRCodeSvg value={code} size={QR_SIZE} color={colors.canvas} backgroundColor="#FBF7F0" />
            </Animated.View>
          ) : (
            <View style={styles.pending}>
              <ActivityIndicator color={colors.maroon} />
            </View>
          )}
        </View>
      </View>
      <Txt variant="mono" tone="secondary" style={styles.code} selectable accessibilityLabel={code ? `Code ${code}` : 'Code loading'}>
        {code ?? '—'}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  frame: { padding: 14 },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: colors.gold },
  plate: { backgroundColor: '#FBF7F0', padding: space.md, borderRadius: radius.sm },
  pending: { width: QR_SIZE, height: QR_SIZE, alignItems: 'center', justifyContent: 'center' },
  code: { marginTop: space.md },
});
