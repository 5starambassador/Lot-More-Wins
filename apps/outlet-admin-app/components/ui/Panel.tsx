import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '../../theme/tokens';
import { Txt, type TxtTone } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Raised surface with a hairline edge; `accent` gives it the gold rewards edge. */
export function Panel({
  children,
  accent = false,
  style,
}: {
  children: ReactNode;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.panel, accent && styles.accent, style]}>{children}</View>;
}

/** Label on the left, value on the right. `strong` is the total line of a bill. */
export function InfoRow({
  label,
  value,
  strong = false,
  tone = 'default',
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: TxtTone;
}) {
  return (
    <View style={styles.row}>
      <Txt variant={strong ? 'bodyMedium' : 'small'} tone={strong ? 'default' : 'secondary'} style={styles.rowLabel}>
        {label}
      </Txt>
      <Txt variant={strong ? 'heading' : 'bodyMedium'} tone={tone} selectable>
        {value}
      </Txt>
    </View>
  );
}

/** Round icon mark with a gold hairline, as used across the partner app. */
export function IconMark({ name, size = 44, tone = 'gold' }: { name: IconName; size?: number; tone?: 'gold' | 'success' | 'danger' }) {
  const color = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.gold;
  const border = tone === 'success' ? 'rgba(156,196,154,0.4)' : tone === 'danger' ? 'rgba(232,138,128,0.4)' : colors.goldLine;
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2, borderColor: border }]}>
      <Ionicons name={name} size={Math.round(size * 0.45)} color={color} />
    </View>
  );
}

export function StatTile({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={styles.tile}>
      <Txt variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="heading" tone={gold ? 'gold' : 'default'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  accent: { borderColor: colors.goldLine, backgroundColor: colors.maroonSoft },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: space.sm },
  rowLabel: { flexShrink: 1 },
  mark: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: 2,
  },
});
