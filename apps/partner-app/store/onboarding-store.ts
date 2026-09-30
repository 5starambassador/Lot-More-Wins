import { create } from 'zustand';
import type { PartnerRole, MessagingMode } from '@lotmorewins/types';

interface OnboardingState {
  isAchariyaAssociated: boolean;
  role: PartnerRole;
  name: string;
  mobile: string;
  email: string;
  employeeId: string;
  admissionNumber: string;
  verifiedIdentityTitle: string | null;
  otp: string;
  otpChannel: string | null;
  otpExpiresAt: string | null;
  messagingMode: MessagingMode;

  setAssociation: (isAssociated: boolean) => void;
  setRole: (role: PartnerRole) => void;
  setFormDetails: (details: {
    name: string;
    mobile: string;
    email: string;
    employeeId?: string;
    admissionNumber?: string;
    verifiedIdentityTitle?: string | null;
  }) => void;
  setOtpInfo: (otpChannel: string, expiresAt: string, mode: MessagingMode) => void;
  setOtp: (otp: string) => void;
  reset: () => void;
}

const initialState = {
  isAchariyaAssociated: false,
  role: 'NON_ACHARIYA' as PartnerRole,
  name: '',
  mobile: '',
  email: '',
  employeeId: '',
  admissionNumber: '',
  verifiedIdentityTitle: null,
  otp: '',
  otpChannel: null,
  otpExpiresAt: null,
  messagingMode: 'email' as MessagingMode,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setAssociation: (isAchariyaAssociated) =>
    set({
      isAchariyaAssociated,
      role: isAchariyaAssociated ? 'STAFF' : 'NON_ACHARIYA',
    }),

  setRole: (role) => set({ role }),

  setFormDetails: (details) =>
    set((state) => ({
      name: details.name || state.name,
      mobile: details.mobile || state.mobile,
      email: details.email || state.email,
      employeeId: details.employeeId !== undefined ? details.employeeId : state.employeeId,
      admissionNumber: details.admissionNumber !== undefined ? details.admissionNumber : state.admissionNumber,
      verifiedIdentityTitle:
        details.verifiedIdentityTitle !== undefined
          ? details.verifiedIdentityTitle
          : state.verifiedIdentityTitle,
    })),

  setOtpInfo: (otpChannel, otpExpiresAt, messagingMode) =>
    set({ otpChannel, otpExpiresAt, messagingMode }),

  setOtp: (otp) => set({ otp }),

  reset: () => set(initialState),
}));
