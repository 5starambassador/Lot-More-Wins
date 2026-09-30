import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import apiClient from '../../lib/api';
import { Badge, Divider, ListRow, Notice, Screen, SectionLabel, Txt } from '../../components/ui';
import { useAuthStore } from '../../store/auth-store';
import { BrandLogo } from '../../components/brand/Brand';
import { useSignOut } from '../../lib/use-sign-out';
import { describeError } from '../../lib/queries';
import { formatDate, roleLabel, tierLabel } from '../../lib/format';
import { colors, fonts, space } from '../../theme/tokens';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen() {
  const router = useRouter();
  const { partner, token, setSession } = useAuthStore();
  const signOut = useSignOut();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh the stored profile from the server (same data the dashboard used to re-fetch).
  const refresh = async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await apiClient.getPartnerMe();
      await setSession(res.data.partner, res.data.qrCodes, token);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setRefreshing(false);
    }
  };

  if (!partner) return null;

  const details: { label: string; value: string | null | undefined }[] = [
    { label: 'Mobile', value: `+91 ${partner.mobile}` },
    { label: 'Email', value: partner.email },
    { label: 'Role', value: roleLabel(partner.role) },
    partner.employeeId ? { label: 'Employee ID', value: partner.employeeId } : null,
    partner.admissionNumber ? { label: 'Child’s admission number', value: partner.admissionNumber } : null,
    { label: 'Member since', value: formatDate(partner.createdAt) },
  ].filter((d): d is { label: string; value: string } => !!d);

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}>
      <View style={styles.brandRow}>
        <BrandLogo size={36} />
      </View>
      <Animated.View entering={FadeIn.duration(400)} style={styles.identity}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Txt style={styles.initials}>{initials(partner.name)}</Txt>
          </View>
        </View>
        <Txt variant="title" align="center" style={styles.name}>
          {partner.name}
        </Txt>
        <View style={styles.badges}>
          <Badge label={tierLabel(partner)} />
          <Badge label={partner.status === 'ACTIVE' ? 'Active' : partner.status} tone={partner.status === 'ACTIVE' ? 'success' : 'muted'} />
        </View>
        <Txt variant="mono" tone="muted" style={styles.code}>
          {partner.partnerCode}
        </Txt>
      </Animated.View>

      {error && <Notice tone="error" message={error} />}

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <SectionLabel label="Account details" />
        {details.map((d, i) => (
          <View key={d.label}>
            {i > 0 && <Divider />}
            <View style={styles.detail}>
              <Txt variant="small" tone="muted">
                {d.label}
              </Txt>
              <Txt variant="body" selectable>
                {d.value}
              </Txt>
            </View>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.actions}>
        <SectionLabel label="More" />
        <ListRow icon="time-outline" label="Points activity" onPress={() => router.push('/activity')} />
        <Divider inset={36 + space.md} />
        <ListRow icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        <Divider inset={36 + space.md} />
        <ListRow icon="log-out-outline" label="Sign out" destructive onPress={signOut} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { alignItems: 'flex-end', paddingTop: space.lg },
  identity: { alignItems: 'center', paddingTop: space.md, paddingBottom: space.xl },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 36, color: colors.text, letterSpacing: 1 },
  name: { marginTop: space.lg },
  badges: { flexDirection: 'row', gap: space.xs, marginTop: space.sm },
  code: { marginTop: space.sm },
  detail: { paddingVertical: space.sm, gap: 2 },
  actions: { marginTop: space.xxl },
});
