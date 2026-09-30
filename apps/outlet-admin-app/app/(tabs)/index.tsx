import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import type { BillRecord, ReferredCustomerInput, ScanResult } from '@lotmorewins/types';
import { Button, Notice, Screen, Txt } from '../../components/ui';
import { BrandLogo } from '../../components/brand/Brand';
import { Scanner } from '../../components/scan/Scanner';
import { PartnerCard } from '../../components/scan/PartnerCard';
import { CustomerStep } from '../../components/scan/CustomerStep';
import { AmountStep } from '../../components/scan/AmountStep';
import { BillDone } from '../../components/scan/BillDone';
import { useSession } from '../../store/session-store';
import { colors, space } from '../../theme/tokens';

/**
 * Home screen: one continuous scan-and-bill flow, modelled on the reference Cafe Admin
 * scanner (scan → partner detected → customer details → bill → settled).
 *
 *   Direct partner QR:  scan → partner → amount → done
 *   Referral QR:        scan → partner → customer → amount → done
 *
 * Every amount, discount and point shown comes from the server, which calculates it from
 * the Super Admin settings.
 */
type Step = 'scan' | 'partner' | 'customer' | 'amount' | 'done';

const TITLES: Record<Step, string> = {
  scan: 'Scan partner QR',
  partner: 'Partner verified',
  customer: 'Referred customer',
  amount: 'Bill amount',
  done: 'Bill settled',
};

function Steps({ current, referral }: { current: Step; referral: boolean }) {
  const steps: { key: Step; label: string }[] = referral
    ? [
        { key: 'scan', label: 'Scan' },
        { key: 'customer', label: 'Customer' },
        { key: 'amount', label: 'Bill' },
        { key: 'done', label: 'Done' },
      ]
    : [
        { key: 'scan', label: 'Scan' },
        { key: 'amount', label: 'Bill' },
        { key: 'done', label: 'Done' },
      ];
  // Reviewing the scanned partner means scanning is done and the next step is up.
  const activeIndex = current === 'partner' ? 1 : steps.findIndex((s) => s.key === current);

  return (
    <View style={styles.steps}>
      {steps.map((s, i) => {
        const done = i < activeIndex || current === 'done';
        const active = i === activeIndex && current !== 'done';
        return (
          <View key={s.key} style={styles.stepCell}>
            <View style={[styles.stepBar, (done || active) && { backgroundColor: done ? colors.gold : colors.goldMuted }]} />
            <Txt variant="caption" tone={active ? 'gold' : done ? 'default' : 'muted'} style={styles.stepLabel}>
              {s.label}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

export default function ScanScreen() {
  const queryClient = useQueryClient();
  const outlet = useSession((s) => s.outlet);
  const signOut = useSession((s) => s.signOut);

  const [focused, setFocused] = useState(false);
  const [step, setStep] = useState<Step>('scan');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [customer, setCustomer] = useState<ReferredCustomerInput | undefined>(undefined);
  const [done, setDone] = useState<{ bill: BillRecord; replayed: boolean } | null>(null);

  const isReferral = scan?.qrType === 'REFERRAL';

  const reset = useCallback(() => {
    setStep('scan');
    setQrCode(null);
    setScan(null);
    setCustomer(undefined);
    setDone(null);
  }, []);

  const back = useCallback(() => {
    if (step === 'customer') setStep('partner');
    else if (step === 'amount') setStep(isReferral ? 'customer' : 'partner');
    else if (step === 'partner' || step === 'done') reset();
  }, [step, isReferral, reset]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      // Android back steps back through the flow instead of leaving the app.
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 'scan' || step === 'done') return false;
        back();
        return true;
      });
      return () => {
        setFocused(false);
        sub.remove();
      };
    }, [step, back])
  );

  const handleSignedOut = useCallback(() => {
    signOut();
  }, [signOut]);

  const onVerified = useCallback((code: string, result: ScanResult) => {
    setQrCode(code);
    setScan(result);
    setCustomer(undefined);
    setStep('partner');
  }, []);

  const onCompleted = (bill: BillRecord, replayed: boolean) => {
    setDone({ bill, replayed });
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  return (
    <Screen edges={['top']}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <BrandLogo size={44} />
        <View style={styles.flex}>
          <Txt variant="small" tone="secondary" numberOfLines={1}>
            {outlet?.name ?? 'Outlet'}
          </Txt>
          <Txt variant="title">{TITLES[step]}</Txt>
        </View>
      </Animated.View>

      {outlet?.status === 'INACTIVE' && (
        <Notice tone="error" title="Outlet inactive" message="Scanning and billing are disabled until the Super Admin reactivates this outlet." />
      )}

      <Steps current={step} referral={step === 'scan' ? false : isReferral} />

      <Animated.View key={step} entering={FadeInDown.duration(300)}>
        {step === 'scan' && <Scanner active={focused && step === 'scan'} onVerified={onVerified} onSignedOut={handleSignedOut} />}

        {step === 'partner' && scan && (
          <>
            <PartnerCard scan={scan} />
            <Txt variant="caption" tone="muted" align="center" style={styles.next}>
              {isReferral
                ? "Next: enter the customer who brought this partner's referral code."
                : 'Next: enter the bill amount for this partner.'}
            </Txt>
            <Button label="Proceed" onPress={() => setStep(isReferral ? 'customer' : 'amount')} />
            <Button label="Cancel & rescan" variant="secondary" onPress={reset} style={styles.secondary} />
          </>
        )}

        {step === 'customer' && scan && (
          <>
            <PartnerCard scan={scan} compact />
            <CustomerStep
              initial={customer}
              partnerMobile={scan.partner.mobile}
              onBack={() => setStep('partner')}
              onSubmit={(c) => {
                setCustomer(c);
                setStep('amount');
              }}
            />
          </>
        )}

        {step === 'amount' && scan && qrCode && (
          <>
            <PartnerCard scan={scan} compact />
            <AmountStep
              qrCode={qrCode}
              scan={scan}
              customer={customer}
              onEditCustomer={isReferral ? () => setStep('customer') : undefined}
              onCompleted={onCompleted}
              onCancel={reset}
              onSignedOut={handleSignedOut}
            />
          </>
        )}

        {step === 'done' && done && <BillDone bill={done.bill} replayed={done.replayed} onNext={reset} onSignedOut={handleSignedOut} />}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg, marginBottom: space.lg },
  steps: { flexDirection: 'row', gap: space.xs, marginBottom: space.xl },
  stepCell: { flex: 1 },
  stepBar: { height: 3, borderRadius: 2, backgroundColor: colors.line },
  stepLabel: { marginTop: 6 },
  next: { marginBottom: space.md },
  secondary: { marginTop: space.sm },
});
