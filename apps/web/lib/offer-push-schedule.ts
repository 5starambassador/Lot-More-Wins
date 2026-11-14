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

/** The full offer, shown on the notification's own page in the app (same text as the WhatsApp template). */
export const OFFER_DETAIL = "🔥 *WARM GREETINGS FROM LOT MORE WINS!* 🙏✨\n\nDear LMW Partner,\n\n🎁 *EXCLUSIVE OFFERS FOR THIS WEEKEND(14th Nov & 15th Nov)*\n\n✅ *50% OFF* on bills above ₹1,000\n✅ *₹300 OFF* on bills above ₹700\n\n🍦 *BONUS TREAT!*\nShare your experience by giving us a Google Review and get a *FREE ICE CREAM!* \n\n📍 *VISIT OUR OUTLETS*\n\n1️⃣ *TDG*\nShop 1 & 2, R.S.345/3, ECR Road, Vanur Taluk, Near Jamiyath Nagar, Kottakuppam, Tamil Nadu – 605104.\n\n2️⃣ *HOPE CAFÉ – WHITE TOWN*\n4, Rue Suffren Street, White Town, Puducherry – 605001.\n\n3️⃣ *HOPE CAFÉ – AUROVILLE*\nAuroville Road, Kuilapalayam, Bommayapalayam, Tamil Nadu – 605101.\n\n💰 *CLAIM YOUR ELIGIBLE BENEFITS THROUGH LOT MORE WINS!*\n\nDon't miss out on this exciting opportunity to enjoy more while spending less!\n\nThank you for your love and support. We look forward to serving you again!\n\n❤️ *LOT MORE WINS*\n*Eat More. Enjoy More. Win More!*\n\nWith Love,\n*TEAM LOT MORE WINS*";

/** Slot 0 is tonight (14 Nov); slots 1–10 are 15 Nov. */
export function offerPushSlot(slot: number): ScheduledGreeting | null {
  const s = Number.isInteger(slot) ? OFFER_PUSH_SLOTS[slot] : undefined;
  if (!s) return null;
  const at = Date.parse(`${s.at}:00+05:30`);
  return {
    marker: `offer-push-${s.at}`,
    title: s.title,
    body: s.body,
    detail: OFFER_DETAIL,
    sendFrom: new Date(at - 5 * 60_000).toISOString(),
    // A cron may fire late in its hour; the marker still keeps it to one send.
    sendUntil: new Date(at + 70 * 60_000).toISOString(),
  };
}
