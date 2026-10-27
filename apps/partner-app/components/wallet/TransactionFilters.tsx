import { useState, type ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerTransactionFilter, PartnerTransactionsQuery } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { dobInputToIso, localDateToIso } from '../../lib/dates';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { DateField, Txt } from '../ui';

export type TransactionPeriod = 'ALL' | 'TODAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'CUSTOM';

export interface TransactionFilterState {
  type: PartnerTransactionFilter;
  period: TransactionPeriod;
  /** CUSTOM: DD/MM/YYYY as typed. */
  customFrom: string;
  customTo: string;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterState = { type: 'ALL', period: 'ALL', customFrom: '', customTo: '' };

type IconName = ComponentProps<typeof Ionicons>['name'];
type Option<T> = { value: T; label: string; icon: IconName };

const TYPES: Option<PartnerTransactionFilter>[] = [
  { value: 'ALL', label: 'All types', icon: 'layers-outline' },
  { value: 'BILLS', label: 'Bills', icon: 'receipt-outline' },
  { value: 'PURCHASE', label: 'Purchase', icon: 'bag-handle-outline' },
  { value: 'REFERRAL', label: 'Referral', icon: 'people-outline' },
  { value: 'CASHBACK', label: 'Cashback', icon: 'cash-outline' },
  { value: 'RECEIVED', label: 'Received', icon: 'arrow-down-circle-outline' },
  { value: 'SENT', label: 'Sent', icon: 'paper-plane-outline' },
  { value: 'REDEEMED', label: 'Redeemed', icon: 'qr-code-outline' },
];

const PERIODS: Option<TransactionPeriod>[] = [
  { value: 'ALL', label: 'All time', icon: 'infinite-outline' },
  { value: 'TODAY', label: 'Today', icon: 'today-outline' },
  { value: 'LAST_7', label: 'Last 7 days', icon: 'calendar-outline' },
  { value: 'LAST_30', label: 'Last 30 days', icon: 'calendar-outline' },
  { value: 'THIS_MONTH', label: 'This month', icon: 'calendar-number-outline' },
  { value: 'CUSTOM', label: 'Custom range', icon: 'options-outline' },
];

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateToIso(d);
}

/** The date range a filter stands for (calendar dates on the phone); null while a custom range is incomplete or invalid. */
export function filterRange(f: TransactionFilterState): { from?: string; to?: string } | null {
  const today = localDateToIso(new Date());
  switch (f.period) {
    case 'TODAY':
      return { from: today, to: today };
    case 'LAST_7':
      return { from: daysAgo(6), to: today };
    case 'LAST_30':
      return { from: daysAgo(29), to: today };
    case 'THIS_MONTH':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'CUSTOM': {
      const from = f.customFrom ? dobInputToIso(f.customFrom) : undefined;
      const to = f.customTo ? dobInputToIso(f.customTo) : undefined;
      if (from === null || to === null) return null;
      if (from && to && from > to) return null;
      return { from, to };
    }
    default:
      return {};
  }
}

export function toTransactionsQuery(f: TransactionFilterState, limit: number): PartnerTransactionsQuery | null {
  const range = filterRange(f);
  return range ? { type: f.type, ...range, limit } : null;
}

export const isFiltered = (f: TransactionFilterState) => f.type !== 'ALL' || f.period !== 'ALL';

/** A compact select button that opens its options in a popup list; highlighted in gold once moved off its first (default) option. */
function Dropdown<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const active = selected.value !== options[0].value;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${selected.label}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.select, active && styles.selectActive, pressed && styles.selectPressed]}
      >
        <Ionicons name={selected.icon} size={16} color={active ? colors.gold : colors.textSecondary} />
        <Txt variant="smallMedium" numberOfLines={1} style={[styles.selectText, active && styles.selectTextActive]}>
          {selected.label}
        </Txt>
        <Ionicons name="chevron-down" size={14} color={active ? colors.gold : colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Txt variant="overline" tone="muted" style={styles.sheetTitle}>
              {title}
            </Txt>
            <ScrollView style={styles.list}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      if (!isSelected) Haptics.selectionAsync();
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [styles.row, isSelected && styles.rowSelected, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.rowIcon, isSelected && styles.rowIconSelected]}>
                      <Ionicons name={option.icon} size={18} color={isSelected ? colors.textOnGold : colors.gold} />
                    </View>
                    <Txt variant="bodyMedium" tone={isSelected ? 'gold' : 'default'} style={styles.rowText}>
                      {option.label}
                    </Txt>
                    {isSelected ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Transaction type and date range for the wallet history. */
export function TransactionFilters({ value, onChange }: { value: TransactionFilterState; onChange: (next: TransactionFilterState) => void }) {
  const set = (patch: Partial<TransactionFilterState>) => onChange({ ...value, ...patch });
  const fromIso = value.customFrom ? dobInputToIso(value.customFrom) : undefined;
  const toIso = value.customTo ? dobInputToIso(value.customTo) : undefined;
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.selects}>
        <View style={styles.selectCell}>
          <Dropdown title="Transaction type" options={TYPES} value={value.type} onChange={(type) => set({ type })} />
        </View>
        <View style={styles.selectCell}>
          <Dropdown title="Date range" options={PERIODS} value={value.period} onChange={(period) => set({ period })} />
        </View>
      </View>
      {value.period === 'CUSTOM' ? (
        <View style={styles.custom}>
          <View style={styles.dateCell}>
            <DateField
              label="From"
              value={value.customFrom}
              onChangeText={(customFrom) => set({ customFrom })}
              pickerDefault={lastMonth}
              error={value.customFrom.length === 10 && fromIso === null ? 'Enter a past date' : null}
            />
          </View>
          <View style={styles.dateCell}>
            <DateField
              label="To"
              value={value.customTo}
              onChangeText={(customTo) => set({ customTo })}
              pickerDefault={new Date()}
              error={
                value.customTo.length === 10 && toIso === null
                  ? 'Enter a past date'
                  : fromIso && toIso && fromIso > toIso
                    ? 'Must be after From'
                    : null
              }
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginBottom: space.sm },
  // Two equal dropdowns side by side; labels truncate rather than overflow on narrow phones.
  selects: { flexDirection: 'row', gap: space.sm },
  selectCell: { flex: 1, minWidth: 0 },
  select: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.maroonSoft,
  },
  selectActive: { borderColor: colors.goldLine, backgroundColor: colors.goldSoft },
  selectPressed: { opacity: 0.7 },
  selectText: { flex: 1, color: colors.textSecondary },
  selectTextActive: { color: colors.gold, fontFamily: fonts.semibold },
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: space.xl },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  sheetTitle: { marginBottom: space.sm, paddingHorizontal: space.xs },
  list: { flexGrow: 0 },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
  },
  rowSelected: { backgroundColor: colors.goldSoft },
  rowPressed: { backgroundColor: colors.surfacePressed },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  rowIconSelected: { backgroundColor: colors.gold },
  rowText: { flex: 1 },
  custom: { flexDirection: 'row', gap: space.sm },
  dateCell: { flex: 1 },
});
