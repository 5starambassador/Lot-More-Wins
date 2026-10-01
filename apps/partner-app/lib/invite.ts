import { Platform, Share as NativeShare } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

const LOGO = require('../assets/brand/logo.png');

/** The app logo as base64, read from the bundled asset. */
async function logoBase64(): Promise<string> {
  const asset = Asset.fromModule(LOGO);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export function inviteMessage(partnerName: string | null | undefined, downloadUrl: string | null | undefined): string {
  const lines = [
    `${partnerName ? `${partnerName} invites you` : 'You are invited'} to Lot More Wins!`,
    'Welcome to the Lot More Partner app: get a special discount on your first purchase, save on every visit to our outlets, and earn reward points whenever you shop or refer family and friends.',
    downloadUrl ? `Download the app and join now: ${downloadUrl}` : null,
  ];
  return lines.filter(Boolean).join('\n\n');
}

/**
 * Opens the share sheet with the welcome message, the app download link and the app logo.
 * If this build cannot attach images, the message is shared on its own.
 * Resolves false when the sheet was dismissed.
 */
export async function shareInvite(options: { partnerName?: string | null; downloadUrl?: string | null }): Promise<boolean> {
  const message = inviteMessage(options.partnerName, options.downloadUrl);
  const title = 'Join Lot More Wins';
  if (Platform.OS !== 'web') {
    try {
      // Loaded lazily: the module is native-only and must not be evaluated on web.
      const Share = (require('react-native-share') as typeof import('react-native-share')).default;
      const result = await Share.open({
        url: `data:image/png;base64,${await logoBase64()}`,
        type: 'image/png',
        filename: 'lot-more-wins',
        message,
        title,
        subject: title,
        failOnCancel: false,
        // Android: keep the temporary image in the app's own cache, which the library's file provider can serve.
        useInternalStorage: true,
      });
      return result.dismissedAction !== true;
    } catch (error) {
      console.warn('Image share unavailable, sharing the message only:', error);
    }
  }
  const result = await NativeShare.share({ message, title });
  return result.action !== NativeShare.dismissedAction;
}
