import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import QRCodeSvg from 'react-native-qrcode-svg';
import { useQueryClient } from '@tanstack/react-query';
import type { RedeemQr } from '@lotmorewins/types';
import apiClient from '../lib/api';
import * as Haptics from '../lib/haptics';
import { Button, Divider, FullScreenLoader, Screen, StateView, TopBar, Txt } from '../components/ui';
import { describeError } from '../lib/queries';
import { formatINR, formatPoints } from '../lib/format';
import { useWalletFormat } from '../lib/wallet-display';
import { colors, fonts, GUTTER, radius, space } from '../theme/tokens';

const QR_SIZE = 240;

function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/**
 * Redeem QR: a fresh, single-use code generated each time this page opens, carrying the
 * partner and the current worth of their points. The Outlet Admin app scans it to take
 * points off a bill.
 */
export default function RedeemScreen() {
  const queryClient = useQueryClient();
  const [qr, setQr] = useState<RedeemQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { inRupees } = useWalletFormat();
  const [remaining, setRemaining] = useState(0);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.createRedeemQr();
      setQr(res.data);
      setRemaining(secondsLeft(res.data.expiresAt));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      setQr(null);
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    generate();
    // The outlet may have redeemed while this page was open: refresh the wallet on the way out.
    return () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    };
  }, [generate, queryClient]);

  const expiresAt = qr?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setRemaining(secondsLeft(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (loading && !qr) return <FullScreenLoader />;

  const expired = !!qr && remaining <= 0;
  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <Screen
      padded={false}
      footer={
        <Button
          label={qr ? 'Generate a new QR' : 'Try again'}
          variant={expired || !qr ? 'primary' : 'secondary'}
          icon={<Ionicons name="refresh-outline" size={18} color={expired || !qr ? colors.textOnGold : colors.gold} />}
          onPress={generate}
          loading={loading}
        />
      }
    >
      <TopBar title="Redeem QR" />
      {!qr ? (
        <StateView tone="error" icon="alert-circle-outline" title="Couldn’t create your redeem QR" message={error ?? undefined} />
      ) : (
        <Animated.View key={qr.code} entering={FadeInDown.duration(400)} style={styles.body}>
          <Txt variant="small" tone="secondary" align="center" style={styles.copy}>
            Show this to the outlet at billing. They scan it and take your {inRupees ? 'wallet amount' : 'points'} off the bill.
          </Txt>

          <View style={styles.plateWrap}>
            <View style={[styles.plate, expired && styles.plateExpired]}>
              {/* The signed token is long: the lowest error-correction level keeps the modules large enough to scan. */}
              <QRCodeSvg value={qr.code} size={QR_SIZE} ecl="L" color={colors.canvas} backgroundColor="#FBF7F0" />
            </View>
            {expired ? (
              <View style={styles.expiredBadge}>
                <Txt variant="smallMedium" tone="onGold">
                  Expired
                </Txt>
              </View>
            ) : null}
          </View>

          <View style={styles.timer}>
            <Ionicons name="time-outline" size={14} color={expired ? colors.danger : colors.gold} />
            <Txt variant="caption" tone={expired ? 'danger' : 'secondary'}>
              {expired ? 'This QR has expired. Generate a new one.' : `Valid for ${clock} · works once`}
            </Txt>
          </View>

          <View style={styles.worth}>
            <Txt variant="overline" tone="muted" align="center">
              {inRupees ? 'Wallet balance' : 'Current points worth'}
            </Txt>
            <Txt style={styles.worthFigure}>{formatINR(qr.rupeeValue)}</Txt>
            {inRupees ? null : (
              <Txt variant="small" tone="secondary" align="center">
                {formatPoints(qr.balancePoints)} points
              </Txt>
            )}
          </View>

          <View style={styles.details}>
            {[
              { label: 'Partner', value: qr.partner.name },
              { label: 'Partner code', value: qr.partner.partnerCode },
              { label: 'Mobile', value: `+91 ${qr.partner.mobile}` },
            ].map((row, i) => (
              <View key={row.label}>
                {i > 0 && <Divider />}
                <View style={styles.detail}>
                  <Txt variant="small" tone="muted">
                    {row.label}
                  </Txt>
                  <Txt variant="smallMedium">{row.value}</Txt>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: space.sm },
  copy: { marginHorizontal: space.md },
  plateWrap: { alignSelf: 'center', marginTop: space.xl, alignItems: 'center', justifyContent: 'center' },
  plate: { backgroundColor: '#FBF7F0', padding: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.gold },
  plateExpired: { opacity: 0.15 },
  expiredBadge: { position: 'absolute', backgroundColor: colors.gold, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  timer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: space.md },
  worth: {
    marginTop: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.maroonSoft,
    alignItems: 'center',
  },
  worthFigure: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 44, letterSpacing: -1, color: colors.gold },
  details: { marginTop: space.lg },
  detail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
});
