import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ApiClientError } from '@lotmorewins/api-client';
import apiClient from './api';

/** Shared queries so Home, Wallet and Notifications read the same cached data. */
export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: async () => (await apiClient.getPartnerWallet()).data,
  });
}

export function useOutlets() {
  return useQuery({
    queryKey: ['outlets'],
    queryFn: async () => (await apiClient.getOutlets()).data,
  });
}

/** Referral progress, current offers and the unread notification count. */
export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: async () => (await apiClient.getPartnerHome()).data,
  });
}

const NOTIFICATIONS_PAGE_SIZE = 30;

/** The whole activity feed, loaded a page at a time as the list is scrolled. */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => (await apiClient.getPartnerNotifications(pageParam, NOTIFICATIONS_PAGE_SIZE)).data,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.page + 1 : undefined),
  });
}

/** Public outlet names for the registration "Referred by" list (no session yet). */
export function useOutletOptions(enabled = true) {
  return useQuery({
    queryKey: ['outlet-options'],
    queryFn: async () => (await apiClient.getOutletOptions()).data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Public offers shown while registering (no session yet). */
export function useOffers() {
  return useQuery({
    queryKey: ['offers'],
    queryFn: async () => (await apiClient.getPartnerOffers()).data,
    staleTime: 5 * 60_000,
  });
}

export function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401 && error.code === 'UNAUTHENTICATED') return 'Your session has expired. Please sign in again.';
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return 'You appear to be offline. Check your connection and try again.';
    if (error.code === 'TIMEOUT') return 'The server took too long to respond. Please try again.';
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
