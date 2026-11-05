const clean = (value: string | undefined) => value?.trim().replace(/\/+$/, '') || null;

/** The Partner App web version, installed to the iOS home screen from the download page. */
export const PARTNER_WEB_URL = clean(import.meta.env.VITE_PARTNER_WEB_URL) ?? 'https://partner.lotmorewins.com';

/** The Outlet Admin app's Google Play listing (package com.lotmorewins.outletadmin). */
export const OUTLET_PLAY_URL =
  clean(import.meta.env.VITE_OUTLET_PLAY_URL) ?? 'https://play.google.com/store/apps/details?id=com.lotmorewins.outletadmin';

/** Absolute address of the download page, for the QR code. */
export function downloadPageUrl(): string {
  const origin = clean(import.meta.env.VITE_SITE_URL) ?? window.location.origin;
  return `${origin}/download`;
}

/** Where the /diwali-launch QR code leads: always the live site, wherever the page is viewed. */
export const STUDENTS_DOWNLOAD_URL = 'https://lotmorewins.com/students-download';

export type Device ='ios' | 'android' | 'other';

export function detectDevice(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
