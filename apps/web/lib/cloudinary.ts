import crypto from 'crypto';
import { HttpError } from './auth';

/**
 * Cloudinary image storage for every upload (outlet logos and galleries from the Super Admin
 * panel and the Outlet Admin app, partner profile photos from the Partner app): they all go
 * through POST /api/media, which converts it to WebP under 1 MB (lib/image-engine), stores it
 * here and returns its https URL.
 *
 * Configured with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
 * (optional CLOUDINARY_FOLDER). While those still hold the demo placeholders from
 * .env.example, Cloudinary counts as not configured and /api/media keeps storing images in
 * the database, so uploads work before the real credentials are added.
 */

const UPLOAD_TIMEOUT_MS = 30_000;

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

const isPlaceholder = (value: string) => /^(demo|your)([_-]|$)/i.test(value);

export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '';
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? '';
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? '';
  if (!cloudName || !apiKey || !apiSecret) return null;
  if ([cloudName, apiKey, apiSecret].some(isPlaceholder)) return null;
  return { cloudName, apiKey, apiSecret, folder: process.env.CLOUDINARY_FOLDER?.trim() || 'lot-more-wins' };
}

/** Signed upload of one image; returns its public id and https URL. */
export async function uploadToCloudinary(
  config: CloudinaryConfig,
  image: { mimeType: string; data: Buffer }
): Promise<{ id: string; url: string }> {
  const timestamp = Math.floor(Date.now() / 1000);
  // Signature: the signed parameters in alphabetical order, joined as a query string, plus the secret.
  const signed = { folder: config.folder, timestamp: String(timestamp) };
  const toSign = Object.entries(signed)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(`${toSign}${config.apiSecret}`).digest('hex');

  const form = new FormData();
  form.set('file', `data:${image.mimeType};base64,${image.data.toString('base64')}`);
  form.set('api_key', config.apiKey);
  form.set('timestamp', signed.timestamp);
  form.set('folder', signed.folder);
  form.set('signature', signature);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('Cloudinary upload request failed:', error);
    throw new HttpError(502, 'The image could not be uploaded. Please try again.', 'UPLOAD_FAILED');
  }

  const body = (await res.json().catch(() => null)) as { public_id?: string; secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !body?.secure_url || !body.public_id) {
    console.error(`Cloudinary upload failed with HTTP ${res.status}:`, body?.error?.message ?? 'no error message');
    throw new HttpError(502, 'The image could not be uploaded. Please try again.', 'UPLOAD_FAILED');
  }
  return { id: body.public_id, url: body.secure_url };
}
