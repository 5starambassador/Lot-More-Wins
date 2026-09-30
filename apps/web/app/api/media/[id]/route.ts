import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fail, handleRouteError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

/** GET /api/media/:id — serve an uploaded outlet image. Assets are immutable. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return fail(404, 'Not found', 'NOT_FOUND');
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return fail(404, 'Not found', 'NOT_FOUND');

    return new NextResponse(new Uint8Array(asset.data), {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(asset.sizeBytes),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/media/:id');
  }
}
