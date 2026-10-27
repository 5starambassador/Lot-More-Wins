import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import type { WalletTransferOtpResponse, WalletTransferRecipient, WalletTransferResponse } from '@lotmorewins/types';
import apiClient from '../lib/api';
import * as Haptics from '../lib/haptics';
import { Button, Field, Notice, OtpInput, Screen, TopBar, Txt } from '../components/ui';
import { describeError, useWallet } from '../lib/queries';
import { formatINR, formatPoints } from '../lib/format';
import { walletFormat } from '../lib/wallet-display';
import { colors, GUTTER, radius, space } from '../theme/tokens';

const RESEND_AFTER_SEC = 60;

function newIdempotencyKey(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `pt-${Date.now().toString(36)}-${rand()}${rand()}`;
}

const cleanAmount = (text: string) => text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

/**
 * Send points to another partner's wallet, like a UPI payment between two partner accounts:
 * find the partner by their registered mobile number, check their name, enter the amount, then
 * confirm with a one-time code (sent on the Super Admin's messaging channel). The amount is
 * entered in points or rupees, following the wallet display setting. One transfer sends at most
 * half the wallet.
 */
export default function TransferScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const wallet = useWallet();
  const format = walletFormat(wallet.data);
  const { inRupees } = format;
  const ratio = wallet.data?.pointsRatio ?? { points: 1, rupees: 1 };
  const balance = wallet.data?.balancePoints ?? 0;
  // Half the wallet, as the server works it out (rounded down to 2 decimals).
  const maxPoints = wallet.data?.transferMaxPoints ?? Math.floor(balance * 50) / 100;

  const [mobile, setMobile] = useState('');
  const [recipient, setRecipient] = useState<WalletTransferRecipient | null>(null);
  const [amountText, setAmountText] = useState('');
  const [sent, setSent] = useState<WalletTransferOtpResponse | null>(null);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [done, setDone] = useState<WalletTransferResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per confirmed amount and recipient: a retry after a network failure cannot send twice.
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // The amount as typed, converted to wallet points (never more than half the balance).
  const amount = Number(amountText);
  const hasAmount = amountText !== '' && Number.isFinite(amount);
  const typedPoints = hasAmount ? (inRupees ? Math.round(((amount * ratio.points) / ratio.rupees) * 100) / 100 : amount) : 0;
  const points = Math.min(typedPoints, maxPoints);
  const amountError = !hasAmount
    ? null
    : amount <= 0
      ? 'Enter an amount greater than 0'
      : !TWO_DECIMALS.test(amountText)
        ? 'Amount can have at most 2 decimal places'
        : typedPoints > maxPoints + 0.005
          ? `You can send up to half your wallet: ${format.amount(maxPoints)}`
          : null;
  const amountValid = hasAmount && !amountError && points > 0;

  const findRecipient = async () => {
    setError(null);
    const digits = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter the 10-digit mobile number the partner registered with');
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.findTransferRecipient(digits);
      setRecipient(res.data);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    if (!recipient || !amountValid) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiClient.requestTransferOtp({ mobile: recipient.mobile, points });
      setSent(res.data);
      setOtp('');
      setCountdown(RESEND_AFTER_SEC);
      idempotencyKey.current ??= newIdempotencyKey();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const send = async (code = otp) => {
    if (!recipient || !idempotencyKey.current || code.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      const res = await apiClient.sendWalletTransfer({
        mobile: recipient.mobile,
        points,
        otp: code,
        idempotencyKey: idempotencyKey.current,
      });
      setDone(res.data);
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['home'] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  // Changing who or how much needs a new code (and a new transfer key).
  const editDetails = () => {
    setSent(null);
    setOtp('');
    setError(null);
    idempotencyKey.current = null;
  };

  const sentAmount = done ? (inRupees ? formatINR(done.transfer.rupeeValue) : `${formatPoints(done.transfer.points)} points`) : '';
  const shownAmount = inRupees ? formatINR(Math.floor(((points * ratio.rupees) / ratio.points) * 100 + 1e-6) / 100) : `${formatPoints(points)} points`;

  return (
    <Screen
      padded={false}
      footer={
        done ? (
          <Button label="Back to wallet" onPress={() => router.back()} />
        ) : sent ? (
          <Button label={`Send ${shownAmount}`} onPress={() => send()} loading={busy} disabled={otp.length !== 6} />
        ) : recipient ? (
          <Button label="Continue" onPress={requestCode} loading={busy} disabled={!amountValid} />
        ) : (
          <Button label="Find partner" onPress={findRecipient} loading={busy} />
        )
      }
    >
      <TopBar title="Send to a partner" />
      <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
        {done ? (
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={40} color={colors.textOnGold} />
            </View>
            <Txt variant="title" align="center">
              Sent
            </Txt>
            <Txt variant="body" tone="secondary" align="center">
              {sentAmount} to {done.transfer.counterparty.name}
            </Txt>
            <Txt variant="caption" tone="muted" align="center">
              Transfer {done.transfer.transferNumber}
              {done.replayed ? ' · already sent' : ''}
            </Txt>
            <Txt variant="small" tone="secondary" align="center" style={styles.after}>
              Your wallet now: {inRupees ? formatINR(done.rupeeValue) : `${formatPoints(done.balancePoints)} points`}
            </Txt>
          </View>
        ) : (
          <>
            <Txt variant="small" tone="secondary" style={styles.copy}>
              Your wallet: {format.amount(balance)}
              {inRupees ? '' : ` points (worth ${formatINR(wallet.data?.rupeeValue ?? 0)})`}. You can send up to half of it at a time:{' '}
              {format.amount(maxPoints)}
              {inRupees ? '' : ' points'}. Points arrive in their wallet straight away and keep the same validity.
            </Txt>

            {error && <Notice tone="error" message={error} />}

            {!recipient ? (
              <Field
                label="Partner’s mobile number"
                prefix="+91"
                value={mobile}
                onChangeText={(v) => {
                  setMobile(v.replace(/\D/g, '').slice(0, 10));
                  setError(null);
                }}
                placeholder="10-digit number"
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="search"
                onSubmitEditing={findRecipient}
                autoFocus
                hint="Search by the mobile number they registered with."
              />
            ) : (
              <>
                <View style={styles.recipient}>
                  <View style={styles.recipientIcon}>
                    <Ionicons name="person-outline" size={20} color={colors.gold} />
                  </View>
                  <View style={styles.flex}>
                    <Txt variant="bodyMedium" numberOfLines={1}>
                      {recipient.name}
                    </Txt>
                    <Txt variant="small" tone="secondary">
                      +91 {recipient.mobile} · {recipient.partnerCode}
                    </Txt>
                  </View>
                  {!sent ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => {
                        setRecipient(null);
                        setAmountText('');
                      }}
                    >
                      <Txt variant="smallMedium" tone="gold">
                        Change
                      </Txt>
                    </Pressable>
                  ) : null}
                </View>

                {!sent ? (
                  <Field
                    label={inRupees ? 'Amount' : 'Points to send'}
                    prefix={inRupees ? '₹' : undefined}
                    value={amountText}
                    onChangeText={(t) => setAmountText(cleanAmount(t))}
                    error={amountError}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    autoFocus
                    hint={amountValid && !inRupees ? `Worth ${formatINR(Math.floor(((points * ratio.rupees) / ratio.points) * 100 + 1e-6) / 100)}` : undefined}
                  />
                ) : (
                  <>
                    <Txt variant="body" tone="secondary" style={styles.copy}>
                      Sending {shownAmount}. Enter the 6-digit code we sent by {sent.mode === 'whatsapp' ? 'WhatsApp' : 'email'} to{' '}
                      {sent.destination} to confirm.
                    </Txt>
                    <OtpInput value={otp} onChange={setOtp} onComplete={send} />
                    <View style={styles.row}>
                      <Txt variant="small" tone="muted">
                        Didn’t get it?{' '}
                      </Txt>
                      {countdown > 0 ? (
                        <Txt variant="smallMedium" tone="muted">{`Resend in 0:${String(countdown).padStart(2, '0')}`}</Txt>
                      ) : (
                        <Pressable accessibilityRole="button" onPress={requestCode} disabled={busy} hitSlop={8}>
                          <Txt variant="smallMedium" tone="gold">
                            Resend code
                          </Txt>
                        </Pressable>
                      )}
                    </View>
                    <Pressable accessibilityRole="button" onPress={editDetails} hitSlop={8} style={styles.edit}>
                      <Txt variant="smallMedium" tone="gold">
                        Change the amount or partner
                      </Txt>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: space.sm },
  flex: { flex: 1 },
  copy: { marginBottom: space.lg },
  recipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.maroonSoft,
  },
  recipientIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: space.xl },
  edit: { marginTop: space.lg },
  done: { alignItems: 'center', gap: space.xs, paddingTop: space.xxl },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  after: { marginTop: space.md },
});
