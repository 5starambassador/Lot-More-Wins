-- Offer / announcement notifications with a full message shown on their own page.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFER';
ALTER TABLE "notifications" ADD COLUMN "detail" TEXT;
