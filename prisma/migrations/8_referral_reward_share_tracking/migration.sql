-- Programme discounts: 20% on the first purchase, 10% on repeat purchases and 10% for a
-- referred customer, for every partner. Applied to the saved settings and as column defaults.
ALTER TABLE "program_settings"
    ALTER COLUMN "first_time_discount" SET DEFAULT 20,
    ALTER COLUMN "repeat_discount" SET DEFAULT 10,
    ALTER COLUMN "referral_discount" SET DEFAULT 10,
    ADD COLUMN "referral_reward_goal" INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN "referral_reward_discount" DECIMAL(5,2) NOT NULL DEFAULT 20;

UPDATE "program_settings"
SET "first_time_discount" = 20,
    "repeat_discount" = 10,
    "referral_discount" = 10;

-- AlterTable: referral reward used on a bill
ALTER TABLE "bills"
    ADD COLUMN "referral_reward_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN "referral_reward_referrals" INTEGER NOT NULL DEFAULT 0;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_REWARD';

-- CreateTable
CREATE TABLE "referral_shares" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_shares_partner_id_created_at_idx" ON "referral_shares"("partner_id", "created_at");

-- AddForeignKey
ALTER TABLE "referral_shares" ADD CONSTRAINT "referral_shares_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
