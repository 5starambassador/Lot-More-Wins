-- AlterTable
ALTER TABLE "program_settings"
    ADD COLUMN "first_time_validity_days" INTEGER NOT NULL DEFAULT 0;
