import { create } from 'zustand';
import type { MessagingMode, PartnerReferredByPayload } from '@lotmorewins/types';

/** Registration wizard state: 1 contact, 2 address, 3 birthday (optional), 4 OTP, 5 password. */
interface OnboardingState {
  name: string;
  mobile: string;
  email: string;
  /** Optional "Referred by" answer; null when left blank. */
  referredBy: PartnerReferredByPayload | null;
  city: string;
  state: string;
  pincode: string;
  /** YYYY-MM-DD, or null when the birthday step was skipped. */
  dateOfBirth: string | null;
  otp: string;
  messagingMode: MessagingMode;

  setContact: (details: { name: string; mobile: string; email: string; referredBy: PartnerReferredByPayload | null }) => void;
  setAddress: (details: { city: string; state: string; pincode: string }) => void;
  setDateOfBirth: (dateOfBirth: string | null) => void;
  setMessagingMode: (mode: MessagingMode) => void;
  setOtp: (otp: string) => void;
  reset: () => void;
}

const initialState = {
  name: '',
  mobile: '',
  email: '',
  referredBy: null as PartnerReferredByPayload | null,
  city: '',
  state: '',
  pincode: '',
  dateOfBirth: null,
  otp: '',
  messagingMode: 'email' as MessagingMode,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setContact: (details) => set(details),
  setAddress: (details) => set(details),
  setDateOfBirth: (dateOfBirth) => set({ dateOfBirth }),
  setMessagingMode: (messagingMode) => set({ messagingMode }),
  setOtp: (otp) => set({ otp }),

  reset: () => set(initialState),
}));
