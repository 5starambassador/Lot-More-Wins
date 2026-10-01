import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Txt } from './Txt';

/**
 * Labelled input. The border warms to gold on focus and turns coral on error;
 * no filled boxes or heavy chrome.
 */
export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; error?: string | null; hint?: string; prefix?: string; accessory?: ReactNode }
>(function Field({ label, error, hint, prefix, accessory, onFocus, onBlur, style, ...input }, ref) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.gold : colors.line;

  return (
    <View style={styles.wrap}>
      <Txt variant="smallMedium" tone="secondary" style={styles.label}>
        {label}
      </Txt>
      <View style={[styles.box, { borderColor }]}>
        {prefix ? (
          <View style={styles.prefix}>
            <Txt variant="bodyMedium" tone="secondary">
              {prefix}
            </Txt>
          </View>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.gold}
          cursorColor={colors.gold}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
          accessibilityLabel={label}
          {...input}
        />
        {accessory}
      </View>
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.helper} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone="muted" style={styles.helper}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  label: { marginBottom: space.xs },
  box: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  prefix: {
    paddingLeft: space.md,
    paddingRight: space.sm,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    // Stretch rather than a percentage height: a % of the auto-height box is measured
    // inconsistently on Android and leaves blank space under the field.
    alignSelf: 'stretch',
    marginVertical: space.sm,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  helper: { marginTop: 6 },
});
