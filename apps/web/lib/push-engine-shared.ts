/**
 * Push notification engine: what the Super Admin page and the server share. No server imports
 * here, so the page can use the filters, grouping and schedule text as they are.
 */

export type PushPlatform = 'android' | 'ios';
export type PartnerStatusValue = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED';
export type PartnerCategoryValue = 'ACHARIYA' | 'NON_ACHARIYA';
export type PushScheduleType = 'NOW' | 'ONCE' | 'DAILY' | 'WEEKLY';
export type PushCampaignStatus = 'SCHEDULED' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

export interface PushTemplateItem {
  id: string;
  name: string;
  title: string;
  body: string;
  detail: string | null;
  url: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Campaigns sent or scheduled from it. */
  campaigns: number;
  lastSentAt: string | null;
}

/** Where a tap can lead in the partner app. "/notification" = the message's own page. */
export const APP_DESTINATIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default: the message’s own page (or Notifications)' },
  { value: '/dashboard', label: 'Home' },
  { value: '/wallet', label: 'Wallet' },
  { value: '/redeem', label: 'Redeem from wallet' },
  { value: '/qr/discount', label: 'Personal Discount QR' },
  { value: '/qr/referral', label: 'Referral QR' },
  { value: '/referral-history', label: 'Referral history' },
  { value: '/transfer', label: 'Send points to a partner' },
  { value: '/notifications', label: 'Notifications list' },
  { value: '/profile', label: 'Profile' },
];

/** An in-app route ("/wallet", "/outlet/<id>") or a web link (https://…). */
export function isValidPushUrl(url: string): boolean {
  if (/^\/[A-Za-z0-9\-._~/?=&%[\]]*$/.test(url)) return !url.startsWith('//');
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function describeUrl(url: string | null): string {
  if (!url) return 'Message page';
  const known = APP_DESTINATIONS.find((d) => d.value === url);
  if (known) return `App: ${known.label}`;
  if (url.startsWith('/outlet/')) return 'App: an outlet page';
  return url.startsWith('/') ? `App: ${url}` : url;
}

/** Push limits the phones show without cutting off (Android collapsed / iOS lock screen, roughly). */
export const TITLE_LIMIT = 65;
export const BODY_LIMIT = 178;

// ----------------------------------------------------------------------------
// Audience
// ----------------------------------------------------------------------------

/** One partner with the numbers the audience can be filtered and grouped by. */
export interface AudienceRow {
  id: string;
  partnerCode: string;
  name: string;
  mobile: string;
  city: string | null;
  status: PartnerStatusValue;
  category: PartnerCategoryValue;
  joinedAt: string;
  /** Partners who registered giving this partner as "Referred by". */
  registeredReferrals: number;
  /** Bills paid by friends with this partner's Referral QR. */
  referralBills: number;
  /** The partner's own bills with the Personal Discount QR. */
  personalBills: number;
  /** Bills paid partly from the wallet. */
  redeemBills: number;
  lastBillAt: string | null;
  androidDevices: number;
  iosDevices: number;
}

export interface Range {
  min?: number;
  max?: number;
}

export interface AudienceFilter {
  search?: string;
  statuses?: PartnerStatusValue[];
  categories?: PartnerCategoryValue[];
  cities?: string[];
  /** IST calendar days, YYYY-MM-DD. */
  joinedFrom?: string;
  joinedTo?: string;
  /** with = has the app with notifications on (any platform). */
  devices?: 'any' | 'with' | 'android' | 'ios' | 'none';
  registeredReferrals?: Range;
  referralBills?: Range;
  personalBills?: Range;
  redeemBills?: Range;
  /** A bill (own or referred) in the last N days. */
  activeWithinDays?: number;
  /** No bill in the last N days (including never). */
  inactiveForDays?: number;
}

export type Audience = { kind: 'all' } | { kind: 'filter'; filter: AudienceFilter } | { kind: 'partners'; ids: string[] };

export const DEFAULT_FILTER: AudienceFilter = { statuses: ['ACTIVE'], devices: 'any' };

const inRange = (n: number, r?: Range) => !r || ((r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max));

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

/** The IST calendar day of an instant, YYYY-MM-DD. */
export function istDay(iso: string | Date): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function matchesFilter(row: AudienceRow, f: AudienceFilter, now = Date.now()): boolean {
  if (f.statuses?.length && !f.statuses.includes(row.status)) return false;
  if (f.categories?.length && !f.categories.includes(row.category)) return false;
  if (f.cities?.length && !f.cities.some((c) => c.toLowerCase() === (row.city ?? '').trim().toLowerCase())) return false;
  const joined = istDay(row.joinedAt);
  if (f.joinedFrom && joined < f.joinedFrom) return false;
  if (f.joinedTo && joined > f.joinedTo) return false;
  const devices = f.devices ?? 'any';
  if (devices === 'with' && row.androidDevices + row.iosDevices === 0) return false;
  if (devices === 'android' && row.androidDevices === 0) return false;
  if (devices === 'ios' && row.iosDevices === 0) return false;
  if (devices === 'none' && row.androidDevices + row.iosDevices > 0) return false;
  if (!inRange(row.registeredReferrals, f.registeredReferrals)) return false;
  if (!inRange(row.referralBills, f.referralBills)) return false;
  if (!inRange(row.personalBills, f.personalBills)) return false;
  if (!inRange(row.redeemBills, f.redeemBills)) return false;
  const last = row.lastBillAt ? Date.parse(row.lastBillAt) : null;
  if (f.activeWithinDays !== undefined && (last === null || now - last > f.activeWithinDays * DAY_MS)) return false;
  if (f.inactiveForDays !== undefined && last !== null && now - last <= f.inactiveForDays * DAY_MS) return false;
  const q = f.search?.trim().toLowerCase();
  if (q) {
    const hay = [row.name, row.partnerCode, row.mobile, row.city ?? ''].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** True when the filter narrows nothing beyond "active partners". */
export function isPlainFilter(f: AudienceFilter): boolean {
  const statuses = f.statuses ?? [];
  return (
    statuses.length === 1 &&
    statuses[0] === 'ACTIVE' &&
    !f.search?.trim() &&
    !f.categories?.length &&
    !f.cities?.length &&
    !f.joinedFrom &&
    !f.joinedTo &&
    (f.devices ?? 'any') === 'any' &&
    [f.registeredReferrals, f.referralBills, f.personalBills, f.redeemBills].every((r) => !r || (r.min === undefined && r.max === undefined)) &&
    f.activeWithinDays === undefined &&
    f.inactiveForDays === undefined
  );
}

// ----------------------------------------------------------------------------
// Grouping (partner list on the send page)
// ----------------------------------------------------------------------------

export type GroupBy =
  | 'none'
  | 'joinedDay'
  | 'joinedMonth'
  | 'registeredReferrals'
  | 'referralBills'
  | 'personalBills'
  | 'redeemBills'
  | 'lastBill'
  | 'category'
  | 'city'
  | 'platform'
  | 'status';

export const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'joinedDay', label: 'Registration date' },
  { value: 'joinedMonth', label: 'Registration month' },
  { value: 'registeredReferrals', label: 'No. of registered referrals' },
  { value: 'referralBills', label: 'No. of referral QR bills' },
  { value: 'personalBills', label: 'No. of personal discount bills' },
  { value: 'redeemBills', label: 'No. of wallet redeem bills' },
  { value: 'lastBill', label: 'Last bill (activity)' },
  { value: 'category', label: 'Category' },
  { value: 'city', label: 'City' },
  { value: 'platform', label: 'Device (Android / iOS)' },
  { value: 'status', label: 'Status' },
];

/** Exact counts up to 10, then bands, so a group is never a single huge number. */
function countBand(n: number): { key: string; label: string; order: number } {
  if (n <= 10) return { key: String(n), label: String(n), order: n };
  if (n <= 20) return { key: '11-20', label: '11–20', order: 11 };
  if (n <= 50) return { key: '21-50', label: '21–50', order: 21 };
  return { key: '51+', label: '51 or more', order: 51 };
}

function lastBillBand(iso: string | null, now: number) {
  if (!iso) return { key: 'never', label: 'No bills yet', order: 99 };
  const days = (now - Date.parse(iso)) / DAY_MS;
  if (days <= 7) return { key: '7', label: 'In the last 7 days', order: 1 };
  if (days <= 30) return { key: '30', label: '8–30 days ago', order: 2 };
  if (days <= 90) return { key: '90', label: '31–90 days ago', order: 3 };
  return { key: 'older', label: 'More than 90 days ago', order: 4 };
}

const monthLabel = (day: string) =>
  new Date(`${day.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export interface AudienceGroup {
  key: string;
  label: string;
  rows: AudienceRow[];
}

const COUNT_FIELDS = {
  registeredReferrals: 'registered referrals',
  referralBills: 'referral QR bills',
  personalBills: 'personal discount bills',
  redeemBills: 'wallet redeem bills',
} as const;

/** Groups in a sensible order: newest dates first, highest counts first. */
export function groupAudience(rows: AudienceRow[], by: GroupBy, now = Date.now()): AudienceGroup[] {
  if (by === 'none') return [{ key: 'all', label: 'All partners', rows }];
  const groups = new Map<string, AudienceGroup & { order: number | string }>();
  for (const row of rows) {
    let g: { key: string; label: string; order: number | string };
    if (by === 'joinedDay') {
      const d = istDay(row.joinedAt);
      g = { key: d, label: dayLabel(d), order: d };
    } else if (by === 'joinedMonth') {
      const d = istDay(row.joinedAt);
      g = { key: d.slice(0, 7), label: monthLabel(d), order: d.slice(0, 7) };
    } else if (by in COUNT_FIELDS) {
      const field = by as keyof typeof COUNT_FIELDS;
      const band = countBand(row[field]);
      g = { ...band, label: `${band.label} ${COUNT_FIELDS[field]}` };
    } else if (by === 'lastBill') g = lastBillBand(row.lastBillAt, now);
    else if (by === 'category') g = row.category === 'ACHARIYA' ? { key: 'A', label: 'Achariya', order: 1 } : { key: 'N', label: 'Non-Achariya', order: 2 };
    else if (by === 'city') {
      const city = row.city?.trim() || '';
      g = { key: city.toLowerCase() || '~', label: city || 'City not given', order: city ? city.toLowerCase() : '~' };
    } else if (by === 'platform') {
      const a = row.androidDevices > 0;
      const i = row.iosDevices > 0;
      g = a && i ? { key: 'both', label: 'Android and iOS', order: 1 } : a ? { key: 'android', label: 'Android', order: 2 } : i ? { key: 'ios', label: 'iOS (iPhone)', order: 3 } : { key: 'none', label: 'No device registered (in-app list only)', order: 4 };
    } else g = { key: row.status, label: row.status.charAt(0) + row.status.slice(1).toLowerCase(), order: row.status };
    const existing = groups.get(g.key);
    if (existing) existing.rows.push(row);
    else groups.set(g.key, { key: g.key, label: g.label, order: g.order, rows: [row] });
  }
  const desc = by === 'joinedDay' || by === 'joinedMonth' || by in COUNT_FIELDS;
  return [...groups.values()]
    .sort((a, b) => {
      const cmp = typeof a.order === 'number' && typeof b.order === 'number' ? a.order - b.order : String(a.order).localeCompare(String(b.order));
      return desc ? -cmp : cmp;
    })
    .map(({ key, label, rows: r }) => ({ key, label, rows: r }));
}

// ----------------------------------------------------------------------------
// Schedules (all times IST: the partners are in Puducherry and Tamil Nadu)
// ----------------------------------------------------------------------------

export interface ScheduleSpec {
  type: PushScheduleType;
  /** ONCE: ISO instant. */
  sendAt?: string | null;
  /** DAILY / WEEKLY: HH:MM IST. */
  timeOfDay?: string | null;
  /** WEEKLY: 0 = Sunday … 6 = Saturday. */
  weekdays?: number[];
  /** DAILY / WEEKLY: YYYY-MM-DD (IST), inclusive. */
  startDate?: string | null;
  endDate?: string | null;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The instant of an IST wall-clock time on an IST day. */
export function istInstant(day: string, time: string): Date {
  return new Date(`${day}T${time}:00+05:30`);
}

function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The first send of a schedule strictly after `after`, or null when there is none left
 * (a one-off already past, or a series past its end date).
 */
export function nextOccurrence(s: ScheduleSpec, after: Date): Date | null {
  if (s.type === 'NOW') return null;
  if (s.type === 'ONCE') {
    const at = s.sendAt ? new Date(s.sendAt) : null;
    return at && at.getTime() > after.getTime() ? at : null;
  }
  const time = s.timeOfDay ?? '09:00';
  let day = istDay(after);
  if (s.startDate && s.startDate > day) day = s.startDate;
  for (let i = 0; i < 400; i++, day = addDays(day, 1)) {
    if (s.endDate && day > s.endDate) return null;
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (s.type === 'WEEKLY' && !(s.weekdays ?? []).includes(weekday)) continue;
    const at = istInstant(day, time);
    if (at.getTime() > after.getTime()) return at;
  }
  return null;
}

const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
};

export function formatIst(iso: string | Date): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

export function describeSchedule(s: ScheduleSpec): string {
  const range = [s.startDate && `from ${dayLabel(s.startDate)}`, s.endDate && `until ${dayLabel(s.endDate)}`].filter(Boolean).join(' ');
  switch (s.type) {
    case 'NOW':
      return 'Sent immediately';
    case 'ONCE':
      return s.sendAt ? `Once, ${formatIst(s.sendAt)} IST` : 'Once';
    case 'DAILY':
      return `Every day at ${fmtTime(s.timeOfDay ?? '09:00')} IST${range ? `, ${range}` : ''}`;
    case 'WEEKLY': {
      const days = [...(s.weekdays ?? [])].sort().map((d) => WEEKDAYS[d]).join(', ');
      return `Every ${days || '—'} at ${fmtTime(s.timeOfDay ?? '09:00')} IST${range ? `, ${range}` : ''}`;
    }
  }
}

// ----------------------------------------------------------------------------
// Campaigns and runs (what the page lists)
// ----------------------------------------------------------------------------

export interface PushRunItem {
  id: string;
  campaignId: string;
  title: string;
  scheduledFor: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'sending' | 'sent' | 'failed' | 'missed';
  partners: number;
  devices: number;
  accepted: number;
  errors: Record<string, number>;
}

export interface PushCampaignItem extends ScheduleSpec {
  id: string;
  templateId: string | null;
  templateName: string | null;
  title: string;
  body: string;
  detail: string | null;
  url: string | null;
  audience: Audience;
  audienceSize: number;
  platforms: PushPlatform[];
  saveToInbox: boolean;
  status: PushCampaignStatus;
  nextRunAt: string | null;
  createdBy: string;
  createdAt: string;
  runCount: number;
  lastRun: PushRunItem | null;
}

export interface PushOverview {
  partners: { active: number; withDevice: number; android: number; ios: number };
  devices: { android: number; ios: number };
  scheduled: number;
  /** Sends in the last 30 days. */
  recentRuns: number;
  /** When the dispatcher last ran (any trigger); null if never. */
  dispatcherSeenAt: string | null;
}

export function describeAudience(a: Audience, size?: number): string {
  const n = size !== undefined ? ` (${size.toLocaleString('en-IN')})` : '';
  if (a.kind === 'all') return `All active partners${n}`;
  if (a.kind === 'filter') return `Partners matching filters${n}, re-checked at each send`;
  return `${a.ids.length.toLocaleString('en-IN')} selected partners`;
}
