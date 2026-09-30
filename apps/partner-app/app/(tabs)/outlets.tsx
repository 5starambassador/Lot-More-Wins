import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { Outlet } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Divider, ListSkeleton, StateView, Txt } from '../../components/ui';
import { OutletLogo } from '../../components/outlets/OutletLogo';
import { BrandLogo } from '../../components/brand/Brand';
import { describeError, useOutlets } from '../../lib/queries';
import { colors, fonts, GUTTER, radius, space } from '../../theme/tokens';

function OutletRow({ outlet, onPress }: { outlet: Outlet; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={outlet.name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <OutletLogo outlet={outlet} />
      <View style={styles.rowText}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {outlet.name}
        </Txt>
        <Txt variant="small" tone="secondary" numberOfLines={1}>
          {outlet.images.length > 0 ? `${outlet.images.length} photo${outlet.images.length > 1 ? 's' : ''} · ` : ''}
          {outlet.mobile}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function OutletsScreen() {
  const router = useRouter();
  const outlets = useOutlets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = outlets.data ?? [];
    return q ? list.filter((o) => o.name.toLowerCase().includes(q)) : list;
  }, [outlets.data, query]);

  const total = outlets.data?.length ?? 0;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Txt variant="title">Outlets</Txt>
          <BrandLogo size={36} />
        </View>
        <Txt variant="small" tone="secondary">
          {outlets.isSuccess ? `${total} participating ${total === 1 ? 'outlet' : 'outlets'}` : 'Where your codes can be used'}
        </Txt>
        {total > 5 && (
          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search outlets"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.gold}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Search outlets"
            />
          </View>
        )}
      </View>

      {outlets.isLoading ? (
        <View style={styles.pad}>
          <ListSkeleton rows={6} />
        </View>
      ) : outlets.isError ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load outlets"
          message={describeError(outlets.error)}
          actionLabel="Try again"
          onAction={() => outlets.refetch()}
        />
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={styles.flex}>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            contentContainerStyle={[styles.pad, styles.grow]}
            ItemSeparatorComponent={() => <Divider inset={52 + space.md} />}
            renderItem={({ item }) => (
              <OutletRow
                outlet={item}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: '/outlet/[id]', params: { id: item.id } });
                }}
              />
            )}
            refreshControl={<RefreshControl refreshing={outlets.isRefetching} onRefresh={() => outlets.refetch()} tintColor={colors.gold} />}
            ListEmptyComponent={
              query ? (
                <StateView icon="search-outline" title="No matches" message={`No outlet matches “${query.trim()}”.`} />
              ) : (
                <StateView icon="storefront-outline" title="No outlets yet" message="Participating outlets will appear here as they join." />
              )
            }
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  header: { paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space.md, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pad: { paddingHorizontal: GUTTER, paddingBottom: space.xl },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.md,
    height: 44,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1, gap: 2 },
});
