import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerReferredByPayload, ReferredByType } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { describeError, useOutletOptions } from '../../lib/queries';
import { colors, radius, space } from '../../theme/tokens';
import { Field, Txt } from '../ui';

const OPTIONS: { value: ReferredByType; label: string }[] = [
  { value: 'PARTNER', label: 'Partner' },
  { value: 'OUTLET', label: 'Outlet' },
  { value: 'MARKETING_REP', label: 'Marketing rep' },
  { value: 'OTHER', label: 'Others' },
];

export type ReferredByErrors = { partnerCode?: string; outletId?: string; other?: string };

/**
 * Optional "Referred by" answer of the registration contact step. Tapping the selected option
 * again clears it. Partner asks for that partner's ID, Outlet for one of the onboarded outlets,
 * Others for a short note; Marketing rep needs nothing more.
 */
export function ReferredByFields({
  value,
  onChange,
  errors = {},
}: {
  value: PartnerReferredByPayload | null;
  onChange: (value: PartnerReferredByPayload | null) => void;
  errors?: ReferredByErrors;
}) {
  const [listOpen, setListOpen] = useState(false);
  const outlets = useOutletOptions(value?.type === 'OUTLET');
  const chosenOutlet = outlets.data?.find((o) => o.id === value?.outletId);

  const choose = (type: ReferredByType) => {
    Haptics.selectionAsync();
    onChange(value?.type === type ? null : { type });
  };

  return (
    <View style={styles.wrap}>
      <Txt variant="smallMedium" tone="secondary" style={styles.label}>
        Referred by <Txt variant="small" tone="muted">(optional)</Txt>
      </Txt>
      <View style={styles.options} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const active = value?.type === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => choose(option.value)}
              style={[styles.option, active && styles.optionActive]}
            >
              <Txt variant="smallMedium" tone={active ? 'gold' : 'secondary'}>
                {option.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {value?.type === 'PARTNER' && (
        <View style={styles.detail}>
          <Field
            label="Partner ID"
            value={value.partnerCode ?? ''}
            onChangeText={(partnerCode) => onChange({ type: 'PARTNER', partnerCode })}
            placeholder="e.g. LMW-P-1A2B3C"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            hint="The ID of the partner who referred you."
            error={errors.partnerCode}
          />
        </View>
      )}

      {value?.type === 'OUTLET' && (
        <View style={styles.detail}>
          <Txt variant="smallMedium" tone="secondary" style={styles.label}>
            Outlet
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose an outlet"
            onPress={() => setListOpen(true)}
            style={[styles.select, errors.outletId ? { borderColor: colors.danger } : null]}
          >
            <Txt variant="body" tone={chosenOutlet ? 'default' : 'muted'} numberOfLines={1} style={styles.selectText}>
              {chosenOutlet?.name ?? 'Choose an outlet'}
            </Txt>
            <Ionicons name="chevron-down" size={18} color={colors.gold} />
          </Pressable>
          {errors.outletId ? (
            <Txt variant="caption" tone="danger" style={styles.helper}>
              {errors.outletId}
            </Txt>
          ) : null}
        </View>
      )}

      {value?.type === 'OTHER' && (
        <View style={styles.detail}>
          <Field
            label="Who referred you?"
            value={value.other ?? ''}
            onChangeText={(other) => onChange({ type: 'OTHER', other })}
            placeholder="e.g. A friend, social media"
            maxLength={120}
            error={errors.other}
          />
        </View>
      )}

      <Modal visible={listOpen} transparent animationType="fade" onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setListOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Txt variant="bodyMedium" style={styles.sheetTitle}>
              Choose an outlet
            </Txt>
            {outlets.isLoading ? (
              <Txt variant="small" tone="muted" style={styles.sheetNote}>
                Loading outlets…
              </Txt>
            ) : outlets.isError ? (
              <Pressable accessibilityRole="button" onPress={() => outlets.refetch()}>
                <Txt variant="small" tone="danger" style={styles.sheetNote}>
                  {describeError(outlets.error)} Tap to try again.
                </Txt>
              </Pressable>
            ) : !outlets.data?.length ? (
              <Txt variant="small" tone="muted" style={styles.sheetNote}>
                No outlets are available yet.
              </Txt>
            ) : (
              <ScrollView style={styles.list}>
                {outlets.data.map((outlet) => {
                  const active = outlet.id === value?.outletId;
                  return (
                    <Pressable
                      key={outlet.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onChange({ type: 'OUTLET', outletId: outlet.id });
                        setListOpen(false);
                      }}
                      style={styles.row}
                    >
                      <Txt variant="body" tone={active ? 'gold' : 'default'} style={styles.selectText}>
                        {outlet.name}
                      </Txt>
                      {active ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  label: { marginBottom: space.xs },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  option: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  // The Field inside carries its own bottom margin; cancel the wrapper's so spacing stays even.
  detail: { marginTop: space.md, marginBottom: -space.lg },
  select: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: space.lg,
  },
  selectText: { flex: 1 },
  helper: { marginTop: -space.sm, marginBottom: space.lg },
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: space.xl },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  sheetTitle: { marginBottom: space.sm },
  sheetNote: { paddingVertical: space.md },
  list: { flexGrow: 0 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
