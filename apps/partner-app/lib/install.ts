import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Installing the Partner App web version (partner.lotmorewins.com) to the home screen.
 * Web only: in the native app every value here reports "nothing to offer".
 *
 * - Android / desktop Chrome: the browser's own install prompt (beforeinstallprompt, kept by
 *   public/index.html until it is needed). Without one, Android gets the download page's guide.
 * - iPhone / iPad: Safari has no install prompt, so the download page's Add to Home Screen guide.
 */

/** The landing site's download page: a step-by-step home-screen install guide for each platform. */
export const DOWNLOAD_PAGE_URL = (process.env.EXPO_PUBLIC_DOWNLOAD_PAGE_URL || 'https://lotmorewins.com/download').replace(/\/+$/, '');

export type InstallDevice = 'ios' | 'android' | 'other';

/** Chrome's install prompt; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  prompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}

declare global {
  interface Window {
    __lmwInstall?: InstallState;
  }
  interface Navigator {
    /** iOS Safari: true when opened from the home screen. */
    standalone?: boolean;
  }
}

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const CHANGE_EVENT = 'lmw-install-change';
const INSTALLED_KEY = 'lmw-install:installed';
const DISMISSED_KEY = 'lmw-install:dismissed-at';
/** A closed popup stays away this long, then offers the install once more. */
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

// Closed in this visit: stays hidden while moving between Welcome and Home, even without storage.
let dismissedThisVisit = false;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or blocked storage: the in-memory flag still covers this visit.
  }
}

export function detectInstallDevice(): InstallDevice {
  if (!isWeb) return 'other';
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** Running as the installed app (home screen / app window) rather than in a browser tab. */
export function isStandalone(): boolean {
  if (!isWeb) return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function wasDismissed(): boolean {
  if (dismissedThisVisit) return true;
  const at = Number(readStorage(DISMISSED_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_FOR_MS;
}

function wasInstalled(): boolean {
  return window.__lmwInstall?.installed === true || readStorage(INSTALLED_KEY) === '1';
}

function snapshot() {
  const device = detectInstallDevice();
  const canPrompt = !!window.__lmwInstall?.prompt;
  const hidden = isStandalone() || wasInstalled() || wasDismissed();
  // Android always has the download page to fall back on; iOS always has the guide; a desktop
  // browser only when it offers its own install.
  const offer = !hidden && (device !== 'other' || canPrompt);
  return { device, canPrompt, visible: offer };
}

export type InstallOutcome = 'prompted' | 'download-page';

/** The install popup's state and actions. `visible` is always false outside the web version. */
export function useInstallPrompt() {
  const [state, setState] = useState(() => (isWeb ? snapshot() : { device: 'other' as InstallDevice, canPrompt: false, visible: false }));

  useEffect(() => {
    if (!isWeb) return;
    const refresh = () => {
      if (window.__lmwInstall?.installed) writeStorage(INSTALLED_KEY, '1');
      setState(snapshot());
    };
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    // Opening the installed app from this tab's window switches the display mode.
    const standalone = window.matchMedia?.('(display-mode: standalone)');
    standalone?.addEventListener?.('change', refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      standalone?.removeEventListener?.('change', refresh);
    };
  }, []);

  const dismiss = useCallback(() => {
    if (!isWeb) return;
    dismissedThisVisit = true;
    writeStorage(DISMISSED_KEY, String(Date.now()));
    setState(snapshot());
  }, []);

  /** Android / desktop: the browser's prompt when it has one; otherwise the download page. */
  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!isWeb) return 'download-page';
    const holder = window.__lmwInstall;
    const prompt = holder?.prompt;
    if (prompt && state.device !== 'ios') {
      // A prompt can only be shown once; Chrome fires a fresh event if it may be offered again.
      if (holder) holder.prompt = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') {
          writeStorage(INSTALLED_KEY, '1');
        } else {
          dismissedThisVisit = true;
        }
      } catch {
        openDownloadPage(state.device);
        return 'download-page';
      }
      setState(snapshot());
      return 'prompted';
    }
    openDownloadPage(state.device);
    return 'download-page';
  }, [state.device]);

  return { ...state, install, dismiss };
}

/** Opens the download page's install guide for this device in a new tab, so this tab stays where it was. */
export function openDownloadPage(device: InstallDevice) {
  if (!isWeb) return;
  const url = `${DOWNLOAD_PAGE_URL}?platform=${device === 'ios' ? 'ios' : 'android'}`;
  // Not the 'noopener' feature: with it window.open always returns null, hiding a blocked tab.
  const opened = window.open(url, '_blank');
  if (opened) opened.opener = null;
  // A popup blocker refused the new tab: go there in this one.
  else window.location.href = url;
}
