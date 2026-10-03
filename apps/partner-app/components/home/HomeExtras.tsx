import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PartnerHome, PartnerWallet } from '@lotmorewins/types';
import { useQuery } from '@tanstack/react-query';
import { loadInviteImage, shareInvite } from '../../lib/invite';
import { formatINR, formatPercent, formatPoints } from '../../lib/format';
import { walletFormat } from '../../lib/wallet-display';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { Glass, SectionLabel, Txt } from '../ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.gold} />
      </View>
      <Txt style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

/** The partner's numbers at a glance, on one glass panel. "—" until each figure has loaded. */
export function HomeStats({ home, wallet }: { home: PartnerHome | undefined; wallet: PartnerWallet | undefined }) {
  const format = walletFormat(wallet);
  const discount = home ? (home.offers.firstTimeAvailable && home.offers.firstTimeDiscount > 0 ? home.offers.firstTimeDiscount : home.offers.repeatDiscount) : null;
  return (
    <View>
      <SectionLabel label="Your stats" />
      <Glass rounded={radius.lg} style={styles.stats}>
        <View style={styles.row}>
          {format.inRupees ? (
            <>
              <Stat icon="wallet-outline" label="Wallet balance" value={wallet ? formatINR(wallet.rupeeValue) : '—'} />
              <View style={styles.vline} />
              <Stat icon="cash-outline" label="Referral rewards" value={wallet ? format.amount(wallet.totals.referralPoints) : '—'} />
            </>
          ) : (
            <>
              <Stat icon="wallet-outline" label="Wallet points" value={wallet ? formatPoints(wallet.balancePoints) : '—'} />
              <View style={styles.vline} />
              <Stat icon="cash-outline" label="Points worth" value={wallet ? formatINR(wallet.rupeeValue) : '—'} />
            </>
          )}
        </View>
        <View style={styles.hline} />
        <View style={styles.row}>
          <Stat icon="people-outline" label="Total referrals" value={home ? String(home.referrals.total) : '—'} />
          <View style={styles.vline} />
          <Stat icon="pricetag-outline" label="Your discount" value={discount !== null ? formatPercent(discount) : '—'} />
        </View>
      </Glass>
    </View>
  );
}

/** Invite family and friends: shares a welcome message, the app download link and the invite image set by the Super Admin. */
export function InviteCard({
  partnerName,
  downloadUrl,
  imageUrl,
}: {
  partnerName: string | null | undefined;
  downloadUrl: string | null | undefined;
  imageUrl: string | null | undefined;
}) {
  const [sharing, setSharing] = useState(false);
  // Loaded ahead of the tap: browsers only share a file during the tap itself.
  const image = useQuery({
    queryKey: ['invite-image', imageUrl ?? null],
    queryFn: () => loadInviteImage(imageUrl),
    enabled: imageUrl !== undefined,
    staleTime: Infinity,
  });

  const invite = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareInvite({ partnerName, downloadUrl, imageUrl, image: image.data });
    } catch {
      // The share sheet was unavailable or closed; nothing to report.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Glass onPress={invite} accessibilityLabel="Invite family and friends" rounded={radius.lg} style={styles.invite}>
      <View style={styles.inviteIcon}>
        <Ionicons name="heart" size={20} color={colors.gold} />
      </View>
      <View style={styles.flex}>
        <Txt variant="bodyMedium">Invite family &amp; friends</Txt>
        <Txt variant="small" tone="secondary">
          Share the Lot More Partner app so they can save and earn rewards too.
        </Txt>
      </View>
      <View style={styles.share}>
        {sharing ? <ActivityIndicator size="small" color={colors.textOnGold} /> : <Ionicons name="share-social" size={18} color={colors.textOnGold} />}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stats: { paddingHorizontal: space.md },
  row: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.md, gap: 2 },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xxs,
  },
  statValue: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: colors.text },
  vline: { width: StyleSheet.hairlineWidth, backgroundColor: colors.glassBorder, marginVertical: space.md },
  hline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.glassBorder },
  invite: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  inviteIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
});
