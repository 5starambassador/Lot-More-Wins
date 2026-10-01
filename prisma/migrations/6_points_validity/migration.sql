-- AlterTable
ALTER TABLE "program_settings"
    ADD COLUMN "purchase_points_validity_days" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "referral_points_validity_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "points_entries" ADD COLUMN "expires_at" TIMESTAMP(3);
