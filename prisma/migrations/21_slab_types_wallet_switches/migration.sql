-- Per-slab % or flat ₹ (replaces the one outlet-wide discount type of migration 20), the outlet's
-- minimum bill for a discount, the outlet's wallet redemption switch and the programme-wide wallet switch.
ALTER TABLE "outlets"
    ADD COLUMN "first_time_discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "repeat_discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "referral_discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "purchase_points_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "referral_points_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "cash_reward_purchase_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "cash_reward_referral_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "flat_purchase_points" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "flat_referral_points" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "flat_cash_reward_purchase" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "flat_cash_reward_referral" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "min_bill_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "wallet_redemption_enabled" BOOLEAN NOT NULL DEFAULT true;

-- An outlet that was flat for every discount stays flat for each discount slab.
UPDATE "outlets"
SET "first_time_discount_type" = "discount_type",
    "repeat_discount_type" = "discount_type",
    "referral_discount_type" = "discount_type";

ALTER TABLE "outlets" DROP COLUMN "discount_type";

ALTER TABLE "bills" ADD COLUMN "below_minimum_bill" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "program_settings" ADD COLUMN "wallet_enabled" BOOLEAN NOT NULL DEFAULT true;
