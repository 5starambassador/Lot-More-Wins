-- One wallet, redeem bills and partner-to-partner transfers (schema only; data moves in 17).

-- Bills paid partly from the wallet with a redeem QR.
ALTER TYPE "BillTransactionType" ADD VALUE 'WALLET_REDEEM';

-- Wallet ledger entries that are not purchase / referral points.
ALTER TYPE "PointsEntryType" ADD VALUE 'CASHBACK_PURCHASE';
ALTER TYPE "PointsEntryType" ADD VALUE 'CASHBACK_REFERRAL';
ALTER TYPE "PointsEntryType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "PointsEntryType" ADD VALUE 'CASH_WALLET_MERGE';

ALTER TYPE "NotificationType" ADD VALUE 'WALLET_TRANSFER_IN';
ALTER TYPE "NotificationType" ADD VALUE 'WALLET_TRANSFER_OUT';

-- Pending UPI payouts are cancelled when payouts end (17).
ALTER TYPE "PayoutStatus" ADD VALUE 'CANCELLED';

-- Per-outlet reward overrides; null = the programme setting.
ALTER TABLE "outlets"
    ADD COLUMN "purchase_points_percentage" DECIMAL(5,2),
    ADD COLUMN "referral_points_percentage" DECIMAL(5,2),
    ADD COLUMN "achariya_referral_points_percentage" DECIMAL(5,2),
    ADD COLUMN "cash_reward_purchase_percentage" DECIMAL(5,2),
    ADD COLUMN "cash_reward_referral_percentage" DECIMAL(5,2);

-- Redeem bills have no permanent QR, and record the wallet part of the payment.
ALTER TABLE "bills"
    ALTER COLUMN "qr_code_id" DROP NOT NULL,
    ADD COLUMN "wallet_redeem_points" DECIMAL(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN "wallet_redeem_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- A redemption now belongs to the redeem bill it paid part of.
ALTER TABLE "points_redemptions" ADD COLUMN "bill_id" TEXT;
CREATE UNIQUE INDEX "points_redemptions_bill_id_key" ON "points_redemptions"("bill_id");
ALTER TABLE "points_redemptions" ADD CONSTRAINT "points_redemptions_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partner-to-partner wallet transfers.
CREATE TABLE "wallet_transfers" (
    "id" TEXT NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "from_partner_id" TEXT NOT NULL,
    "to_partner_id" TEXT NOT NULL,
    "points" DECIMAL(14,2) NOT NULL,
    "rupee_value" DECIMAL(12,2) NOT NULL,
    "points_ratio_points" DECIMAL(12,2) NOT NULL,
    "points_ratio_rupees" DECIMAL(12,2) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wallet_transfers_transfer_number_key" ON "wallet_transfers"("transfer_number");
CREATE UNIQUE INDEX "wallet_transfers_from_partner_id_idempotency_key_key" ON "wallet_transfers"("from_partner_id", "idempotency_key");
CREATE INDEX "wallet_transfers_from_partner_id_created_at_idx" ON "wallet_transfers"("from_partner_id", "created_at");
CREATE INDEX "wallet_transfers_to_partner_id_created_at_idx" ON "wallet_transfers"("to_partner_id", "created_at");
ALTER TABLE "wallet_transfers" ADD CONSTRAINT "wallet_transfers_from_partner_id_fkey" FOREIGN KEY ("from_partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_transfers" ADD CONSTRAINT "wallet_transfers_to_partner_id_fkey" FOREIGN KEY ("to_partner_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Wallet entries without a bill (received transfers, the merged cash balance).
ALTER TABLE "points_entries"
    ALTER COLUMN "bill_id" DROP NOT NULL,
    ADD COLUMN "transfer_id" TEXT;
CREATE UNIQUE INDEX "points_entries_transfer_id_key" ON "points_entries"("transfer_id");
ALTER TABLE "points_entries" ADD CONSTRAINT "points_entries_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "wallet_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
