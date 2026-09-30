import { NextRequest } from 'next/server';
import { mediaUploadSchema } from '@lotmorewins/validation';
import prisma from '@/lib/prisma';
import { HttpError, requireOutletAdmin, requireSuperAdmin } from '@/lib/auth';
import { fail, handleRouteError, ok, readJson, validationError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 3 * 1024 * 1024;

function matchesSignature(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

/** Outlet Admins upload from the app (Bearer); Super Admins from the web panel (cookie). */
async function requireUploader(req: NextRequest) {
  if (req.headers.get('authorization')?.startsWith('Bearer ')) {
    try {
      return await requireOutletAdmin(req);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
    }
  }
  return requireSuperAdmin(req);
}

/** POST /api/media — upload an outlet logo or gallery image (base64). Returns its URL. */
export async function POST(req: NextRequest) {
  try {
    await requireUploader(req);
    const parsed = mediaUploadSchema.safeParse(await readJson(req));
    if (!parsed.success) return validationError(parsed.error);

    const data = Buffer.from(parsed.data.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (data.length === 0 || data.length > MAX_BYTES) {
      return fail(413, 'Image must be smaller than 3 MB', 'TOO_LARGE');
    }
    if (!matchesSignature(parsed.data.mimeType, data)) {
      return fail(415, 'File content does not match the declared image type', 'UNSUPPORTED_MEDIA');
    }

    const asset = await prisma.mediaAsset.create({
      data: { mimeType: parsed.data.mimeType, data, sizeBytes: data.length },
      select: { id: true },
    });
    return ok({ id: asset.id, url: `/api/media/${asset.id}` }, 201);
  } catch (error) {
    return handleRouteError(error, 'POST /api/media');
  }
}
