const clean = (value: string | undefined) => value?.trim().replace(/\/+$/, '') || null;

/** The Partner App web version, installed to the iOS home screen from the download page. */
export const PARTNER_WEB_URL = clean(import.meta.env.VITE_PARTNER_WEB_URL);

/** Absolute address of the download page, for the QR code. */
export function downloadPageUrl(): string {
  const origin = clean(import.meta.env.VITE_SITE_URL) ?? window.location.origin;
  return `${origin}/download`;
}

export type Device = 'ios' | 'android' | 'other';

export function detectDevice(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
