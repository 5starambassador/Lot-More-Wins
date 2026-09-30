import type { PartnerProfile, PartnerRole } from '@lotmorewins/types';

export function roleLabel(role: PartnerRole | undefined): string {
  switch (role) {
    case 'STAFF':
      return 'Achariya Staff';
    case 'TEACHER':
      return 'Achariya Teacher';
    case 'PARENT':
      return 'Achariya Parent';
    default:
      return 'Partner';
  }
}

/** Display label for the server-assigned classification. */
export function tierLabel(partner: Pick<PartnerProfile, 'isAchariyaAssociated'> | null | undefined): string {
  return partner?.isAchariyaAssociated ? 'Achariya Member' : 'Partner';
}

export function firstName(name: string | undefined | null): string {
  return (name ?? '').trim().split(/\s+/)[0] || 'Partner';
}

export function formatPoints(points: number): string {
  return points.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
