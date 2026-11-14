import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { PartnerNotification, PartnerNotificationPage } from '@lotmorewins/types';
import apiClient from '../../lib/api';
import { FullScreenLoader, Glass, StateView, TopBar, Txt } from '../../components/ui';
import { describeError } from '../../lib/queries';
import { formatRelative } from '../../lib/format';
import { canvasFill, colors, fonts, GUTTER, space } from '../../theme/tokens';

/** WhatsApp-style text: *bold* becomes bold, the rest stays as written (emoji, line breaks). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <Text style={styles.message}>
      {parts.map((part, i) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <Text key={i} style={styles.bold}>
            {part.slice(1, -1)}
          </Text>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </Text>
  );
}

/** One notification on its own page: an offer shows its full message. */
export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  // Opened from the list, the notification is already loaded: show it at once.
  const cached = queryClient
    .getQueryData<InfiniteData<PartnerNotificationPage>>(['notifications'])
    ?.pages.flatMap((p) => p.notifications)
    .find((n) => n.id === id);
  const query = useQuery({
    queryKey: ['notification', id],
    queryFn: async () => (await apiClient.getPartnerNotification(id!)).data as PartnerNotification,
    enabled: !!id,
    initialData: cached,
  });
  const n = query.data;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <TopBar title="Notification" />
      {!n && query.isLoading ? (
        <FullScreenLoader />
      ) : !n ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load this notification"
          message={describeError(query.error)}
          actionLabel="Try again"
          onAction={() => query.refetch()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          <View style={styles.header}>
            <View style={styles.icon}>
              <Ionicons name={n.type === 'OFFER' ? 'gift-outline' : 'notifications-outline'} size={22} color={colors.gold} />
            </View>
            <View style={styles.flex}>
              <Txt variant="heading">{n.title}</Txt>
              <Txt variant="caption" tone="muted">
                {formatRelative(n.createdAt)}
              </Txt>
            </View>
          </View>
          <Glass style={styles.card}>
            {n.detail ? (
              <RichText text={n.detail} />
            ) : (
              <Txt variant="body" tone="secondary">
                {n.body}
              </Txt>
            )}
          </Glass>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, ...canvasFill },
  pad: { paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  flex: { flex: 1 },
  card: { padding: space.md },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.text },
  bold: { fontFamily: fonts.semibold, color: colors.text },
});
