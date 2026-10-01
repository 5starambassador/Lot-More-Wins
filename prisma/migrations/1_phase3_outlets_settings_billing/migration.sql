npx expo start -c --port 8081-- CreateEnum
CREATE TYPE "MessagingChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "OutletStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BillTransactionType" AS ENUM ('DIRECT_PARTNER', 'REFERRAL');

-- CreateTable
CREATE TABLE "super_admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_settings" (
    "id" TEXT NOT NULL DEFAULT 'GLOBAL',
    "messaging_mode" "MessagingChannel" NOT NULL,
    "first_time_discount_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "first_time_discount_non_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "repeat_discount_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "repeat_discount_non_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "points_ratio_points" DECIMAL(12,2) NOT NULL DEFAULT 10,
    "points_ratio_rupees" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "referral_points_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "referral_points_non_achariya" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "purchase_points_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "logo_url" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "OutletStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_admins" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlet_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "qr_code_id" TEXT NOT NULL,
    "transaction_type" "BillTransactionType" NOT NULL,
    "partner_id" TEXT,
    "referrer_partner_id" TEXT,
    "customer_id" TEXT,
    "is_first_time" BOOLEAN NOT NULL,
    "bill_amount" DECIMAL(12,2) NOT NULL,
    "discount_percentage" DECIMAL(5,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_by_admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE INDEX "outlets_status_idx" ON "outlets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_admins_email_key" ON "outlet_admins"("email");

-- CreateIndex
CREATE INDEX "outlet_admins_outlet_id_idx" ON "outlet_admins"("outlet_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_mobile_key" ON "customers"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "bills_bill_number_key" ON "bills"("bill_number");

-- CreateIndex
CREATE INDEX "bills_outlet_id_created_at_idx" ON "bills"("outlet_id", "created_at");

-- CreateIndex
CREATE INDEX "bills_partner_id_idx" ON "bills"("partner_id");

-- CreateIndex
CREATE INDEX "bills_referrer_partner_id_idx" ON "bills"("referrer_partner_id");

-- CreateIndex
CREATE INDEX "bills_customer_id_idx" ON "bills"("customer_id");

-- CreateIndex
CREATE INDEX "bills_qr_code_id_created_at_idx" ON "bills"("qr_code_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bills_outlet_id_idempotency_key_key" ON "bills"("outlet_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "outlet_admins" ADD CONSTRAINT "outlet_admins_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "qr_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_referrer_partner_id_fkey" FOREIGN KEY ("referrer_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "outlet_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

