import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { outletProfileUpdateSchema } from '@lotmorewins/validation';
import type { MediaUploadPayload, Outlet } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Badge, Button, Divider, Field, FullScreenLoader, ListRow, Notice, Screen, SectionLabel, StateView, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import apiClient, { describeError } from '../../lib/api';
import { useSession } from '../../store/session-store';
import { colors, fonts, radius, space } from '../../theme/tokens';

const MAX_IMAGES = 10;

async function pickAndUpload(square: boolean): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photos access needed', 'Allow photo library access to choose outlet images.');
    return null;
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    aspect: square ? [1, 1] : undefined,
    quality: 0.6,
    base64: true,
  });
  const asset = picked.canceled ? null : picked.assets[0];
  if (!asset?.base64) return null;

  const mime = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
  const res = await apiClient.uploadMedia({ mimeType: mime as MediaUploadPayload['mimeType'], base64: asset.base64 });
  return res.data.url;
}

interface FormState {
  name: string;
  email: string;
  mobile: string;
  logoUrl: string | null;
  images: string[];
}

const toForm = (o: Outlet): FormState => ({ name: o.name, email: o.email, mobile: o.mobile, logoUrl: o.logoUrl, images: o.images });

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { admin, setOutlet, signOut } = useSession();
  const profile = useQuery({ queryKey: ['outlet-profile'], queryFn: async () => (await apiClient.getOutletProfile()).data });

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<'logo' | 'image' | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (profile.data) {
      setOutlet(profile.data);
      setForm((f) => f ?? toForm(profile.data));
    }
  }, [profile.data, setOutlet]);

  const save = useMutation({
    mutationFn: async (values: FormState) => (await apiClient.updateOutletProfile(values)).data,
    onSuccess: (outlet) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.setQueryData(['outlet-profile'], outlet);
      setOutlet(outlet);
      setForm(toForm(outlet));
      setMessage({ tone: 'success', text: 'Outlet profile saved.' });
    },
    onError: (err) => setMessage({ tone: 'error', text: describeError(err, 'Could not save the profile') }),
  });

  const upload = async (kind: 'logo' | 'image') => {
    if (!form) return;
    setUploading(kind);
    setMessage(null);
    try {
      const url = await pickAndUpload(kind === 'logo');
      if (url) setForm((f) => (f ? (kind === 'logo' ? { ...f, logoUrl: url } : { ...f, images: [...f.images, url] }) : f));
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err, 'Could not upload the image') });
    } finally {
      setUploading(null);
    }
  };

  const onSave = () => {
    if (!form) return;
    setMessage(null);
    const parsed = outletProfileUpdateSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setErrors({});
    save.mutate(form);
  };

  if (profile.isLoading || (!form && !profile.isError)) return <FullScreenLoader />;

  if (profile.isError || !form) {
    return (
      <Screen edges={['top']}>
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load the outlet profile"
          message={describeError(profile.error)}
          actionLabel="Try again"
          onAction={() => profile.refetch()}
        />
      </Screen>
    );
  }

  const logo = apiClient.resolveAssetUrl(form.logoUrl);
  const active = profile.data?.status === 'ACTIVE';

  return (
    <Screen
      edges={['top']}
      refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={() => profile.refetch()} tintColor={colors.gold} />}
      footer={<Button label="Save profile" onPress={onSave} loading={save.isPending} disabled={!!uploading} />}
    >
      <View style={styles.brandRow}>
        <BrandLogo size={36} />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={styles.identity}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change outlet logo"
          onPress={() => upload('logo')}
          disabled={!!uploading}
          style={styles.avatarRing}
        >
          <View style={styles.avatar}>
            {uploading === 'logo' ? (
              <ActivityIndicator color={colors.gold} />
            ) : logo ? (
              <Image source={{ uri: logo }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Txt style={styles.initials}>{initials(form.name || 'Outlet')}</Txt>
            )}
          </View>
          <View style={styles.cameraDot}>
            <Ionicons name="camera" size={14} color={colors.textOnGold} />
          </View>
        </Pressable>
        <Txt variant="title" align="center" style={styles.name}>
          {profile.data?.name}
        </Txt>
        <View style={styles.badges}>
          <Badge label="Outlet Admin" />
          <Badge label={active ? 'Active' : 'Inactive'} tone={active ? 'success' : 'danger'} />
        </View>
        <Txt variant="caption" tone="muted" style={styles.signedIn}>
          Signed in as {admin?.email}
        </Txt>
      </Animated.View>

      {message && <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} />}

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <SectionLabel label="Outlet details" />
        <Field label="Outlet name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} error={errors.name} />
        <Field
          label="Email"
          value={form.email}
          onChangeText={(email) => setForm({ ...form, email })}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Mobile"
          prefix="+91"
          value={form.mobile}
          onChangeText={(mobile) => setForm({ ...form, mobile })}
          error={errors.mobile}
          keyboardType="phone-pad"
          maxLength={14}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.section}>
        <SectionLabel label={`Outlet images · ${form.images.length}/${MAX_IMAGES}`} />
        <View style={styles.grid}>
          {form.images.map((url) => (
            <View key={url} style={styles.thumb}>
              <Image source={{ uri: apiClient.resolveAssetUrl(url) ?? undefined }} style={styles.thumbImage} contentFit="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove image"
                onPress={() => setForm({ ...form, images: form.images.filter((u) => u !== url) })}
                style={styles.remove}
                hitSlop={6}
              >
                <Ionicons name="close" size={14} color={colors.textOnGold} />
              </Pressable>
            </View>
          ))}
          {form.images.length < MAX_IMAGES && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add outlet image"
              onPress={() => upload('image')}
              disabled={!!uploading}
              style={({ pressed }) => [styles.thumb, styles.add, pressed && { backgroundColor: colors.surfacePressed }]}
            >
              {uploading === 'image' ? <ActivityIndicator color={colors.gold} /> : <Ionicons name="add" size={26} color={colors.gold} />}
            </Pressable>
          )}
        </View>
        {errors.images ? (
          <Txt variant="caption" tone="danger" style={{ marginTop: space.xs }}>
            {errors.images}
          </Txt>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.section}>
        <SectionLabel label="More" />
        <ListRow icon="image-outline" label={logo ? 'Change outlet logo' : 'Add outlet logo'} onPress={() => upload('logo')} />
        <Divider inset={36 + space.md} />
        <ListRow icon="log-out-outline" label="Sign out" destructive onPress={() => signOut()} />
      </Animated.View>
    </Screen>
  );
}

const THUMB = 96;

const styles = StyleSheet.create({
  brandRow: { alignItems: 'flex-end', paddingTop: space.lg },
  identity: { alignItems: 'center', paddingTop: space.md, paddingBottom: space.xl },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 92, height: 92 },
  initials: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 38, color: colors.text, letterSpacing: 1 },
  cameraDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: space.lg },
  badges: { flexDirection: 'row', gap: space.xs, marginTop: space.sm },
  signedIn: { marginTop: space.sm },
  section: { marginTop: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  thumbImage: { width: THUMB, height: THUMB },
  remove: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.goldLine },
});
