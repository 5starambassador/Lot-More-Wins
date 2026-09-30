import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { ScanResult } from '@lotmorewins/types';
import * as Haptics from '../../lib/haptics';
import { Button, Field, IconMark, Notice, Panel, Segmented, Txt } from '../ui';
import apiClient, { describeError, isAuthError } from '../../lib/api';
import { colors, radius, space } from '../../theme/tokens';

/**
 * Scan engine adapted from the reference Cafe Admin scanner (camera + manual entry):
 *   scanning → verifying → onVerified | error (re-arm)
 * The raw QR value goes to the server, the only authority on validity. Hardening over the
 * reference: a synchronous lock (camera callbacks fire faster than React re-renders),
 * same-code suppression after a failure, and a re-arm cooldown so a bad QR left in frame
 * does not loop requests.
 */

const FRAME_SIZE = 220;
const RE_ARM_COOLDOWN_MS = 1500;
const SAME_CODE_SUPPRESS_MS = 4000;

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = pos[0] === 't';
  const left = pos[1] === 'l';
  return (
    <View
      style={[
        styles.corner,
        top ? { top: 0, borderTopWidth: 3 } : { bottom: 0, borderBottomWidth: 3 },
        left ? { left: 0, borderLeftWidth: 3 } : { right: 0, borderRightWidth: 3 },
        top && left && { borderTopLeftRadius: radius.lg },
        top && !left && { borderTopRightRadius: radius.lg },
        !top && left && { borderBottomLeftRadius: radius.lg },
        !top && !left && { borderBottomRightRadius: radius.lg },
      ]}
    />
  );
}

function Viewfinder({ busy }: { busy: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [progress]);

  const laser = useAnimatedStyle(() => ({
    transform: [{ translateY: (progress.value - 0.5) * (FRAME_SIZE - 12) }],
  }));

  return (
    <View pointerEvents="none" style={styles.finderWrap}>
      <View style={styles.finder}>
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
        {!busy && <Animated.View style={[styles.laser, laser]} />}
      </View>
    </View>
  );
}

function PermissionPanel({ canAskAgain, onRequest, onManual }: { canAskAgain: boolean; onRequest: () => void; onManual: () => void }) {
  return (
    <Panel style={styles.permission}>
      <IconMark name="camera-outline" size={56} />
      <Txt variant="heading" align="center" style={{ marginTop: space.md }}>
        Camera access needed
      </Txt>
      <Txt variant="small" tone="secondary" align="center" style={styles.permissionCopy}>
        {canAskAgain
          ? 'Allow camera access to scan partner QR codes.'
          : 'Camera access was denied. Enable it in Settings to scan QR codes.'}
      </Txt>
      <Button
        label={canAskAgain ? 'Allow camera' : 'Open Settings'}
        onPress={canAskAgain ? onRequest : () => Linking.openSettings()}
        style={styles.stretch}
      />
      <Pressable onPress={onManual} hitSlop={8} style={{ marginTop: space.md }}>
        <Txt variant="smallMedium" tone="gold">
          Enter code manually
        </Txt>
      </Pressable>
    </Panel>
  );
}

export function Scanner({
  active,
  onVerified,
  onSignedOut,
}: {
  /** Camera runs only while the scan step is visible and the tab is focused. */
  active: boolean;
  onVerified: (qrCode: string, result: ScanResult) => void;
  onSignedOut: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  const lockRef = useRef(false);
  const lastFailureRef = useRef<{ code: string; at: number } | null>(null);
  const reArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-arm whenever the scanner becomes active again (e.g. after "Scan next").
  useEffect(() => {
    if (active) {
      lockRef.current = false;
      setBusy(false);
    }
    return () => {
      if (reArmTimer.current) clearTimeout(reArmTimer.current);
    };
  }, [active]);

  const verify = useCallback(
    async (raw: string, source: 'camera' | 'manual') => {
      const code = raw.trim();
      if (!code || lockRef.current) return;

      const last = lastFailureRef.current;
      if (source === 'camera' && last && last.code === code && Date.now() - last.at < SAME_CODE_SUPPRESS_MS) return;

      lockRef.current = true;
      setBusy(true);
      setErrorMsg(null);

      try {
        const res = await apiClient.scanQr(code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setManualCode('');
        setBusy(false);
        onVerified(code, res.data); // lock stays held until the scanner is re-activated
      } catch (err) {
        if (isAuthError(err)) {
          onSignedOut();
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        lastFailureRef.current = { code, at: Date.now() };
        setErrorMsg(describeError(err, 'Could not verify this QR code'));
        setBusy(false);
        if (source === 'manual') {
          lockRef.current = false;
        } else {
          reArmTimer.current = setTimeout(() => {
            lockRef.current = false;
          }, RE_ARM_COOLDOWN_MS);
        }
      }
    },
    [onVerified, onSignedOut]
  );

  const onBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (!lockRef.current) verify(data, 'camera');
    },
    [verify]
  );

  const cameraOn = active && mode === 'camera' && !!permission?.granted;

  return (
    <View>
      <View style={styles.segmented}>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrorMsg(null);
          }}
          options={[
            { value: 'camera', label: 'Camera scan' },
            { value: 'manual', label: 'Enter code' },
          ]}
        />
      </View>

      {errorMsg && <Notice tone="error" title="QR not accepted" message={errorMsg} onDismiss={() => setErrorMsg(null)} />}

      {mode === 'camera' && !permission && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}

      {mode === 'camera' && permission && !permission.granted && (
        <PermissionPanel canAskAgain={permission.canAskAgain} onRequest={requestPermission} onManual={() => setMode('manual')} />
      )}

      {mode === 'camera' && permission?.granted && (
        <>
          <View style={styles.camera}>
            {cameraOn && (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={busy ? undefined : onBarcodeScanned}
              />
            )}
            <Viewfinder busy={busy} />
            {busy && (
              <View style={styles.busy}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Txt variant="overline" style={{ marginTop: space.sm }}>
                  Verifying QR…
                </Txt>
              </View>
            )}
          </View>
          <Txt variant="caption" tone="muted" align="center" style={{ marginTop: space.sm }}>
            Hold the partner&apos;s discount or referral QR inside the frame. It scans automatically.
          </Txt>
        </>
      )}

      {mode === 'manual' && (
        <View>
          <Field
            label="Partner QR code"
            placeholder="LMW-DISC-… or LMW-REF-…"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="go"
            onSubmitEditing={() => verify(manualCode, 'manual')}
            hint="The code printed under the QR in the partner app."
          />
          <Button label="Verify code" onPress={() => verify(manualCode, 'manual')} loading={busy} disabled={!manualCode.trim()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { marginBottom: space.lg },
  loading: { height: 320, alignItems: 'center', justifyContent: 'center' },
  camera: {
    aspectRatio: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: '#140404',
  },
  finderWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  finder: { width: FRAME_SIZE, height: FRAME_SIZE, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.gold },
  laser: {
    width: FRAME_SIZE - 30,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.goldBright,
    shadowColor: colors.gold,
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 4, 4, 0.65)',
  },
  permission: { alignItems: 'center', paddingVertical: space.xl },
  permissionCopy: { marginTop: space.xs, marginBottom: space.lg, paddingHorizontal: space.md },
  stretch: { alignSelf: 'stretch' },
});
