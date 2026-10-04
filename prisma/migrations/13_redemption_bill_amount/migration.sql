-- The customer's bill a wallet redemption was taken off. Null for redemptions made before
-- the Outlet Admin app asked for the bill amount.
ALTER TABLE "points_redemptions" ADD COLUMN "bill_amount" DECIMAL(12,2);
