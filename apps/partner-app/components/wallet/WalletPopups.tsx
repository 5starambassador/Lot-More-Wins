import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Outlet } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { OutletLogo } from '../outlets/OutletLogo';
import { Button, Txt } from '../ui';
import { colors, fonts, radius, space } from '../../theme/tokens';

/**
 * Wallet popups. Plain views inside the Modal (no Reanimated entering animations): they are
 * measured before the Modal has its size on Android. The Modal's own fade is the only animation.
 */

/** An outlet takes redeem QRs unless its wallet redemption is off (older servers do not say: on). */
export const redeemsHere = (outlet: Outlet) => outlet.walletRedemptionEnabled !== false;

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="close" size={18} color={colors.textOnGold} />
    </Pressable>
  );
}

/**
 * "Where will you redeem?": search the outlets, tap one that takes redeem QRs to generate the QR
 * for it. Outlets with wallet redemption off are listed greyed out and cannot be picked.
 */
export function RedeemOutletPicker({
  visible,
  outlets,
  loading,
  error,
  onRetry,
  onPick,
  onClose,
}: {
  visible: boolean;
  outlets: Outlet[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPick: (outlet: Outlet) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = q
      ? outlets.filter((o) => o.name.toLowerCase().includes(q) || (o.address ?? '').toLowerCase().includes(q))
      : outlets;
    // Outlets that take redeem QRs first, then by name.
    return [...matches].sort((a, b) => Number(redeemsHere(b)) - Number(redeemsHere(a)) || a.name.localeCompare(b.name));
  }, [outlets, search]);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.card, styles.pickerCard]} accessibilityViewIsModal>
          <CloseButton onPress={onClose} />
          <Txt variant="heading">Redeem at</Txt>
          <Txt variant="small" tone="secondary" style={styles.lead}>
            Choose the outlet you are billing at. The redeem QR works only there.
          </Txt>

          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search outlets"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.gold}
              cursorColor={colors.gold}
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
              accessibilityLabel="Search outlets"
            />
            {search ? (
              <Pressable hitSlop={8} onPress={() => setSearch('')} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Txt variant="small" tone="danger" align="center">
                {error}
              </Txt>
              <Button label="Try again" variant="secondary" compact onPress={onRetry} style={styles.retry} />
            </View>
          ) : (
            <FlatList
              data={shown}
              keyExtractor={(o) => o.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <Txt variant="small" tone="muted" align="center" style={styles.empty}>
                  {search ? 'No outlet matches your search.' : 'No outlets yet.'}
                </Txt>
              }
              renderItem={({ item }) => {
                const enabled = redeemsHere(item);
                return (
                  <Pressable
                    disabled={!enabled}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onPick(item);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !enabled }}
                    accessibilityLabel={enabled ? `Redeem at ${item.name}` : `${item.name}, wallet redemption not available`}
                    style={({ pressed }) => [styles.row, !enabled && styles.rowDisabled, pressed && enabled && styles.rowPressed]}
                  >
                    <OutletLogo outlet={item} size={40} round />
                    <View style={styles.flex}>
                      <Txt variant="bodyMedium" tone={enabled ? 'gold' : 'muted'} numberOfLines={1}>
                        {item.name}
                      </Txt>
                      <Txt variant="caption" tone="muted" numberOfLines={1}>
                        {enabled
                          ? item.address ?? 'Tap to generate your redeem QR'
                          : 'Wallet redemption not available here'}
                      </Txt>
                    </View>
                    <Ionicons
                      name={enabled ? 'chevron-forward' : 'lock-closed-outline'}
                      size={18}
                      color={enabled ? colors.gold : colors.textMuted}
                    />
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * The Super Admin has paused the wallet: a short loader, then "temporarily not available" and the
 * way to the Personal Discount QR instead.
 */
export function WalletPausedPopup({
  visible,
  onClose,
  onPersonalQr,
}: {
  visible: boolean;
  onClose: () => void;
  onPersonalQr: () => void;
}) {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!visible) return;
    setChecking(true);
    const timer = setTimeout(() => {
      setChecking(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, 900);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.card, styles.centerCard]} accessibilityViewIsModal>
          <CloseButton onPress={onClose} />
          {checking ? (
            <View style={styles.checking}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Txt variant="small" tone="secondary" align="center">
                Checking your wallet…
              </Txt>
            </View>
          ) : (
            <>
              <View style={styles.pausedIcon}>
                <Ionicons name="wallet-outline" size={30} color={colors.gold} />
              </View>
              <Txt variant="heading" align="center">
                Wallet temporarily unavailable
              </Txt>
              <Txt variant="body" tone="secondary" align="center" style={styles.lead}>
                The wallet page is temporarily not available. Please win with your Personal Discount QR.
              </Txt>
              <Button
                label="Show Personal Discount QR"
                icon={<Ionicons name="qr-code-outline" size={18} color={colors.textOnGold} />}
                onPress={onPersonalQr}
                style={styles.action}
              />
              <Button label="Close" variant="ghost" onPress={onClose} style={styles.action} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: {
    width: '100%',
    maxWidth: 380,
    paddingTop: space.xl,
    paddingBottom: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  pickerCard: { maxHeight: '80%' },
  centerCard: { alignItems: 'center', gap: space.xs, maxWidth: 340 },
  close: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lead: { marginTop: space.xxs, marginBottom: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.maroonSoft,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15, paddingVertical: space.sm },
  list: { marginTop: space.sm, flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.md },
  rowPressed: { backgroundColor: colors.goldSoft },
  rowDisabled: { opacity: 0.45 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xl, gap: space.sm },
  retry: { marginTop: space.xs },
  empty: { paddingVertical: space.xl },
  checking: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  pausedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  action: { alignSelf: 'stretch' },
});
