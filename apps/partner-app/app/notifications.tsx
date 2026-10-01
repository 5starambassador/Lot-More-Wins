import { useEffect, useMemo, type ComponentProps } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import type { PartnerNotification, PartnerNotificationType } from '@lotmorewins/types';
import apiClient from '../lib/api';
import { Divider, ListSkeleton, StateView, TopBar, Txt } from '../components/ui';
import { describeError, useNotifications } from '../lib/queries';
import { formatDate, formatRelative } from '../lib/format';
import { canvasFill, colors, GUTTER, space } from '../theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<PartnerNotificationType, IconName> = {
  PURCHASE_POINTS: 'bag-handle-outline',
  REFERRAL_POINTS: 'people-outline',
  POINTS_CLAIMED: 'diamond-outline',
  POINTS_REDEEMED: 'arrow-up-outline',
  REFERRAL_REWARD: 'trophy-outline',
};

function NotificationRow({ item }: { item: PartnerNotification }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${item.title}. ${item.body}`}>
      <View style={[styles.icon, !item.read && styles.iconUnread]}>
        <Ionicons name={ICONS[item.type] ?? 'notifications-outline'} size={18} color={colors.gold} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Txt variant="bodyMedium" style={styles.flex} numberOfLines={1}>
            {item.title}
          </Txt>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Txt variant="small" tone="secondary">
          {item.body}
        </Txt>
        <View style={styles.meta}>
          <Txt variant="caption" tone="muted">
            {formatRelative(item.createdAt)}
          </Txt>
          {item.expiresAt ? (
            <View style={styles.validity}>
              <Ionicons name="time-outline" size={12} color={colors.gold} />
              <Txt variant="caption" tone="gold">
                Valid till {formatDate(item.expiresAt)}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Everything that changed the partner's wallet: their own purchases, their referred customers' purchases, redemptions. */
export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const items = useMemo(() => notifications.data?.pages.flatMap((page) => page.notifications) ?? [], [notifications.data]);
  const unread = notifications.data?.pages[0]?.unread ?? 0;

  // Opening the page marks everything as read; the rows keep their unread marker until the next refresh.
  useEffect(() => {
    if (unread === 0) return;
    apiClient
      .markPartnerNotificationsRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ['home'] }))
      .catch(() => {});
  }, [unread, queryClient]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <TopBar title="Notifications" />
      {notifications.isLoading ? (
        <View style={styles.pad}>
          <ListSkeleton rows={6} />
        </View>
      ) : notifications.isError ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load notifications"
          message={describeError(notifications.error)}
          actionLabel="Try again"
          onAction={() => notifications.refetch()}
        />
      ) : (
        <FlatList
          data={items}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (notifications.hasNextPage && !notifications.isFetchingNextPage) notifications.fetchNextPage();
          }}
          ListFooterComponent={notifications.isFetchingNextPage ? <ActivityIndicator color={colors.gold} style={styles.more} /> : null}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[styles.pad, styles.grow]}
          renderItem={({ item }) => <NotificationRow item={item} />}
          ItemSeparatorComponent={() => <Divider inset={40 + space.md} />}
          refreshControl={
            <RefreshControl
              refreshing={notifications.isRefetching && !notifications.isFetchingNextPage}
              onRefresh={() => notifications.refetch()}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            <StateView
              icon="notifications-outline"
              title="No notifications yet"
              message="Points you earn from your purchases and from your referred customers’ purchases will show up here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, ...canvasFill },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  more: { paddingVertical: space.lg },
  pad: { paddingHorizontal: GUTTER, paddingBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: 2 },
  validity: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
