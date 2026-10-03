import Constants from 'expo-constants';

/** This build's version ("version" in app.json, which is also the Android versionName). */
export const APP_VERSION = Constants.expoConfig?.version ?? '0';

/** Numeric, part by part: "1.0.9" < "1.1.0" < "1.10.0". Missing parts count as 0. */
export function isOlderVersion(installed: string, latest: string): boolean {
  const a = installed.split('.').map((n) => parseInt(n, 10) || 0);
  const b = latest.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}
