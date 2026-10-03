-- Admin accounts with page access. Existing accounts keep full access as SUPER_ADMIN (the default).
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

ALTER TABLE "super_admins"
    ADD COLUMN "mobile" TEXT,
    ADD COLUMN "position" TEXT,
    ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    ADD COLUMN "pages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "can_delete" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "created_by_id" TEXT;
