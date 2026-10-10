import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import apiClient from './api';
import { shareImage } from './share-image';

const LOGO = require('../assets/brand/logo.png');
const FILE_NAME = 'lot-more-wins-invite';

/**
 * Cloudinary images are stored as WebP, which chat apps such as WhatsApp treat as stickers;
 * ask Cloudinary for a JPEG copy so the invite arrives as a photo.
 */
function asJpeg(url: string): { url: string; mimeType: string } {
  const match = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/.exec(url);
  if (match) return { url: `${match[1]}f_jpg,q_90/${match[2]}`, mimeType: 'image/jpeg' };
  const ext = /\.(png|jpe?g|webp)(\?|$)/i.exec(url)?.[1]?.toLowerCase();
  return { url, mimeType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' };
}

async function webBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The Super Admin's invite image, downloaded as base64. */
async function remoteImage(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const { url, mimeType } = asJpeg(apiClient.resolveAssetUrl(imageUrl)!);
  if (Platform.OS === 'web') return { base64: await webBase64(url), mimeType };
  const target = `${FileSystem.cacheDirectory}${FILE_NAME}`;
  const download = await FileSystem.downloadAsync(url, target);
  if (download.status !== 200) throw new Error(`HTTP ${download.status}`);
  return { base64: await FileSystem.readAsStringAsync(download.uri, { encoding: FileSystem.EncodingType.Base64 }), mimeType };
}

/** The app logo as base64, read from the bundled asset. */
async function logoImage(): Promise<{ base64: string; mimeType: string }> {
  const asset = Asset.fromModule(LOGO);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') return { base64: await webBase64(uri), mimeType: 'image/png' };
  return { base64: await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }), mimeType: 'image/png' };
}

export function inviteMessage(partnerName: string | null | undefined, downloadUrl: string | null | undefined): string {
  const lines = [
    `${partnerName ? `${partnerName} invites you` : 'You are invited'} to Lot More Wins!`,
    'Welcome to the Lot More Partner app: get a special discount on your first purchase, save on every visit to our outlets, and earn reward points whenever you shop or refer family and friends.',
    downloadUrl ? `Download the app and join now: ${downloadUrl}` : null,
  ];
  return lines.filter(Boolean).join('\n\n');
}

export interface InviteImage {
  base64: string;
  mimeType: string;
}

/**
 * The invite image the Super Admin chose in Settings: the app logo when none is set, or when
 * it cannot be downloaded. The invite card loads it ahead of the tap (see shareInvite).
 */
export async function loadInviteImage(imageUrl: string | null | undefined): Promise<InviteImage> {
  try {
    return imageUrl ? await remoteImage(imageUrl) : await logoImage();
  } catch (error) {
    console.warn('Invite image unavailable, attaching the logo:', error);
    return logoImage();
  }
}

/**
 * Opens the share sheet with the welcome message, the app download link and the invite image.
 * Pass the preloaded image: on the web the share must start within the tap, before any
 * network wait. Resolves false when the sheet was dismissed.
 */
export async function shareInvite(options: {
  partnerName?: string | null;
  downloadUrl?: string | null;
  imageUrl?: string | null;
  image?: InviteImage;
}): Promise<boolean> {
  const image = options.image ?? (await loadInviteImage(options.imageUrl));
  return shareImage({
    ...image,
    fileName: FILE_NAME,
    message: inviteMessage(options.partnerName, options.downloadUrl),
    title: 'Join Lot More Wins',
  });
}
