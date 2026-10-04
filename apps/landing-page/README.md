# Lot More Wins Partner App: landing page

React + Vite + Tailwind CSS. Two routes:

- `/` the product showcase (hero, how it works, how partners earn, screenshots, download QR)
- `/download` the Android download and the iPhone install (App Store or "Add to Home Screen" guide)

## Commands

```
pnpm dev:landing                                   # from the repo root, http://localhost:3100
pnpm --filter @lotmorewins/landing-page build
pnpm --filter @lotmorewins/landing-page typecheck
```

## Configuration

Copy `.env.example` to `.env.local`, or set the same variables in the Vercel project.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Lot More Wins API, where the download links are read from (`/app-links`). Defaults to `https://superadmin.lotmorewins.com/api`. |
| `VITE_PARTNER_WEB_URL` | Partner App web version. Used for "Download for iOS" when no iOS link is set in the panel. |
| `VITE_SITE_URL` | Public address used inside the download QR. Defaults to the address being viewed. |

## Download links

The download links are managed in the Super Admin panel under **Settings → App downloads**: one
link per platform, each marked as a direct link (APK / web app) or a store listing (Google Play /
App Store). `/download` reads them from the API every time it opens.

- **Android** uses exactly that link. No APK is bundled with this site. While the link loads the
  button waits; if the request fails, the page shows an error with a "Try again" button, and if no
  Android link is set it says the Android app is coming soon.
- **iOS** uses the panel's link, or `VITE_PARTNER_WEB_URL` when none is set. A direct link shows
  the "Add to Home Screen" guide; an App Store link opens the store.

Host the APK somewhere that can serve large files (GitHub's 100 MB limit rules out committing it)
and paste its address into the panel.

## iPhone install

The Partner App web version carries its own home-screen setup (`apps/partner-app/public`:
manifest, `apple-touch-icon.png`, standalone meta tags). This site only links to it and walks
the user through Safari's Share > Add to Home Screen.

## Deploying

`vercel.json` is set up for a Vercel project whose root directory is `apps/landing-page`. It
rewrites unmatched paths to `index.html` so `/download` loads directly. `public/.htaccess` and
`public/_redirects` do the same on Apache and Netlify.
