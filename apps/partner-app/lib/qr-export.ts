import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import type { QRCodeType } from '@lotmorewins/types';
import apiClient from './api';
import { qrToPngBase64 } from './qr-png';
import { base64ToBlob, shareImage } from './share-image';

/**
 * Download and share for the QR pages. The image is the branded QR card drawn by the server
 * (logo, title, QR and code on the app's red gradient). When it cannot be fetched (offline),
 * a plain QR generated on the device (lib/qr-png) is used instead, so saving still works.
 */

export class QrExportError extends Error {}

export interface QrImageSource {
  type: QRCodeType;
  code: string;
  /** Without extension. */
  fileName: string;
}

/** The branded card, or the plain QR when it cannot be fetched. QR pages prefetch it (see useQrCard). */
export async function qrImageBase64(source: QrImageSource): Promise<string> {
  try {
    return (await apiClient.getPartnerQrCard(source.type)).data.base64;
  } catch (error) {
    console.warn('QR card unavailable, using the plain QR:', error);
    return qrToPngBase64(source.code);
  }
}

async function writePng(base64: string, fileName: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}${fileName}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

/** Android fallback: the system folder picker, which needs no storage permission. */
async function saveWithFolderPicker(base64: string, fileName: string): Promise<boolean> {
  const { StorageAccessFramework } = FileSystem;
  const picked = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!picked.granted) return false;
  const target = await StorageAccessFramework.createFileAsync(picked.directoryUri, fileName, 'image/png');
  await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
  return true;
}

/** Web: the browser's own download of the PNG. */
function downloadOnWeb(base64: string, fileName: string) {
  const blob = base64ToBlob(base64, 'image/png');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Saves the QR card as a PNG. Returns where it went, or null when the user backed out.
 * Photos / Gallery first; on Android, if the gallery cannot be written to, the user picks a
 * folder instead. On the web version the browser downloads it.
 */
export async function saveQrImage(source: QrImageSource, prefetched?: string): Promise<'gallery' | 'folder' | 'download' | null> {
  const base64 = prefetched ?? (await qrImageBase64(source));

  if (Platform.OS === 'web') {
    try {
      downloadOnWeb(base64, source.fileName);
      return 'download';
    } catch {
      throw new QrExportError('We couldn’t download the QR code. Please try again.');
    }
  }

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
    await MediaLibrary.saveToLibraryAsync(await writePng(base64, source.fileName));
    return 'gallery';
  } catch (error) {
    if (Platform.OS !== 'android') {
      throw error instanceof QrExportError ? error : new QrExportError('We couldn’t save the QR code to your photos. Please try again.');
    }
    // Gallery unavailable (permission refused, or the media module is missing from this build).
    try {
      return (await saveWithFolderPicker(base64, source.fileName)) ? 'folder' : null;
    } catch {
      throw new QrExportError('We couldn’t save the QR code. Please try again.');
    }
  }
}

/**
 * Opens the share sheet with the QR card and the message attached. Pass the prefetched card:
 * on the web the share must start within the tap, before any network wait.
 * Resolves false when the sheet was dismissed.
 */
export async function shareQrImage(
  source: QrImageSource,
  options: { message: string; title: string },
  prefetched?: string
): Promise<boolean> {
  const base64 = prefetched ?? (await qrImageBase64(source));
  return shareImage({ base64, mimeType: 'image/png', fileName: source.fileName, message: options.message, title: options.title });
}
