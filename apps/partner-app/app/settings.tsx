import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import * as Haptics from '../lib/haptics';
import apiClient from '../lib/api';
import { Divider, ListRow, Notice, Screen, SectionLabel, TopBar, Txt } from '../components/ui';
import { useAuthStore } from '../store/auth-store';
import { useSignOut } from '../lib/use-sign-out';
import { describeError } from '../lib/queries';
import { colors, GUTTER, space } from '../theme/tokens';

export default function SettingsScreen() {
  const { partner, updateQrCodes } = useAuthStore();
  const signOut = useSignOut();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Re-fetch permanent QR codes from the backend and confirm they are unchanged.
  const handleRefreshQr = async () => {
    if (!partner || isRefreshing) return;
    setIsRefreshing(true);
    setMessage(null);
    try {
      const res = await apiClient.getPartnerQrCodes();
      if (res.success && res.data) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        updateQrCodes(res.data.qrCodes);
        setMessage({ tone: 'success', text: 'Your QR codes are up to date. Permanent codes never change.' });
      }
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Screen padded={false}>
      <TopBar title="Settings" />
      <View style={styles.body}>
        {message && <Notice tone={message.tone} message={message.text} />}

        <SectionLabel label="QR codes" />
        <ListRow
          icon="refresh-outline"
          label="Refresh QR codes"
          value="Re-check your permanent codes with the server"
          onPress={handleRefreshQr}
          trailing={isRefreshing ? <ActivityIndicator color={colors.gold} /> : undefined}
        />

        <View style={styles.group}>
          <SectionLabel label="About" />
          <ListRow icon="information-circle-outline" label="App version" value={Constants.expoConfig?.version ?? '—'} />
          <Divider inset={36 + space.md} />
          <ListRow icon="shield-checkmark-outline" label="Your data" value="Your session is stored securely on this device" />
        </View>

        <View style={styles.group}>
          <SectionLabel label="Account" />
          <ListRow icon="log-out-outline" label="Sign out" destructive onPress={signOut} />
        </View>

        <Txt variant="caption" tone="muted" align="center" style={styles.footer}>
          Lot More Wins · Partner
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: space.md },
  group: { marginTop: space.xxl },
  footer: { marginTop: space.xxxl },
});
