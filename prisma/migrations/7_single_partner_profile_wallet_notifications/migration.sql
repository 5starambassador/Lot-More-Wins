-- Single partner role: the Achariya / Non-Achariya classification is removed.
-- Each programme percentage becomes one value; the former Non-Achariya value is kept.

-- AlterTable: program_settings
ALTER TABLE "program_settings" RENAME COLUMN "first_time_discount_non_achariya" TO "first_time_discount";
ALTER TABLE "program_settings" RENAME COLUMN "repeat_discount_non_achariya" TO "repeat_discount";
ALTER TABLE "program_settings" RENAME COLUMN "referral_discount_non_achariya" TO "referral_discount";
ALTER TABLE "program_settings" RENAME COLUMN "referral_points_non_achariya" TO "referral_points_percentage";
ALTER TABLE "program_settings"
    DROP COLUMN "first_time_discount_achariya",
    DROP COLUMN "repeat_discount_achariya",
    DROP COLUMN "referral_discount_achariya",
    DROP COLUMN "referral_points_achariya",
    ADD COLUMN "birthday_bonus_discount" DECIMAL(5,2) NOT NULL DEFAULT 5;

-- AlterTable: partners
ALTER TABLE "partners" DROP CONSTRAINT "partners_employee_id_fkey";
ALTER TABLE "partners" DROP CONSTRAINT "partners_admission_number_fkey";
ALTER TABLE "partners"
    DROP COLUMN "is_achariya_associated",
    DROP COLUMN "role",
    DROP COLUMN "employee_id",
    DROP COLUMN "admission_number",
    ADD COLUMN "city" TEXT,
    ADD COLUMN "state" TEXT,
    ADD COLUMN "pincode" TEXT,
    ADD COLUMN "date_of_birth" DATE,
    ADD COLUMN "dob_changed_at" TIMESTAMP(3),
    ADD COLUMN "photo_url" TEXT;

-- DropTable
DROP TABLE "achariya_employees";
DROP TABLE "achariya_students";

-- DropEnum
DROP TYPE "PartnerRole";
DROP TYPE "AchariyaRole";

-- AlterTable: outlets
ALTER TABLE "outlets"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "address" TEXT,
    ADD COLUMN "map_url" TEXT;

-- AlterTable: bills / points_entries
ALTER TABLE "bills" ADD COLUMN "birthday_bonus_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "points_entries" ADD COLUMN "redeemed_points" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PURCHASE_POINTS', 'REFERRAL_POINTS', 'POINTS_CLAIMED', 'POINTS_REDEEMED');

-- CreateTable
CREATE TABLE "points_redemptions" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "created_by_admin_id" TEXT NOT NULL,
    "points" DECIMAL(14,2) NOT NULL,
    "rupee_value" DECIMAL(12,2) NOT NULL,
    "points_ratio_points" DECIMAL(12,2) NOT NULL,
    "points_ratio_rupees" DECIMAL(12,2) NOT NULL,
    "token_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "points" DECIMAL(14,2),
    "expires_at" TIMESTAMP(3),
    "bill_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "points_redemptions_token_id_key" ON "points_redemptions"("token_id");

-- CreateIndex
CREATE INDEX "points_redemptions_partner_id_created_at_idx" ON "points_redemptions"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "points_redemptions_outlet_id_created_at_idx" ON "points_redemptions"("outlet_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_partner_id_created_at_idx" ON "notifications"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_bill_id_idx" ON "notifications"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");

-- CreateIndex
CREATE INDEX "push_devices_partner_id_idx" ON "push_devices"("partner_id");

-- AddForeignKey
ALTER TABLE "points_redemptions" ADD CONSTRAINT "points_redemptions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_redemptions" ADD CONSTRAINT "points_redemptions_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_redemptions" ADD CONSTRAINT "points_redemptions_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "outlet_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
