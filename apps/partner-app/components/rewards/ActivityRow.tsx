import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PointsLedgerEntry } from '@lotmorewins/types';
import { formatDate, formatPoints } from '../../lib/format';
import { colors, space } from '../../theme/tokens';
import { Txt } from '../ui';

/** One points-ledger entry: what it was, where, when, and the points credited. */
export function ActivityRow({ entry }: { entry: PointsLedgerEntry }) {
  const isReferral = entry.type === 'REFERRAL';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${isReferral ? 'Referral' : 'Purchase'} at ${entry.outletName}, plus ${formatPoints(entry.points)} points`}>
      <View style={styles.icon}>
        <Ionicons name={isReferral ? 'people-outline' : 'bag-handle-outline'} size={18} color={colors.gold} />
      </View>
      <View style={styles.text}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {isReferral ? 'Referral reward' : 'Purchase reward'}
        </Txt>
        <Txt variant="small" tone="secondary" numberOfLines={1}>
          {entry.outletName} · {formatDate(entry.createdAt)}
        </Txt>
        {entry.claimedAt ? (
          <Txt variant="caption" tone="muted">
            Earned before registering · added {formatDate(entry.claimedAt)}
          </Txt>
        ) : null}
      </View>
      <Txt variant="bodyMedium" tone="gold">
        +{formatPoints(entry.points)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
});
