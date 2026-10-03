import { NextResponse } from 'next/server';
import { appDownloadLinks, getProgramSettings } from '@/lib/settings';
import { handleRouteError, ok } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** Public and read-only, so any site may fetch it: the landing page's download buttons live elsewhere. */
function withPublicCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
  return res;
}

/**
 * GET /api/app-links — the Partner App download links for Android and iOS, and whether each is
 * a direct link (APK / web app) or a store listing. Set in Super Admin → Settings → App downloads.
 */
export async function GET() {
  try {
    return withPublicCors(ok(appDownloadLinks(await getProgramSettings())));
  } catch (error) {
    return withPublicCors(handleRouteError(error, 'GET /api/app-links'));
  }
}
