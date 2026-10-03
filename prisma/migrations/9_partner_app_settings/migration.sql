-- Partner App settings controlled from the Super Admin panel.

-- How wallet values are shown in the Partner App.
CREATE TYPE "WalletDisplay" AS ENUM ('POINTS', 'RUPEES');

ALTER TABLE "program_settings"
    -- Image attached to the Partner App invite message (null = the app logo).
    ADD COLUMN "invite_image_url" TEXT,
    -- Show the "new version available" popup on the Partner App home page.
    ADD COLUMN "home_popup_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "wallet_display" "WalletDisplay" NOT NULL DEFAULT 'POINTS';
