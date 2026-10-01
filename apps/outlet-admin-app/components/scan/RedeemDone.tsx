import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { RedemptionReceipt } from '@lotmorewins/types';
import { Button, Divider, IconMark, InfoRow, Notice, Panel, Txt } from '../ui';
import { formatDateTime, formatINR, formatPoints } from '../../lib/format';
import { space } from '../../theme/tokens';

/** Confirmation after a wallet redemption: what was taken off the bill and what is left. */
export function RedeemDone({ receipt, onNext }: { receipt: RedemptionReceipt; onNext: () => void }) {
  return (
    <View>
      <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
        <IconMark name="checkmark" size={68} tone="success" />
        <Txt variant="title" align="center" style={styles.heroTitle}>
          {formatINR(receipt.rupeeValue)} redeemed
        </Txt>
        <Txt variant="small" tone="secondary">
          {formatDateTime(receipt.createdAt)}
        </Txt>
      </Animated.View>

      {receipt.replayed && <Notice tone="info" message="This redeem QR had already been redeemed here. Showing the saved record." />}

      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Panel style={styles.section}>
          <Txt variant="bodyMedium">{receipt.partner.name} (partner)</Txt>
          <Txt variant="caption" tone="muted" style={styles.sub}>
            +91 {receipt.partner.mobile} · {receipt.partner.partnerCode}
          </Txt>
          <InfoRow label="Take off the bill" value={formatINR(receipt.rupeeValue)} strong tone="gold" />
          <InfoRow label="Points used" value={`− ${formatPoints(receipt.points)}`} />
          <View style={styles.gap}>
            <Divider />
          </View>
          <InfoRow label="Remaining balance" value={formatPoints(receipt.balancePoints)} />
          <InfoRow label="Remaining worth" value={formatINR(receipt.balanceRupeeValue)} />
        </Panel>

        <Button label="Scan next" onPress={onNext} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.md, paddingBottom: space.xl },
  heroTitle: { marginTop: space.md },
  section: { marginBottom: space.lg },
  sub: { marginBottom: space.sm },
  gap: { marginVertical: space.xs },
});
