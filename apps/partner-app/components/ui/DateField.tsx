import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { dobInputToIso, isoToDobInput, isoToLocalDate, localDateToIso, maskDobInput } from '../../lib/dates';
import { colors, radius, space } from '../../theme/tokens';
import { Button } from './Button';
import { Field } from './Field';

/** The calendar opens here when no date has been entered yet. */
const DEFAULT_PICKER_DATE = new Date(1995, 0, 1);
const OLDEST = new Date(new Date().getFullYear() - 120, 0, 1);

/**
 * Date of birth entry: type it as DD/MM/YYYY or pick it from the calendar.
 * `value` is the raw text; use `dobInputToIso(value)` for the validated date.
 */
export function DateField({
  label,
  value,
  onChangeText,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const iso = dobInputToIso(value);
  const pickerDate = iso ? isoToLocalDate(iso) : DEFAULT_PICKER_DATE;
  // The native calendar has no web implementation; typing still works there.
  const hasCalendar = Platform.OS !== 'web';

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    // Android shows a dialog that closes itself; iOS keeps the inline calendar open until Done.
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChangeText(isoToDobInput(localDateToIso(date)));
  };

  const picker = (
    <DateTimePicker
      value={pickerDate}
      mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
      maximumDate={new Date()}
      minimumDate={OLDEST}
      onChange={onPicked}
      themeVariant="dark"
      accentColor={colors.gold}
    />
  );

  return (
    <>
      <Field
        label={label}
        value={value}
        onChangeText={(text) => onChangeText(maskDobInput(text))}
        placeholder="DD/MM/YYYY"
        keyboardType="number-pad"
        maxLength={10}
        error={error}
        hint={hint}
        accessory={
          hasCalendar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose from calendar"
              hitSlop={8}
              onPress={() => setOpen(true)}
              style={styles.calendarBtn}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.gold} />
            </Pressable>
          ) : undefined
        }
      />
      {hasCalendar && open && Platform.OS === 'android' ? picker : null}
      {hasCalendar && Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              {picker}
              <Button label="Done" onPress={() => setOpen(false)} />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  calendarBtn: { paddingHorizontal: space.md, height: 54, justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: space.xl },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.sm,
  },
});
