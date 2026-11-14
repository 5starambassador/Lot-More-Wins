import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from './api';
import * as Haptics from './haptics';

const POLL_MS = 4000;

/**
 * While a QR page is open (Personal Discount QR, redeem QR), watch for the outlet completing a
 * bill with it and then go back to Home. The first check only records the newest bill so far; any
 * newer bill after that means the QR was just billed. Errors (offline, an older server without
 * the endpoint) are ignored: the page simply stays.
 */
export function useReturnHomeOnBill(active: boolean) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const baseline = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const check = async () => {
      try {
        const latest = (await apiClient.getPartnerLatestBill()).data;
        if (stopped) return;
        const id = latest?.id ?? null;
        if (baseline.current === undefined) {
          baseline.current = id;
          return;
        }
        if (id && id !== baseline.current) {
          stopped = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          queryClient.invalidateQueries({ queryKey: ['home'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          if (router.canDismiss()) router.dismissAll();
          router.navigate('/dashboard');
        }
      } catch {
        // Keep the page; try again on the next tick.
      }
    };
    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, queryClient, router]);
}
