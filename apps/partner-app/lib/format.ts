export function firstName(name: string | undefined | null): string {
  return (name ?? '').trim().split(/\s+/)[0] || 'Partner';
}

export function initials(name: string | undefined | null): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatPoints(points: number): string {
  return points.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Percentages come from the Super Admin settings with up to 2 decimals; drop trailing zeros. */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "Just now", "12 min ago", "3 h ago", then the date. */
export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDateTime(iso);
}

/**
 * By local time: 3:00–11:59 morning, 12:00–15:59 afternoon, 16:00–18:59 evening,
 * 19:00–2:59 night.
 */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h >= 3 && h < 12) return 'Good morning';
  if (h >= 12 && h < 16) return 'Good afternoon';
  if (h >= 16 && h < 19) return 'Good evening';
  return 'Good night';
}
