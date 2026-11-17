-- Per-outlet maximum wallet redemption (a % of the bill or a flat ₹; 50% = the old fixed rule)
-- and the per-outlet first referral bonus (₹ amount + % of the bill; both 0 = off).
ALTER TABLE "outlets"
    ADD COLUMN "wallet_redeem_cap_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "wallet_redeem_cap_value" DECIMAL(10,2) NOT NULL DEFAULT 50,
    ADD COLUMN "first_referral_bonus_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "first_referral_bonus_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "bills"
    ADD COLUMN "first_referral_bonus_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "first_referral_bonus" BOOLEAN NOT NULL DEFAULT false;
