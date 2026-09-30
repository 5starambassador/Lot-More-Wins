import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { colors, radius, space } from '../../theme/tokens';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Small gold-outlined label for status and tiers. */
export function Badge({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'muted' | 'success' }) {
  const color = tone === 'gold' ? colors.gold : tone === 'success' ? colors.success : colors.textSecondary;
  const border = tone === 'gold' ? colors.goldLine : tone === 'success' ? 'rgba(156,196,154,0.35)' : colors.line;
  return (
    <View style={[styles.badge, { borderColor: border }]}>
      <Txt variant="caption" style={{ color, fontFamily: 'Poppins_500Medium' }}>
        {label}
      </Txt>
    </View>
  );
}

/** Section heading: small gold overline with an optional action on the right. */
export function SectionLabel({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Txt variant="overline" tone="gold">
        {label}
      </Txt>
      {action && onAction ? (
        <Pressable hitSlop={10} onPress={onAction} accessibilityRole="button">
          <Txt variant="smallMedium" tone="secondary">
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

/** Row used for settings, profile details and navigation lists. */
export function ListRow({
  icon,
  label,
  value,
  onPress,
  destructive = false,
  trailing,
}: {
  icon?: IconName;
  label: string;
  value?: string | null;
  onPress?: () => void;
  destructive?: boolean;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={destructive ? colors.danger : colors.gold} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Txt variant="body" tone={destructive ? 'danger' : 'default'}>
          {label}
        </Txt>
        {value ? (
          <Txt variant="small" tone="secondary" numberOfLines={1}>
            {value}
          </Txt>
        ) : null}
      </View>
      {trailing ?? (onPress && !destructive ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      {content}
    </Pressable>
  );
}

/** Two-option switcher with an animated gold underline. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [width, setWidth] = useState(0);
  const segment = width / options.length;
  const underline = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withTiming(index * segment, { duration: 220 }) }],
  }));
  return (
    <View style={styles.seg} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={styles.segItem}
          >
            <Txt variant="smallMedium" tone={active ? 'default' : 'muted'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.segLine, underline]} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: space.sm, gap: space.md },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  seg: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: space.sm },
  segLine: { position: 'absolute', left: 0, bottom: -1, height: 2, backgroundColor: colors.gold },
});
