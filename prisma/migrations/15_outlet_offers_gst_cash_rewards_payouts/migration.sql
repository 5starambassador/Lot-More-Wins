-- Revised flow: per-outlet discounts, GST and cash reward; Achariya / Non-Achariya partners;
-- UPI ID; cash reward wallet with Finance payouts; outlet offer audit log.
-- Additive only: every new column is nullable or has a default that keeps today's behaviour
-- (GST 0, no outlet overrides, cash reward off, every partner Non-Achariya). Existing bills are
-- not rewritten: their new snapshot columns read as "no GST / no cash reward".

-- CreateEnum
CREATE TYPE "PartnerCategory" AS ENUM ('ACHARIYA', 'NON_ACHARIYA');

-- CreateEnum
CREATE TYPE "CashEntryType" AS ENUM ('PURCHASE', 'REFERRAL', 'PAYOUT');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutSource" AS ENUM ('WEEKLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "OfferChangeActor" AS ENUM ('SUPER_ADMIN', 'OUTLET_ADMIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'BILL_RECEIPT';
ALTER TYPE "NotificationType" ADD VALUE 'CASH_REWARD';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_PAID';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_FAILED';

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "cash_reward_purchase_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cash_reward_purchase_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cash_reward_referral_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cash_reward_referral_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "outlet_settings_version" TIMESTAMP(3),
ADD COLUMN     "partner_category" "PartnerCategory",
ADD COLUMN     "taxable_amount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "amount" DECIMAL(12,2),
ADD COLUMN     "payout_id" TEXT;

-- AlterTable
ALTER TABLE "outlets" ADD COLUMN     "achariya_first_time_discount" DECIMAL(5,2),
ADD COLUMN     "can_edit_offers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "first_time_discount" DECIMAL(5,2),
ADD COLUMN     "gives_cash_reward" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "offers_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "referral_discount" DECIMAL(5,2),
ADD COLUMN     "repeat_discount" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "category" "PartnerCategory" NOT NULL DEFAULT 'NON_ACHARIYA',
ADD COLUMN     "upi_id" TEXT;

-- AlterTable
ALTER TABLE "program_settings" ADD COLUMN     "achariya_first_time_discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "achariya_referral_points_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cash_reward_purchase_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cash_reward_referral_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payout_minimum_amount" DECIMAL(12,2) NOT NULL DEFAULT 100,
ADD COLUMN     "payout_weekday" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "redeem_qr_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekly_payout_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "cash_reward_entries" (
    "id" TEXT NOT NULL,
    "type" "CashEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "bill_id" TEXT,
    "payout_id" TEXT,
    "partner_id" TEXT,
    "customer_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_reward_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "payout_number" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "source" "PayoutSource" NOT NULL,
    "upi_id" TEXT NOT NULL,
    "week_key" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_amount" DECIMAL(12,2),
    "paid_on" DATE,
    "upi_txn_ref" TEXT,
    "failure_note" TEXT,
    "settled_at" TIMESTAMP(3),
    "upload_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_uploads" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_by_email" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "paid_count" INTEGER NOT NULL,
    "failed_count" INTEGER NOT NULL,
    "unchanged_count" INTEGER NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_offer_changes" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "actor_type" "OfferChangeActor" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_offer_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_reward_entries_payout_id_key" ON "cash_reward_entries"("payout_id");

-- CreateIndex
CREATE INDEX "cash_reward_entries_partner_id_created_at_idx" ON "cash_reward_entries"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_reward_entries_customer_id_partner_id_idx" ON "cash_reward_entries"("customer_id", "partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_reward_entries_bill_id_type_key" ON "cash_reward_entries"("bill_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_payout_number_key" ON "payouts"("payout_number");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_upi_txn_ref_key" ON "payouts"("upi_txn_ref");

-- CreateIndex
CREATE INDEX "payouts_partner_id_requested_at_idx" ON "payouts"("partner_id", "requested_at");

-- CreateIndex
CREATE INDEX "payouts_status_requested_at_idx" ON "payouts"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_partner_id_week_key_key" ON "payouts"("partner_id", "week_key");

-- CreateIndex
CREATE INDEX "payout_uploads_created_at_idx" ON "payout_uploads"("created_at");

-- CreateIndex
CREATE INDEX "outlet_offer_changes_outlet_id_created_at_idx" ON "outlet_offer_changes"("outlet_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reward_entries" ADD CONSTRAINT "cash_reward_entries_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reward_entries" ADD CONSTRAINT "cash_reward_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reward_entries" ADD CONSTRAINT "cash_reward_entries_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_reward_entries" ADD CONSTRAINT "cash_reward_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "payout_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_offer_changes" ADD CONSTRAINT "outlet_offer_changes_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The Achariya values start equal to today's single values, so classifying a partner changes
-- nothing until the Super Admin sets the Achariya percentages.
UPDATE "program_settings"
SET "achariya_first_time_discount" = "first_time_discount",
    "achariya_referral_points_percentage" = "referral_points_percentage";
