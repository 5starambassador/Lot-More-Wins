import { Platform, Share as NativeShare, TurboModuleRegistry } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { qrToPngBase64 } from './qr-png';

/**
 * Download and share for the QR pages. The image is generated in JavaScript from the code
 * itself (lib/qr-png), never captured from the screen.
 */

export class QrExportError extends Error {}

async function writePng(code: string, fileName: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}${fileName}.png`;
  await FileSystem.writeAsStringAsync(uri, qrToPngBase64(code), { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

/** Android fallback: the system folder picker, which needs no storage permission. */
async function saveWithFolderPicker(code: string, fileName: string): Promise<boolean> {
  const { StorageAccessFramework } = FileSystem;
  const picked = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!picked.granted) return false;
  const target = await StorageAccessFramework.createFileAsync(picked.directoryUri, fileName, 'image/png');
  await FileSystem.writeAsStringAsync(target, qrToPngBase64(code), { encoding: FileSystem.EncodingType.Base64 });
  return true;
}

/**
 * Saves the QR as a PNG on the device. Returns where it went, or null when the user backed out.
 * Photos / Gallery first; on Android, if the gallery cannot be written to, the user picks a folder instead.
 */
export async function saveQrImage(code: string, fileName: string): Promise<'gallery' | 'folder' | null> {
  if (Platform.OS === 'web') throw new QrExportError('Saving the QR is available in the mobile app.');

  try {
    // Loaded lazily so a build without the media module still reaches the folder-picker fallback.
    const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
    // Android 13+ adds images to the gallery without any permission; older Android and iOS ask once.
    const needsPermission = Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) < 33);
    if (needsPermission) {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        throw new QrExportError('Allow access to your photos to save the QR code.');
      }
    }
    await MediaLibrary.saveToLibraryAsync(await writePng(code, fileName));
    return 'gallery';
  } catch (error) {
    if (Platform.OS !== 'android') {
      throw error instanceof QrExportError ? error : new QrExportError('We couldn’t save the QR code to your photos. Please try again.');
    }
    // Gallery unavailable (permission refused, or the media module is missing from this build).
    try {
      return (await saveWithFolderPicker(code, fileName)) ? 'folder' : null;
    } catch {
      throw new QrExportError('We couldn’t save the QR code. Please try again.');
    }
  }
}

/**
 * Opens the share sheet with the QR image and the message attached. If this build cannot
 * share images, the message (which carries the download link) is shared on its own.
 * Resolves false when the sheet was dismissed.
 */
export async function shareQrImage(code: string, options: { message: string; title: string; fileName: string }): Promise<boolean> {
  // react-native-share throws while loading in a build made without its native module, and
  // Metro reports that as a fatal error before any catch runs. Ask for the module first.
  if (Platform.OS !== 'web' && TurboModuleRegistry.get('RNShare')) {
    try {
      // Loaded lazily: the module is native-only and must not be evaluated on web.
      const Share = (require('react-native-share') as typeof import('react-native-share')).default;
      const result = await Share.open({
        url: `data:image/png;base64,${qrToPngBase64(code)}`,
        type: 'image/png',
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
