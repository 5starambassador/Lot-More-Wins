import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerReferralBill } from '@lotmorewins/types';
import { Divider, ListSkeleton, SectionLabel, StateView, TopBar, Txt } from '../components/ui';
import { ENTRY_LOOK } from '../components/wallet/TransactionRow';
import * as Haptics from '../lib/haptics';
import { describeError, useReferralHistory } from '../lib/queries';
import { formatDate, formatDateTimeFull, formatINR, formatPercent } from '../lib/format';
import { useWalletFormat, type WalletFormat } from '../lib/wallet-display';
import { canvasFill, colors, fonts, GUTTER, radius, space } from '../theme/tokens';

function Line({ label, value, tone }: { label: string; value: string; tone?: 'gold' | 'success' }) {
  return (
    <View style={styles.line}>
      <Txt variant="small" tone="secondary" style={styles.lineLabel}>
        {label}
      </Txt>
      <Txt variant="small" tone={tone ?? 'default'} selectable style={styles.lineValue}>
        {value}
      </Txt>
    </View>
  );
}

/** One referral bill; tapping it opens everything recorded about the bill. */
function ReferralBillRow({ item, format }: { item: PartnerReferralBill; format: WalletFormat }) {
  const [open, setOpen] = useState(false);
  const { bill, rewards } = item;
  const earned = rewards.reduce((sum, r) => sum + r.points, 0);
  const guest = bill.buyerName ?? 'Guest';

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${guest}, ${bill.outletName}, ${formatDate(bill.createdAt)}, bill ${formatINR(bill.billAmount)}`}
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((value) => !value);
        }}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}
      >
        <View style={styles.icon}>
          <Ionicons name="receipt-outline" size={18} color={colors.gold} />
        </View>
        <View style={styles.rowText}>
          <Txt variant="bodyMedium" numberOfLines={1}>
            {guest}
          </Txt>
          <Txt variant="small" tone="secondary" numberOfLines={1}>
            {bill.outletName} · {formatDate(bill.createdAt)}
          </Txt>
        </View>
        <View style={styles.trailing}>
          <Txt variant="bodyMedium">{formatINR(bill.billAmount)}</Txt>
          {earned > 0 ? (
            <Txt variant="caption" tone="gold">
              +{format.amount(earned)} earned
            </Txt>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>

      {open ? (
        <View style={styles.details}>
          <Line label="Bill number" value={bill.billNumber} />
          <Line label="Date and time" value={formatDateTimeFull(bill.createdAt)} />
          <Line label="Outlet" value={bill.outletName} />
          <Line label="Guest" value={guest} />
          {item.guestMobile ? <Line label="Mobile" value={item.guestMobile} /> : null}
          {item.guestEmail ? <Line label="Email" value={item.guestEmail} /> : null}
          <Divider />
          <Line label="Bill amount" value={formatINR(bill.billAmount)} />
          {bill.discountAmount > 0 ? (
            <>
              <Line label={`Discount (${formatPercent(bill.discountPercentage)})`} value={`− ${formatINR(bill.discountAmount)}`} tone="success" />
              {bill.isFirstTime ? (
                <Txt variant="caption" tone="gold">
                  First purchase at this outlet
                </Txt>
              ) : null}
              <Line label="After discount" value={formatINR(bill.taxableAmount)} />
            </>
          ) : null}
          {bill.serviceChargeAmount > 0 ? <Line label="Service charge" value={`+ ${formatINR(bill.serviceChargeAmount)}`} /> : null}
          {bill.gstPercentage > 0 ? <Line label={`GST (${formatPercent(bill.gstPercentage)})`} value={`+ ${formatINR(bill.gstAmount)}`} /> : null}
          {bill.roundOffAmount ? (
            <Line label="Round off" value={`${bill.roundOffAmount > 0 ? '+' : '−'} ${formatINR(Math.abs(bill.roundOffAmount))}`} />
          ) : null}
          <Line label="Paid at the outlet" value={formatINR(bill.finalAmount)} />
          {rewards.length > 0 ? <Divider /> : null}
          {rewards.map((r) => {
            const look = ENTRY_LOOK[r.type] ?? ENTRY_LOOK.REFERRAL;
            return <Line key={r.id} label={format.inRupees ? look.rupees : look.points} value={`+${format.amount(r.points)}`} tone="gold" />;
          })}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Txt>
      <Txt variant="caption" tone="secondary" align="center">
        {label}
      </Txt>
    </View>
  );
}

/** Every bill closed at an outlet with the partner's referral QR, with the totals above them. */
export default function ReferralHistoryScreen() {
  const history = useReferralHistory();
  const format = useWalletFormat();
  const bills = useMemo(() => history.data?.pages.flatMap((page) => page.bills) ?? [], [history.data]);
  const summary = history.data?.pages[0]?.summary;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <TopBar title="Referral history" />
      {history.isLoading ? (
        <View style={styles.pad}>
          <ListSkeleton rows={6} />
        </View>
      ) : history.isError ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load your referral history"
          message={describeError(history.error)}
          actionLabel="Try again"
          onAction={() => history.refetch()}
        />
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.pad, styles.grow]}
          renderItem={({ item }) => <ReferralBillRow item={item} format={format} />}
          ItemSeparatorComponent={() => <Divider />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (history.hasNextPage && !history.isFetchingNextPage) history.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              refreshing={history.isRefetching && !history.isFetchingNextPage}
              onRefresh={() => history.refetch()}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.stats}>
                <Stat value={(summary?.completedBills ?? 0).toLocaleString('en-IN')} label="Referral bills completed" />
                <Stat value={formatINR(summary?.totalBillValue ?? 0)} label="Total bill value" />
                <Stat value={(summary?.uniqueGuests ?? 0).toLocaleString('en-IN')} label="Unique persons referred" />
              </View>
              <Txt variant="caption" tone="muted" align="center" style={styles.note}>
                Only bills completed at an outlet with your Referral QR count. A person is counted once by their mobile and email.
              </Txt>
              {bills.length > 0 ? <SectionLabel label="Bill history" /> : null}
            </View>
          }
          ListEmptyComponent={
            <StateView
              icon="people-outline"
              title="No referral bills yet"
              message="When a guest completes a bill at any outlet with your Referral QR, it will show up here."
            />
          }
          ListFooterComponent={history.isFetchingNextPage ? <ActivityIndicator color={colors.gold} style={styles.more} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, ...canvasFill },
  pad: { paddingHorizontal: GUTTER, paddingBottom: space.xl },
  grow: { flexGrow: 1 },
  more: { paddingVertical: space.lg },
  header: { paddingTop: space.md, paddingBottom: space.sm },
  stats: { flexDirection: 'row', gap: space.xs },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.maroonSoft,
  },
  statValue: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.gold, textAlign: 'center' },
  note: { marginTop: space.sm, marginBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },
  trailing: { alignItems: 'flex-end', gap: 1 },
  details: {
    gap: space.xs,
    padding: space.md,
    marginBottom: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  line: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  lineLabel: { flex: 1 },
  lineValue: { flexShrink: 1, textAlign: 'right' },
});
