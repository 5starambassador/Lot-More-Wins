import sharp, { type Metadata } from 'sharp';
import { HttpError } from './auth';

/**
 * Image engine: every upload is converted to WebP and brought under 1 MB before it is stored
 * (Cloudinary, or the database fallback), so the apps and the panel all serve light images.
 *
 * Quality comes first: the image is encoded at high quality and only stepped down while it is
 * still over the limit; if even the lowest allowed quality is too big, the dimensions shrink
 * instead, so small images keep their full resolution and quality.
 */

export const MAX_STORED_BYTES = 1024 * 1024;

/** Longest side kept; larger photos are scaled down first (more than any screen in the apps shows). */
const MAX_DIMENSION = 2560;
const QUALITY_STEPS = [90, 85, 80, 75];
const SHRINK_FACTOR = 0.85;
const MIN_DIMENSION = 320;

export interface ProcessedImage {
  mimeType: 'image/webp';
  data: Buffer;
  width: number;
  height: number;
}

async function encode(input: Buffer, width: number, quality: number) {
  const { data, info } = await sharp(input)
    .rotate() // apply the EXIF orientation from phone cameras before it is stripped
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function toOptimizedWebp(input: Buffer): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new HttpError(415, 'The file is not a readable image', 'UNSUPPORTED_MEDIA');
  }
  if (!meta.width || !meta.height) throw new HttpError(415, 'The file is not a readable image', 'UNSUPPORTED_MEDIA');

  // Width that makes the longest side MAX_DIMENSION at most (EXIF rotations 5-8 swap the sides).
  const rotated = (meta.orientation ?? 1) >= 5;
  const [w, h] = rotated ? [meta.height, meta.width] : [meta.width, meta.height];
  let width = Math.min(w, Math.round((w / Math.max(w, h)) * MAX_DIMENSION));

  for (;;) {
    let size = 0;
    for (const quality of QUALITY_STEPS) {
      const out = await encode(input, width, quality);
      if (out.data.length <= MAX_STORED_BYTES) return { mimeType: 'image/webp', ...out };
      size = out.data.length;
      // Lower quality saves well under half; far over the limit, go straight to resizing.
      if (size > MAX_STORED_BYTES * 1.8) break;
    }
    // File size follows pixel count, so jump close to the width that fits, then refine.
    const next = Math.round(width * Math.min(SHRINK_FACTOR, Math.sqrt(MAX_STORED_BYTES / size) * 0.95));
    if (next < MIN_DIMENSION) break;
    width = next;
  }
  throw new HttpError(413, 'The image could not be reduced below 1 MB', 'TOO_LARGE');
}
