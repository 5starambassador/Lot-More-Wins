-- "Referred by" answer from partner registration. These columns were first added to production
-- with `prisma db push`, so every statement is guarded and this migration is a no-op there; on a
-- fresh database it creates them.
DO $$ BEGIN
    CREATE TYPE "ReferredByType" AS ENUM ('PARTNER', 'OUTLET', 'MARKETING_REP', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "partners"
    ADD COLUMN IF NOT EXISTS "referred_by_type" "ReferredByType",
    ADD COLUMN IF NOT EXISTS "referred_by_text" TEXT,
    ADD COLUMN IF NOT EXISTS "referred_by_partner_id" TEXT,
    ADD COLUMN IF NOT EXISTS "referred_by_outlet_id" TEXT;

DO $$ BEGIN
    ALTER TABLE "partners" ADD CONSTRAINT "partners_referred_by_partner_id_fkey" FOREIGN KEY ("referred_by_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "partners" ADD CONSTRAINT "partners_referred_by_outlet_id_fkey" FOREIGN KEY ("referred_by_outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
