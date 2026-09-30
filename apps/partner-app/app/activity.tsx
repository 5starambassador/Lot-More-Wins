import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PointsLedgerEntry } from '@lotmorewins/types';
import { Divider, ListSkeleton, Segmented, StateView, TopBar, Txt } from '../components/ui';
import { ActivityRow } from '../components/rewards/ActivityRow';
import { describeError, useWallet } from '../lib/queries';
import { colors, GUTTER, space } from '../theme/tokens';

type Filter = 'ALL' | 'PURCHASE' | 'REFERRAL';

function groupByMonth(entries: PointsLedgerEntry[]) {
  const groups = new Map<string, PointsLedgerEntry[]>();
  for (const e of entries) {
    const key = new Date(e.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()].map(([title, data]) => ({ title, data }));
}

/** Full points history from the partner wallet, grouped by month. */
export default function ActivityScreen() {
  const wallet = useWallet();
  const [filter, setFilter] = useState<Filter>('ALL');

  const sections = useMemo(() => {
    const entries = wallet.data?.entries ?? [];
    return groupByMonth(filter === 'ALL' ? entries : entries.filter((e) => e.type === filter));
  }, [wallet.data, filter]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <TopBar title="Activity" />
      <View style={styles.filter}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'PURCHASE', label: 'Purchases' },
            { value: 'REFERRAL', label: 'Referrals' },
          ]}
        />
      </View>

      {wallet.isLoading ? (
        <View style={styles.pad}>
          <ListSkeleton rows={6} />
        </View>
      ) : wallet.isError ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load activity"
          message={describeError(wallet.error)}
          actionLabel="Try again"
          onAction={() => wallet.refetch()}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.id}
          contentContainerStyle={[styles.pad, styles.grow]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Txt variant="overline" tone="gold" style={styles.month}>
              {section.title}
            </Txt>
          )}
          renderItem={({ item }) => <ActivityRow entry={item} />}
          ItemSeparatorComponent={() => <Divider inset={40 + space.md} />}
          refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={() => wallet.refetch()} tintColor={colors.gold} />}
          ListEmptyComponent={
            <StateView
              icon="time-outline"
              title={filter === 'ALL' ? 'No activity yet' : filter === 'PURCHASE' ? 'No purchase rewards yet' : 'No referral rewards yet'}
              message="Points you earn at participating outlets will be listed here."
            />
          }
          ListFooterComponent={
            wallet.data && wallet.data.entries.length >= 50 ? (
              <Txt variant="caption" tone="muted" align="center" style={styles.footnote}>
                Showing your 50 most recent entries
              </Txt>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  grow: { flexGrow: 1 },
  filter: { paddingHorizontal: GUTTER, marginBottom: space.xs },
  pad: { paddingHorizontal: GUTTER, paddingBottom: space.xl },
  month: { marginTop: space.xl, marginBottom: space.xs },
  footnote: { marginTop: space.xl },
});
