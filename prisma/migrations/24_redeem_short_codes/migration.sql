-- Short text codes for redeem QRs, typed at the outlet in place of scanning.
CREATE TABLE "redeem_codes" (
    "code" TEXT NOT NULL,
    "qr_code" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redeem_codes_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "redeem_codes_expires_at_idx" ON "redeem_codes"("expires_at");
