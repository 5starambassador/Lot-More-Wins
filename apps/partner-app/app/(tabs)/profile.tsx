import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { MessagingMode, UpdatePartnerProfilePayload } from '@lotmorewins/types';
import { partnerProfileUpdateSchema } from '@lotmorewins/validation';
import apiClient from '../../lib/api';
import * as Haptics from '../../lib/haptics';
import {
  AddressFields,
  Avatar,
  Button,
  DateField,
  Field,
  Notice,
  OtpInput,
  Screen,
  SectionLabel,
  TopBar,
  Txt,
  type AddressValue,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth-store';
import { useSignOut } from '../../lib/use-sign-out';
import { describeError } from '../../lib/queries';
import { dobInputToIso, isoToDobInput } from '../../lib/dates';
import { formatDate } from '../../lib/format';
import { colors, GUTTER, radius, space } from '../../theme/tokens';

type FieldKey = 'name' | 'email' | 'mobile' | 'city' | 'state' | 'pincode' | 'dateOfBirth';
type Errors = Partial<Record<FieldKey, string>>;

/** A new mobile number or email must be confirmed with a code before it is saved. */
interface PendingVerification {
  payload: UpdatePartnerProfilePayload;
  /** Mobile number the code was requested for: the new one when it changed, otherwise the current one. */
  identifier: string;
  mode: MessagingMode;
  destination: string;
}

/**
 * Profile: every detail collected at registration is editable here, plus the profile photo,
 * followed by sign out and the app version.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { partner, updatePartner } = useAuthStore();
  const signOut = useSignOut();

  const [name, setName] = useState(partner?.name ?? '');
  const [email, setEmail] = useState(partner?.email ?? '');
  const [mobile, setMobile] = useState(partner?.mobile ?? '');
  const [address, setAddress] = useState<AddressValue>({
    city: partner?.city ?? '',
    state: partner?.state ?? '',
    pincode: partner?.pincode ?? '',
  });
  const [dob, setDob] = useState(isoToDobInput(partner?.dateOfBirth));

  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Pick up the latest profile from the server when the tab is first shown.
  useEffect(() => {
    apiClient
      .getPartnerMe()
      .then((res) => updatePartner(res.data.partner))
      .catch(() => {});
  }, [updatePartner]);

  // Re-seed the form when the stored profile changes (after a save or a refresh), keeping unsaved typing otherwise.
  const profileKey = partner ? JSON.stringify([partner.name, partner.email, partner.mobile, partner.city, partner.state, partner.pincode, partner.dateOfBirth]) : '';
  useEffect(() => {
    if (!partner) return;
    setName(partner.name);
    setEmail(partner.email);
    setMobile(partner.mobile);
    setAddress({ city: partner.city ?? '', state: partner.state ?? '', pincode: partner.pincode ?? '' });
    setDob(isoToDobInput(partner.dateOfBirth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey]);

  if (!partner) return null;

  const clear = (key: FieldKey) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

  /** Only the fields that differ from the saved profile. */
  const buildChanges = (): { payload: UpdatePartnerProfilePayload; errors: Errors } => {
    const payload: UpdatePartnerProfilePayload = {};
    const next: Errors = {};

    if (name.trim() !== partner.name) payload.name = name.trim();
    if (email.trim().toLowerCase() !== partner.email) payload.email = email.trim();
    if (mobile.trim() !== partner.mobile) payload.mobile = mobile.trim();
    if (address.city.trim() !== (partner.city ?? '')) payload.city = address.city.trim();
    if (address.state.trim() !== (partner.state ?? '')) payload.state = address.state.trim();
    if (address.pincode.trim() !== (partner.pincode ?? '')) payload.pincode = address.pincode.trim();

    const dobIso = dobInputToIso(dob);
    if (dob.trim() && !dobIso) next.dateOfBirth = 'Please enter a valid date as DD/MM/YYYY';
    else if ((dobIso ?? null) !== (partner.dateOfBirth ?? null)) payload.dateOfBirth = dobIso;

    const parsed = partnerProfileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) next[issue.path[0] as FieldKey] ??= issue.message;
    }
    return { payload, errors: next };
  };

  const { payload: changes } = buildChanges();
  const dirty = Object.keys(changes).length > 0;

  const save = async (payload: UpdatePartnerProfilePayload) => {
    const res = await apiClient.updatePartnerProfile(payload);
    updatePartner(res.data.partner);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMessage({ tone: 'success', text: 'Your profile has been updated.' });
  };

  const handleSave = async () => {
    setMessage(null);
    const { payload, errors: found } = buildChanges();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSaving(true);
    try {
      if (payload.mobile || payload.email) {
        // Sign-in details: send a code to the new mobile / email and save once it is confirmed.
        // The code is keyed to a mobile number: the new one when it changes, otherwise the current one.
        const identifier = payload.mobile ?? partner.mobile;
        const deliveryEmail = payload.email ?? partner.email;
        const res = await apiClient.sendOtp({ identifier, name: payload.name ?? partner.name, email: deliveryEmail });
        setOtp('');
        setOtpError(null);
        setPending({
          payload,
          identifier,
          mode: res.mode,
          destination: res.mode === 'whatsapp' ? `+91 ${identifier}` : deliveryEmail,
        });
      } else {
        await save(payload);
      }
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (code = otp) => {
    if (!pending || code.length !== 6) return;
    setOtpError(null);
    setVerifying(true);
    try {
      await apiClient.verifyOtp({ identifier: pending.identifier, otp: code });
      await save(pending.payload);
      setPending(null);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setOtpError(describeError(err));
    } finally {
      setVerifying(false);
    }
  };

  const changePhoto = async () => {
    setMessage(null);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset?.base64) return;

      setUploading(true);
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : asset.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const upload = await apiClient.uploadMedia({ mimeType, base64: asset.base64 });
      const res = await apiClient.updatePartnerProfile({ photoUrl: upload.data.url });
      updatePartner(res.data.partner);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Screen edges={['top']}>
        <View style={styles.header}>
          <TopBar title="Profile" onBack={() => router.navigate('/dashboard')} />
        </View>
        <Animated.View entering={FadeIn.duration(400)} style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={changePhoto}
            disabled={uploading}
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.8 }]}
          >
            <Avatar name={partner.name} photoUrl={partner.photoUrl} size={96} />
            <View style={styles.camera}>
              {uploading ? <ActivityIndicator size="small" color={colors.textOnGold} /> : <Ionicons name="camera" size={16} color={colors.textOnGold} />}
            </View>
          </Pressable>
          <Txt variant="title" align="center" style={styles.name}>
            {partner.name}
          </Txt>
          <Txt variant="mono" tone="muted">
            {partner.partnerCode}
          </Txt>
          <Txt variant="caption" tone="muted">
            Partner since {formatDate(partner.createdAt)}
          </Txt>
        </Animated.View>

        {message && <Notice tone={message.tone} message={message.text} />}

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <SectionLabel label="Your details" />
          <Field
            label="Full name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              clear('name');
            }}
            autoCapitalize="words"
            textContentType="name"
            error={errors.name}
          />
          <Field
            label="Email address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clear('email');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            error={errors.email}
          />
          <Field
            label="Mobile number"
            prefix="+91"
            value={mobile}
            onChangeText={(v) => {
              setMobile(v.replace(/\D/g, '').slice(0, 10));
              clear('mobile');
            }}
            keyboardType="phone-pad"
            maxLength={10}
            textContentType="telephoneNumber"
            error={errors.mobile}
            hint="Changing your mobile or email needs a verification code"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.group}>
          <SectionLabel label="Location" />
          <AddressFields
            value={address}
            onChange={(next) => {
              setAddress(next);
              setErrors((e) => ({ ...e, city: undefined, state: undefined, pincode: undefined }));
            }}
            errors={errors}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.group}>
          <SectionLabel label="Birthday" />
          <DateField
            label="Date of birth"
            value={dob}
            onChangeText={(v) => {
              setDob(v);
              clear('dateOfBirth');
            }}
            error={errors.dateOfBirth}
            hint="Unlocks your birthday gift discount. A newly added or changed date counts from 30 days after you save it."
          />
          <Button label="Save changes" onPress={handleSave} loading={saving} disabled={!dirty} />
        </Animated.View>

        <View style={styles.footer}>
          <Button
            label="Log out"
            variant="danger"
            icon={<Ionicons name="log-out-outline" size={18} color={colors.danger} />}
            onPress={signOut}
          />
          <Txt variant="caption" tone="muted" align="center">
            Lot More Wins Partner · Version {Constants.expoConfig?.version ?? '—'}
          </Txt>
        </View>
      </Screen>

      <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} onPress={() => setPending(null)} style={styles.sheetClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
            <Txt variant="heading">Confirm it’s you</Txt>
            <Txt variant="small" tone="secondary" style={styles.sheetCopy}>
              Enter the 6-digit code we sent by {pending?.mode === 'whatsapp' ? 'WhatsApp' : 'email'} to {pending?.destination}.
            </Txt>
            {otpError && <Notice tone="error" message={otpError} />}
            <OtpInput value={otp} onChange={setOtp} onComplete={handleVerify} />
            <Button label="Verify and save" onPress={() => handleVerify()} loading={verifying} disabled={otp.length !== 6} style={styles.sheetAction} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // The bar brings its own side padding; pull it out of the screen gutter.
  header: { marginHorizontal: -GUTTER },
  identity: { alignItems: 'center', paddingTop: space.md, paddingBottom: space.xl, gap: 2 },
  avatarWrap: { width: 96, height: 96 },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: space.md },
  group: { marginTop: space.lg },
  footer: { marginTop: space.xxxl, gap: space.md },
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: space.xl },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.xl,
  },
  sheetClose: { position: 'absolute', top: space.md, right: space.md, zIndex: 1 },
  sheetCopy: { marginTop: space.xs, marginBottom: space.lg },
  sheetAction: { marginTop: space.xl },
});
