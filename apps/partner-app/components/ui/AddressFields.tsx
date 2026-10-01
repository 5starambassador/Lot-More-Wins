import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from '../../lib/haptics';
import { detectAddress, LocationError } from '../../lib/location';
import { colors, space } from '../../theme/tokens';
import { Button } from './Button';
import { Field } from './Field';
import { Notice } from './Feedback';

export interface AddressValue {
  city: string;
  state: string;
  pincode: string;
}

export type AddressErrors = Partial<Record<keyof AddressValue, string>>;

/**
 * City, state and pincode, with a "Use my current location" action that asks for location
 * permission and fills in whatever the device can resolve. Used in registration and profile.
 */
export function AddressFields({
  value,
  onChange,
  errors = {},
}: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  errors?: AddressErrors;
}) {
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const useLocation = async () => {
    setNotice(null);
    setLocating(true);
    try {
      const found = await detectAddress();
      // Keep what the user already typed for any part the device could not resolve.
      onChange({
        city: found.city || value.city,
        state: found.state || value.state,
        pincode: found.pincode || value.pincode,
      });
      const complete = found.city && found.state && found.pincode;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice({
        tone: 'success',
        text: complete ? 'Filled in from your location. Please check it is right.' : 'We filled in what we could find. Please complete the rest.',
      });
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNotice({
        tone: 'error',
        text: error instanceof LocationError ? error.message : 'We couldn’t read your location. Please enter your address manually.',
      });
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <Button
        label="Use my current location"
        variant="secondary"
        loading={locating}
        icon={<Ionicons name="locate-outline" size={18} color={colors.gold} />}
        onPress={useLocation}
        style={styles.locate}
      />
      {notice && <Notice tone={notice.tone} message={notice.text} />}
      <Field
        label="City"
        value={value.city}
        onChangeText={(city) => onChange({ ...value, city })}
        placeholder="e.g. Puducherry"
        autoCapitalize="words"
        textContentType="addressCity"
        error={errors.city}
      />
      <Field
        label="State"
        value={value.state}
        onChangeText={(state) => onChange({ ...value, state })}
        placeholder="e.g. Tamil Nadu"
        autoCapitalize="words"
        textContentType="addressState"
        error={errors.state}
      />
      <Field
        label="Pincode"
        value={value.pincode}
        onChangeText={(pincode) => onChange({ ...value, pincode: pincode.replace(/\D/g, '').slice(0, 6) })}
        placeholder="6-digit pincode"
        keyboardType="number-pad"
        maxLength={6}
        textContentType="postalCode"
        autoComplete="postal-code"
        error={errors.pincode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  locate: { marginBottom: space.lg },
});
