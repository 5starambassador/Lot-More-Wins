import { StyleSheet, View } from 'react-native';
import type { ScanResult } from '@lotmorewins/types';
import { Badge, Divider, IconMark, InfoRow, Panel, Txt } from '../ui';
import { classificationLabel, formatPercent } from '../../lib/format';
import { colors, radius, space } from '../../theme/tokens';

/** Partner resolved by the server from the scanned QR, with the discount the settings give them. */
export function PartnerCard({ scan, compact = false }: { scan: ScanResult; compact?: boolean }) {
  const isReferral = scan.qrType === 'REFERRAL';
  const { partner, discount } = scan;

  const discountLabel = isReferral ? 'Referral discount' : discount.isFirstTime ? 'First-time bonus discount' : 'Partner discount';
  const discountHint = isReferral
    ? `For the customer · ${classificationLabel(partner.classification)} partner rate`
    : discount.isFirstTime
      ? `First redemption · ${classificationLabel(partner.classification)}`
      : 'Register bonus already used';

  return (
    <Panel style={styles.card}>
      <View style={styles.head}>
        <IconMark name={isReferral ? 'people-outline' : 'person-outline'} />
        <View style={styles.flex}>
          <Txt variant="overline" tone="gold">
            {isReferral ? 'Referral code of' : 'Partner discount code'}
          </Txt>
          <Txt variant="heading" numberOfLines={1}>
            {partner.name}
          </Txt>
        </View>
        <Badge label={isReferral ? 'Referral QR' : 'Discount QR'} tone={isReferral ? 'muted' : 'gold'} />
      </View>

      {!compact && (
        <View style={styles.details}>
          <InfoRow label="Mobile" value={`+91 ${partner.mobile}`} />
          {!isReferral && <InfoRow label="Email" value={partner.email} />}
          <InfoRow label="Partner type" value={classificationLabel(partner.classification)} />
          <InfoRow label="Partner code" value={partner.partnerCode} />
        </View>
      )}

      <View style={compact ? styles.compactGap : undefined}>
        <Divider />
      </View>
      <View style={styles.discount}>
        <View style={styles.flex}>
          <Txt variant="bodyMedium">{discountLabel}</Txt>
          <Txt variant="caption" tone="muted">
            {discountHint}
          </Txt>
        </View>
        <View style={styles.pct}>
          <Txt variant="title" tone="onGold">
            {formatPercent(discount.discountPercentage)}
          </Txt>
        </View>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.lg },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  details: { marginTop: space.md, marginBottom: space.sm },
  compactGap: { marginTop: space.md },
  discount: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md },
  pct: { backgroundColor: colors.gold, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.xxs },
});
