import { useQuery } from '@tanstack/react-query';
import { ApiClientError } from '@lotmorewins/api-client';
import apiClient from './api';

/** Shared queries so Home, Rewards and Activity read the same cached wallet. */
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

export function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401 && error.code === 'UNAUTHENTICATED') return 'Your session has expired. Please sign in again.';
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return 'You appear to be offline. Check your connection and try again.';
    if (error.code === 'TIMEOUT') return 'The server took too long to respond. Please try again.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
