-- The "new version" home popup only shows on Partner App versions older than this
-- (e.g. '1.1.0', the Play Store release). Null shows it on every version.
ALTER TABLE "program_settings" ADD COLUMN "latest_app_version" TEXT;
