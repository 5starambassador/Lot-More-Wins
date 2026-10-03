import { Platform, Share as NativeShare, TurboModuleRegistry } from 'react-native';

/**
 * Opens the share sheet with an image and a message together: react-native-share in the app,
 * the browser's file sharing (Web Share API) on the web version. Where images cannot be
 * shared, the message (which carries the download link) goes out on its own.
 * Resolves false when the sheet was dismissed.
 */

export interface ShareImageOptions {
  base64: string;
  mimeType: string;
  /** Without extension. */
  fileName: string;
  message: string;
  title: string;
}

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

interface WebNavigator {
  canShare?: (data: { files: unknown[] }) => boolean;
  share?: (data: { files?: unknown[]; text?: string; title?: string }) => Promise<void>;
}

/** Decoded without awaiting anything, so the caller stays inside the user's tap (see shareOnWeb). */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Browsers only allow sharing files during the tap that asked for it (Safari is strict about
 * this), so nothing here may wait on the network: the image must already be loaded, and
 * navigator.share is reached without any await.
 */
async function shareOnWeb(options: ShareImageOptions): Promise<boolean | null> {
  const nav = (globalThis as { navigator?: WebNavigator }).navigator;
  if (!nav?.share || !nav.canShare) return null;
  const blob = base64ToBlob(options.base64, options.mimeType);
  const file = new File([blob], `${options.fileName}.${EXTENSIONS[options.mimeType] ?? 'png'}`, { type: options.mimeType });
  if (!nav.canShare({ files: [file] })) return null;
  try {
    await nav.share({ files: [file], text: options.message, title: options.title });
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return false;
    throw error;
  }
}

export async function shareImage(options: ShareImageOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const shared = await shareOnWeb(options);
      if (shared !== null) return shared;
    } catch (error) {
      console.warn('Image share unavailable, sharing the message only:', error);
    }
  } else if (TurboModuleRegistry.get('RNShare')) {
    // react-native-share throws while loading in a build made without its native module, and
    // Metro reports that as a fatal error before any catch runs. Ask for the module first.
    try {
      // Loaded lazily: the module is native-only and must not be evaluated on web.
      const Share = (require('react-native-share') as typeof import('react-native-share')).default;
      const result = await Share.open({
        url: `data:${options.mimeType};base64,${options.base64}`,
        type: options.mimeType,
        filename: options.fileName,
        message: options.message,
        title: options.title,
        subject: options.title,
        failOnCancel: false,
        // Android: keep the temporary image in the app's own cache, which the library's file
        // provider can serve. Its default (external cache) is outside the provider's paths.
        useInternalStorage: true,
      });
      return result.dismissedAction !== true;
    } catch (error) {
      console.warn('Image share unavailable, sharing the message only:', error);
    }
  }
  const result = await NativeShare.share({ message: options.message, title: options.title });
  return result.action !== NativeShare.dismissedAction;
}
