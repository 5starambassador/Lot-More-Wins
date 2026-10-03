# Lot More Wins Partner App: landing page

React + Vite + Tailwind CSS. Two routes:

- `/` the product showcase (hero, how it works, how partners earn, screenshots, download QR)
- `/download` Android APK download and the iPhone "Add to Home Screen" guide

## Commands

```
pnpm dev:landing                                   # from the repo root, http://localhost:3100
pnpm --filter @lotmorewins/landing-page build
pnpm --filter @lotmorewins/landing-page typecheck
pnpm --filter @lotmorewins/landing-page sync:apk   # copy the release APK into public/
```

## Configuration

Copy `.env.example` to `.env.local`, or set the same variables in the Vercel project.

| Variable | Purpose |
| --- | --- |
| `VITE_PARTNER_WEB_URL` | Partner App web version. "Download for iOS" sends people here to add it to their home screen. Required. |
| `VITE_ANDROID_APK_URL` | Where the APK is hosted. Defaults to `/lot-more-wins-partner.apk` on this site. |
| `VITE_SITE_URL` | Public address used inside the download QR. Defaults to the address being viewed. |

## Android APK

`sync:apk` copies `apps/partner-app/android/app/build/outputs/apk/release/app-release.apk` to
`public/lot-more-wins-partner.apk`. The current build is about 128 MB, which is over GitHub's
100 MB per-file limit, so the file is git-ignored. To ship it, either host the APK elsewhere and
set `VITE_ANDROID_APK_URL`, or track it with Git LFS and remove the ignore rule.

## iPhone install

The Partner App web version carries its own home-screen setup (`apps/partner-app/public`:
manifest, `apple-touch-icon.png`, standalone meta tags). This site only links to it and walks
the user through Safari's Share > Add to Home Screen.

## Deploying

`vercel.json` is set up for a Vercel project whose root directory is `apps/landing-page`. It
rewrites extensionless paths to `index.html` so `/download` loads directly, and serves `.apk`
files as attachments.
