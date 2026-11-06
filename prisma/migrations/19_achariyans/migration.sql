-- Achariyans: people of the Achariya institutions (students first; staff and others later).
-- A new table on its own: nothing existing reads or changes because of it.
CREATE TYPE "AchariyanCategory" AS ENUM ('STUDENT', 'STAFF', 'OTHER');

CREATE TABLE "achariyans" (
    "id" TEXT NOT NULL,
    "category" "AchariyanCategory" NOT NULL,
    "college" TEXT,
    "degree" TEXT,
    "year" INTEGER,
    "semester" INTEGER,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "source_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achariyans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "achariyans_source_ref_key" ON "achariyans"("source_ref");
CREATE INDEX "achariyans_mobile_idx" ON "achariyans"("mobile");
CREATE INDEX "achariyans_category_college_idx" ON "achariyans"("category", "college");
