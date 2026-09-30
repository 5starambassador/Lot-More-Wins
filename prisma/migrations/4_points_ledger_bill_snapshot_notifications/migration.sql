-- CreateEnum
CREATE TYPE "PointsEntryType" AS ENUM ('PURCHASE', 'REFERRAL');

-- CreateEnum
CREATE TYPE "BillNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "notification_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notification_channel" "MessagingChannel",
ADD COLUMN     "notification_error" TEXT,
ADD COLUMN     "notification_recipient" TEXT,
ADD COLUMN     "notification_sent_at" TIMESTAMP(3),
ADD COLUMN     "notification_status" "BillNotificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "points_basis" "PointsBasis" NOT NULL DEFAULT 'PAYABLE_AMOUNT',
ADD COLUMN     "points_ratio_points" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "points_ratio_rupees" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purchase_points" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purchase_points_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "referral_points" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "referral_points_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "settings_version" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "partner_id" TEXT;

-- CreateTable
CREATE TABLE "points_entries" (
    "id" TEXT NOT NULL,
    "type" "PointsEntryType" NOT NULL,
    "points" DECIMAL(14,2) NOT NULL,
    "bill_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "customer_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "points_entries_partner_id_created_at_idx" ON "points_entries"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "points_entries_customer_id_partner_id_idx" ON "points_entries"("customer_id", "partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_entries_bill_id_type_key" ON "points_entries"("bill_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "customers_partner_id_key" ON "customers"("partner_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_entries" ADD CONSTRAINT "points_entries_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_entries" ADD CONSTRAINT "points_entries_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_entries" ADD CONSTRAINT "points_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: bills created before bill messaging existed were never messaged.
UPDATE "bills" SET "notification_status" = 'SKIPPED';

-- Backfill: link existing customers to the partner registered with the same mobile.
UPDATE "customers" c SET "partner_id" = p."id" FROM "partners" p WHERE p."mobile" = c."mobile";
