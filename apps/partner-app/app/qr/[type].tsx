import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { QRCodeType } from '@lotmorewins/types';
import apiClient from '../../lib/api';
import * as Haptics from '../../lib/haptics';
import { Button, Notice, Screen, TopBar, Txt } from '../../components/ui';
import { QrPanel } from '../../components/qr/QrPanel';
import { useAuthStore } from '../../store/auth-store';
import { describeError, useHome } from '../../lib/queries';
import { formatPercent } from '../../lib/format';
import { QrExportError, saveQrImage, shareQrImage } from '../../lib/qr-export';
import { colors, GUTTER, space } from '../../theme/tokens';

const PAGES: Record<string, { qrType: QRCodeType; title: string; heading: string; body: string; fileName: string }> = {
  discount: {
    qrType: 'DEFAULT_DISCOUNT',
    title: 'Personal Discount QR',
    heading: 'Your personal discount code',
    body: 'Show this at the billing counter of any participating outlet to receive your partner discount.',
    fileName: 'lotmore-personal-discount-qr',
  },
  referral: {
    qrType: 'REFERRAL',
    title: 'Referral QR',
    heading: 'Your referral code',
    body: 'Share it with family and friends. You earn referral points every time they close a bill with it.',
    fileName: 'lotmore-referral-qr',
  },
};

/** One page per permanent QR: /qr/discount and /qr/referral. */
export default function QrScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { partner, qrCodes } = useAuthStore();
  const home = useHome();
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const page = PAGES[type ?? ''];
  if (!page) return <Redirect href="/dashboard" />;

  const isReferral = page.qrType === 'REFERRAL';
  const code = qrCodes.find((q) => q.type === page.qrType)?.code;

  const run = async (kind: 'download' | 'share', action: () => Promise<string | null>) => {
    setMessage(null);
    setBusy(kind);
    try {
      const done = await action();
      if (done) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMessage({ tone: 'success', text: done });
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({ tone: 'error', text: error instanceof QrExportError ? error.message : describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = () =>
    run('download', async () => {
      if (!code) return null;
      const saved = await saveQrImage(code, page.fileName);
      return saved === 'gallery' ? 'Saved to your photos.' : saved === 'folder' ? 'Saved to the folder you chose.' : null;
    });

  // The image goes out with an invitation and the partner app download link.
  const handleShare = () =>
    run('share', async () => {
      if (!code) return null;
      // Counted for the Super Admin's referral tracking; never blocks the share itself.
      apiClient.trackReferralShare().catch(() => {});

      const link = home.data?.appDownloadUrl;
      const discount = home.data?.offers.referralDiscount;
      const lines = [
        `${partner?.name ?? 'A Lot More partner'} has shared a Lot More Wins referral QR with you.`,
        `Show this QR code at the billing counter of any participating Lot More outlet to get ${
          discount ? `${formatPercent(discount)} off your bill` : 'your discount'
        }.`,
        link ? `Download the Lot More Partner app to earn rewards of your own: ${link}` : null,
      ];
      await shareQrImage(code, {
        message: lines.filter(Boolean).join('\n\n'),
        title: 'Lot More Wins — Referral QR',
        fileName: page.fileName,
      });
      return null;
    });

  const offer = home.data?.offers;
  const reward = home.data?.referrals;
  const hint =
    !isReferral && reward?.rewardAvailable
      ? { icon: 'trophy-outline' as const, tone: 'gold' as const, text: `${formatPercent(reward.rewardDiscount)} special referral reward applies to your next purchase` }
      : !isReferral && offer?.firstTimeAvailable && offer.firstTimeDiscount > 0
        ? { icon: 'gift-outline' as const, tone: 'gold' as const, text: `${formatPercent(offer.firstTimeDiscount)} off your first purchase is ready to use` }
        : isReferral && offer && offer.referralDiscount > 0
          ? { icon: 'pricetag-outline' as const, tone: 'gold' as const, text: `Your referred customers get ${formatPercent(offer.referralDiscount)} off with this QR` }
          : { icon: 'lock-closed-outline' as const, tone: 'muted' as const, text: 'Permanent code — it never changes' };

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.actions}>
          <Button
            label="Download QR"
            variant={isReferral ? 'secondary' : 'primary'}
            icon={<Ionicons name="download-outline" size={18} color={isReferral ? colors.gold : colors.textOnGold} />}
            onPress={handleDownload}
            loading={busy === 'download'}
            disabled={!code || busy === 'share'}
            style={styles.action}
          />
          {isReferral ? (
            <Button
              label="Share QR"
              icon={<Ionicons name="share-social-outline" size={18} color={colors.textOnGold} />}
              onPress={handleShare}
              loading={busy === 'share'}
              disabled={!code || busy === 'download'}
              style={styles.action}
            />
          ) : null}
        </View>
      }
    >
      <TopBar title={page.title} />
      <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
        <Txt variant="heading" align="center">
          {page.heading}
        </Txt>
        <Txt variant="small" tone="secondary" align="center" style={styles.copy}>
          {page.body}
        </Txt>

        <View style={styles.qrWrap}>
          <QrPanel code={code} />
        </View>

        <View style={styles.hint}>
          <Ionicons name={hint.icon} size={14} color={hint.tone === 'gold' ? colors.gold : colors.textMuted} />
          <Txt variant="caption" tone={hint.tone === 'gold' ? 'secondary' : 'muted'}>
            {hint.text}
          </Txt>
        </View>

        {message && (
          <View style={styles.message}>
            <Notice tone={message.tone} message={message.text} />
          </View>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: space.lg },
  copy: { marginTop: space.xs, marginHorizontal: space.md },
  qrWrap: { marginVertical: space.xl },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  message: { marginTop: space.lg },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
