# Lot More Wins Partner App: landing page

React + Vite + Tailwind CSS. Two routes:

- `/` the product showcase (hero, how it works, how partners earn, screenshots, download QR)
- `/download` "How to install" guides for Android and iPhone, both installing the Partner App web version

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
| `VITE_PARTNER_WEB_URL` | Partner App web version that both install guides open. Defaults to `https://partner.lotmorewins.com`. |
| `VITE_SITE_URL` | Public address used inside the download QR. Defaults to the address being viewed. |

## Installing

`/download` offers no APK. Both buttons open a step-by-step guide for adding the Partner App web
version (`VITE_PARTNER_WEB_URL`) to the home screen, with an "Open the Partner App" button in the
first step: Chrome's Install app on Android, Safari's Share > Add to Home Screen on iPhone. The
visitor's own device opens its guide automatically, and `?platform=android` or `?platform=ios`
(used by the Partner App's install popup) opens that guide.

## Home-screen setup

The Partner App web version carries its own home-screen setup (`apps/partner-app/public`:
manifest, `apple-touch-icon.png`, standalone meta tags). This site only links to it and walks
the user through the install.

## Deploying

`vercel.json` is set up for a Vercel project whose root directory is `apps/landing-page`. It
rewrites unmatched paths to `index.html` so `/download` loads directly. `public/.htaccess` and
`public/_redirects` do the same on Apache and Netlify.
