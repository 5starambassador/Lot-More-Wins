-- Partner App download links per platform (Super Admin → Settings → App downloads).
-- DIRECT = an APK (Android) or the web app / a direct page (iOS); STORE = Play Store / App Store.
CREATE TYPE "AppLinkType" AS ENUM ('DIRECT', 'STORE');

ALTER TABLE "program_settings"
    ADD COLUMN "android_app_url" TEXT,
    ADD COLUMN "android_app_link_type" "AppLinkType" NOT NULL DEFAULT 'DIRECT',
    ADD COLUMN "ios_app_url" TEXT,
    ADD COLUMN "ios_app_link_type" "AppLinkType" NOT NULL DEFAULT 'DIRECT';
