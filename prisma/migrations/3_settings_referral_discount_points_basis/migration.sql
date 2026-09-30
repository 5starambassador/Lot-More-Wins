-- CreateEnum
CREATE TYPE "PointsBasis" AS ENUM ('BILL_AMOUNT', 'PAYABLE_AMOUNT');

-- AlterTable
ALTER TABLE "program_settings"
    ADD COLUMN "referral_discount_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN "referral_discount_non_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN "points_basis" "PointsBasis" NOT NULL DEFAULT 'PAYABLE_AMOUNT',
    ADD COLUMN "app_download_url" TEXT;
