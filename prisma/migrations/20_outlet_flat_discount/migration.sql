-- Outlet flat discount: an outlet may give its partner discounts as ₹ amounts instead of %.
-- PERCENTAGE (the default) keeps every existing outlet and bill exactly as before.
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

ALTER TABLE "outlets"
    ADD COLUMN "discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "flat_first_time_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "flat_repeat_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "flat_referral_discount" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "bills"
    ADD COLUMN "discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE';
