import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { BillHistoryRange, BillRecord } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Badge, Divider, ListSkeleton, Segmented, StatTile, StateView, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import apiClient, { describeError } from '../../lib/api';
import { formatDateTime, formatINR, formatINRCompact, formatPoints, formatTime, notificationBadge } from '../../lib/format';
import { colors, GUTTER, space } from '../../theme/tokens';

const PAGE_SIZE = 20;

function BillRow({ bill, range, onPress }: { bill: BillRecord; range: BillHistoryRange; onPress: () => void }) {
  const isReferral = bill.transactionType === 'REFERRAL';
  const partner = bill.partner ?? bill.referrerPartner;
  const buyer = isReferral ? bill.customer?.name ?? 'Customer' : partner?.name ?? 'Partner';
  const message = notificationBadge(bill.notification);
  const points = bill.purchasePoints + bill.referralPoints;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Bill ${bill.billNumber}, ${buyer}, ${formatINR(bill.finalAmount)}`}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={isReferral ? 'people-outline' : 'person-outline'} size={18} color={colors.gold} />
      </View>
      <View style={styles.flex}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {buyer}
        </Txt>
        <Txt variant="small" tone="secondary" numberOfLines={1}>
          {isReferral ? `Referred by ${partner?.name ?? '—'}` : 'Partner discount'} ·{' '}
          {range === 'today' ? formatTime(bill.createdAt) : formatDateTime(bill.createdAt)}
        </Txt>
        <View style={styles.badges}>
          {bill.isFirstTime && !isReferral && <Badge label="First-time bonus" />}
          {points > 0 && <Badge label={`+${formatPoints(points)}`} icon="diamond-outline" />}
          <Badge label={message.label} tone={message.tone} />
        </View>
      </View>
      <View style={styles.amounts}>
        <Txt variant="bodyMedium">{formatINR(bill.finalAmount)}</Txt>
        <Txt variant="caption" tone="success">
          −{formatINR(bill.discountAmount)}
        </Txt>
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [range, setRange] = useState<BillHistoryRange>('today');

  const query = useInfiniteQuery({
    queryKey: ['transactions', range],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => apiClient.getOutletTransactions(pageParam, PAGE_SIZE, range),
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });

  const bills = query.data?.pages.flatMap((p) => p.data) ?? [];
  const summary = query.data?.pages[0]?.meta.summary;

  const header = (
    <View>
      <View style={styles.header}>
        <Txt variant="title">Billing history</Txt>
        <BrandLogo size={36} />
      </View>
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'all', label: 'All bills' },
        ]}
      />
      {summary && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.summary}>
          <View style={styles.tiles}>
            <StatTile label="Bills" value={String(summary.billCount)} />
            <StatTile label="Collected" value={formatINRCompact(summary.finalAmount)} />
          </View>
          <View style={styles.tiles}>
            <StatTile label="Discount given" value={formatINRCompact(summary.discountAmount)} />
            <StatTile label="Points issued" value={(summary.purchasePoints + summary.referralPoints).toLocaleString('en-IN')} gold />
          </View>
        </Animated.View>
      )}
      <Txt variant="overline" tone="gold" style={styles.listLabel}>
        {range === 'today' ? "Today's bills" : 'All bills'}
      </Txt>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <FlatList
        contentContainerStyle={styles.content}
        data={bills}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <BillRow bill={item} range={range} onPress={() => router.push({ pathname: '/bill/[id]', params: { id: item.id } })} />
        )}
        ItemSeparatorComponent={() => <Divider inset={40 + space.md} />}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.gold} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ListHeaderComponent={header}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.gold} style={{ paddingVertical: space.md }} /> : null}
        ListEmptyComponent={
          query.isLoading ? (
            <ListSkeleton rows={4} />
          ) : query.isError ? (
            <StateView
              tone="error"
              icon="cloud-offline-outline"
              title="Couldn’t load billing history"
              message={describeError(query.error)}
              actionLabel="Try again"
              onAction={() => query.refetch()}
            />
          ) : (
            <StateView
              icon="receipt-outline"
              title={range === 'today' ? 'No bills today yet' : 'No bills yet'}
              message="Bills completed at this outlet appear here."
            />
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: GUTTER, paddingBottom: space.xl, flexGrow: 1 },
  flex: { flex: 1, gap: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg, marginBottom: space.lg },
  summary: { marginTop: space.lg, gap: space.sm },
  tiles: { flexDirection: 'row', gap: space.sm },
  listLabel: { marginTop: space.xl, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  amounts: { alignItems: 'flex-end' },
});
