import { Linking } from 'react-native';
import type { Href, Router } from 'expo-router';

/**
 * Opens where a notification points: a web link in the browser, or a page of this app
 * ("/wallet", "/qr/discount", "/outlet/<id>"). Returns false when the link is not usable.
 */
export function openNotificationLink(router: Router, url: string | null | undefined): boolean {
  const link = url?.trim();
  if (!link) return false;
  if (/^https?:\/\//i.test(link)) {
    Linking.openURL(link).catch(() => {});
    return true;
  }
  if (link.startsWith('/') && !link.startsWith('//')) {
    router.push(link as Href);
    return true;
  }
  return false;
}
