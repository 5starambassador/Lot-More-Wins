import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts } from '../../theme/tokens';
import { Txt } from './Txt';

const LENGTH = 6;

/** Six underlined cells over one hidden input, so paste and SMS autofill work. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);

  const handleChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, LENGTH);
    onChange(cleaned);
    if (cleaned.length === LENGTH) onComplete?.(cleaned);
  };

  return (
    <Pressable accessibilityLabel="Verification code" onPress={() => inputRef.current?.focus()} style={styles.cells}>
      {Array.from({ length: LENGTH }).map((_, index) => {
        const digit = value[index] || '';
        const isCurrent = value.length === index;
        return (
          <View
            key={index}
            style={[styles.cell, { borderBottomColor: digit ? colors.goldMuted : isCurrent ? colors.gold : colors.line }]}
          >
            <Txt style={styles.digit}>{digit}</Txt>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { width: 44, height: 60, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2 },
  digit: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 36, color: colors.text },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
