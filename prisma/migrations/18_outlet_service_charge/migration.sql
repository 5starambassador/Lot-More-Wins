-- Outlet service charge: a % of the discounted amount or a fixed ₹ per bill, added before GST.
-- 0 (the default) = no service charge, so existing outlets and bills are unchanged.
CREATE TYPE "ServiceChargeType" AS ENUM ('PERCENTAGE', 'FIXED');

ALTER TABLE "outlets"
    ADD COLUMN "service_charge_type" "ServiceChargeType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "service_charge_value" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "bills"
    ADD COLUMN "service_charge_type" "ServiceChargeType" NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN "service_charge_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN "service_charge_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
