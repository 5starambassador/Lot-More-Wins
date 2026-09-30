import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { referredCustomerSchema } from '@lotmorewins/validation';
import type { CustomerLookup, ReferredCustomerInput } from '@lotmorewins/types';
import { Badge, Button, Field, Txt } from '../ui';
import apiClient from '../../lib/api';
import { normalizeMobileInput } from '../../lib/format';
import { colors, space } from '../../theme/tokens';

/**
 * Details of the customer who brought a partner's referral code. The mobile number is the
 * customer's long-term identity: purchase points are kept against it until they join the app.
 * A known mobile pre-fills name and email.
 */
export function CustomerStep({
  initial,
  partnerMobile,
  onSubmit,
  onBack,
}: {
  initial?: ReferredCustomerInput;
  partnerMobile: string;
  onSubmit: (customer: ReferredCustomerInput, known: CustomerLookup | null) => void;
  onBack: () => void;
}) {
  const [input, setInput] = useState({ name: initial?.name ?? '', mobile: initial?.mobile ?? '', email: initial?.email ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookup, setLookup] = useState<CustomerLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const lastLooked = useRef<string | null>(null);

  const mobile = normalizeMobileInput(input.mobile);
  const isSelf = mobile !== null && mobile === partnerMobile;

  useEffect(() => {
    if (!mobile || isSelf || lastLooked.current === mobile) return;
    lastLooked.current = mobile;
    let cancelled = false;
    setLooking(true);
    apiClient
      .lookupCustomer(mobile)
      .then((res) => {
        if (cancelled) return;
        setLookup(res.data);
        if (res.data) {
          setInput((cur) => ({
            ...cur,
            name: cur.name.trim() ? cur.name : res.data!.name,
            email: cur.email.trim() ? cur.email : res.data!.email ?? '',
          }));
        }
      })
      .catch(() => {
        if (!cancelled) setLookup(null); // the lookup only pre-fills; billing does not depend on it
      })
      .finally(() => {
        if (!cancelled) setLooking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mobile, isSelf]);

  const submit = () => {
    if (isSelf) {
      setErrors({ mobile: "This is the referring partner's own mobile. Partners use their Discount QR instead." });
      return;
    }
    const parsed = referredCustomerSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit({ name: parsed.data.name, mobile: parsed.data.mobile, email: parsed.data.email }, lookup);
  };

  return (
    <View>
      <Txt variant="heading">Customer details</Txt>
      <Txt variant="small" tone="secondary" style={styles.intro}>
        Who brought this referral code? Their mobile number keeps track of their purchase points.
      </Txt>

      <Field
        label="Mobile number"
        prefix="+91"
        value={input.mobile}
        onChangeText={(v) => {
          setInput({ ...input, mobile: v });
          if (normalizeMobileInput(v) !== mobile) setLookup(null);
        }}
        error={errors.mobile ?? (isSelf ? "This is the referring partner's own mobile number." : null)}
        keyboardType="phone-pad"
        maxLength={14}
        placeholder="98765 43210"
        autoFocus={!initial}
        accessory={looking ? <ActivityIndicator size="small" color={colors.gold} style={styles.spinner} /> : null}
      />

      {lookup && mobile && (
        <View style={styles.known}>
          <Badge label={lookup.isPartner ? 'Registered partner' : 'Returning customer'} tone={lookup.isPartner ? 'success' : 'gold'} />
          <Txt variant="caption" tone="muted">
            Details filled from their last visit
          </Txt>
        </View>
      )}

      <Field
        label="Customer name"
        value={input.name}
        onChangeText={(name) => setInput({ ...input, name })}
        error={errors.name}
        autoCapitalize="words"
        placeholder="Full name"
      />
      <Field
        label="Email (optional)"
        value={input.email}
        onChangeText={(email) => setInput({ ...input, email })}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="For the bill by email"
      />

      <View style={styles.actions}>
        <Button label="Back" variant="secondary" onPress={onBack} style={styles.back} />
        <Button label="Continue" onPress={submit} style={styles.next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: space.xxs, marginBottom: space.xl },
  spinner: { marginRight: space.md },
  known: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginTop: -space.xs, marginBottom: space.lg },
  actions: { flexDirection: 'row', gap: space.sm },
  back: { flex: 1 },
  next: { flex: 2 },
});
