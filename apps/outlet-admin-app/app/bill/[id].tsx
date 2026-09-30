import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BillRecord } from '@lotmorewins/types';
import { Badge, FullScreenLoader, InfoRow, Panel, Screen, SectionLabel, StateView, TopBar, Txt } from '../../components/ui';
import { Breakdown } from '../../components/scan/AmountStep';
import { NotificationPanel } from '../../components/scan/BillDone';
import apiClient, { describeError } from '../../lib/api';
import { classificationLabel, formatDateTime } from '../../lib/format';
import { useSession } from '../../store/session-store';
import { space } from '../../theme/tokens';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const signOut = useSession((s) => s.signOut);
  const query = useQuery({ queryKey: ['bill', id], queryFn: async () => (await apiClient.getOutletBill(id)).data, enabled: !!id });

  if (query.isLoading) return <FullScreenLoader />;

  if (query.isError || !query.data) {
    return (
      <Screen>
        <TopBar title="Bill details" />
        <StateView
          tone="error"
          icon="alert-circle-outline"
          title="Couldn’t load this bill"
          message={describeError(query.error)}
          actionLabel="Try again"
          onAction={() => query.refetch()}
        />
      </Screen>
    );
  }

  const bill = query.data;
  const isReferral = bill.transactionType === 'REFERRAL';
  const partner = bill.partner ?? bill.referrerPartner;

  const onUpdated = (updated: BillRecord) => {
    queryClient.setQueryData(['bill', id], updated);
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  return (
    <Screen padded={false}>
      <TopBar title="Bill details" />
      <Animated.View entering={FadeInDown.duration(350)} style={styles.body}>
        <Txt variant="mono">{bill.billNumber}</Txt>
        <Txt variant="small" tone="secondary">
          {formatDateTime(bill.createdAt)}
        </Txt>
        <View style={styles.badges}>
          <Badge label={isReferral ? 'Referral QR' : 'Discount QR'} tone={isReferral ? 'muted' : 'gold'} />
          {bill.isFirstTime && <Badge label={isReferral ? "Customer's first visit" : 'First-time bonus'} />}
        </View>

        {bill.customer && (
          <View style={styles.section}>
            <SectionLabel label="Customer" />
            <InfoRow label={bill.customer.name} value={`+91 ${bill.customer.mobile}`} />
            {bill.customer.email && <InfoRow label="Email" value={bill.customer.email} />}
          </View>
        )}
        {partner && (
          <View style={styles.section}>
            <SectionLabel label={isReferral ? 'Referred by' : 'Partner'} />
            <InfoRow label={partner.name} value={`+91 ${partner.mobile}`} />
            <InfoRow label="Partner type" value={classificationLabel(bill.classification)} />
          </View>
        )}

        <View style={styles.section}>
          <SectionLabel label="Bill" />
          <Panel>
            <Breakdown calc={bill} partnerName={partner?.name ?? 'the partner'} />
          </Panel>
        </View>

        <View style={styles.section}>
          <NotificationPanel bill={bill} onUpdated={onUpdated} onSignedOut={() => signOut()} />
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingBottom: space.xl },
  badges: { flexDirection: 'row', gap: space.xs, marginTop: space.sm },
  section: { marginTop: space.xl },
});
