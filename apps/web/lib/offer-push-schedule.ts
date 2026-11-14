import type { ScheduledGreeting } from './scheduled-greeting';

/**
 * Weekend-offer pushes (14–15 Nov 2026): one at 20:25 IST on 14 Nov, then ten on 15 Nov from
 * 08:00 to 20:00 IST, every 80 minutes. Partners are in Puducherry, Cuddalore and Villupuram,
 * so every time is IST. Each has its own Vercel cron in vercel.json (UTC = IST − 5:30) and a
 * marker row, so it sends exactly once whichever sender (cron or the backup runner) gets there first.
 */
export const OFFER_PUSH_SLOTS: { at: string; title: string; body: string }[] = [
  { at: '2026-11-14T20:25', title: '🔥 Tonight & Tomorrow: 50% OFF + FREE Ice Cream! 🍦', body: 'Weekend offer (14–15 Nov): 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700 at TDG & Hope Café. Leave a Google Review for a FREE ice cream! 🎁' },
  { at: '2026-11-15T08:00', title: '☀️ Last Day: 50% OFF + FREE Ice Cream! 🍦', body: 'Today only (15 Nov): 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700 at TDG & Hope Café. Leave a Google Review for a FREE ice cream! 🎁' },
  { at: '2026-11-15T09:20', title: '🥐 Breakfast Deal: 50% OFF + FREE Ice Cream!', body: 'The weekend offer ends today: 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700 at TDG & Hope Café. Google Review = FREE ice cream! 🍦' },
  { at: '2026-11-15T10:40', title: '🔥 Weekend Offer: 50% OFF + FREE Ice Cream! 🍦', body: 'Last day (15 Nov)! Bills above ₹1,000 get 50% OFF, above ₹700 get ₹300 OFF at TDG & Hope Café. Review us on Google for a FREE ice cream! 🎁' },
  { at: '2026-11-15T12:00', title: '🍽️ Lunch Offer: 50% OFF + FREE Ice Cream!', body: 'Lunch at TDG or Hope Café today: 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700. Leave a Google Review for a FREE ice cream! 🍦' },
  { at: '2026-11-15T13:20', title: '💸 Pay Half Today + FREE Ice Cream! 🍦', body: 'Weekend offer (14–15 Nov) ends tonight: 50% OFF above ₹1,000 or ₹300 OFF above ₹700 at TDG & Hope Café. FREE ice cream for your Google Review! 🎁' },
  { at: '2026-11-15T14:40', title: '☕ Afternoon Treat: 50% OFF + FREE Ice Cream!', body: 'At Hope Café (White Town & Auroville) and TDG today: 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700. Google Review = FREE ice cream! 🍦' },
  { at: '2026-11-15T16:00', title: '🌊 ECR Evening: 50% OFF + FREE Ice Cream! 🍦', body: 'Visit TDG, Kottakuppam or Hope Café: 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700, today only. Review us on Google for a FREE ice cream! 🎁' },
  { at: '2026-11-15T17:20', title: '⏳ Hours Left: 50% OFF + FREE Ice Cream!', body: 'The 14–15 Nov weekend offer ends tonight: 50% OFF above ₹1,000 or ₹300 OFF above ₹700 at TDG & Hope Café. Leave a Google Review for a FREE ice cream! 🍦' },
  { at: '2026-11-15T18:40', title: '🌙 Dinner Deal: 50% OFF + FREE Ice Cream! 🍦', body: 'Take the family to TDG or Hope Café tonight: 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700. FREE ice cream for your Google Review! 🎁' },
  { at: '2026-11-15T20:00', title: '🚨 Final Call: 50% OFF + FREE Ice Cream! 🍦', body: 'Last chance tonight! 50% OFF on bills above ₹1,000 or ₹300 OFF above ₹700 at TDG & Hope Café. Leave a Google Review for a FREE ice cream! 🎁' },
];

/** Slot 0 is tonight (14 Nov); slots 1–10 are 15 Nov. */
export function offerPushSlot(slot: number): ScheduledGreeting | null {
  const s = Number.isInteger(slot) ? OFFER_PUSH_SLOTS[slot] : undefined;
  if (!s) return null;
  const at = Date.parse(`${s.at}:00+05:30`);
  return {
    marker: `offer-push-${s.at}`,
    title: s.title,
    body: s.body,
    sendFrom: new Date(at - 5 * 60_000).toISOString(),
    // A cron may fire late in its hour; the marker still keeps it to one send.
    sendUntil: new Date(at + 70 * 60_000).toISOString(),
  };
}
