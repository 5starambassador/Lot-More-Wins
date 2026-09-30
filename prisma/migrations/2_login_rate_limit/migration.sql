-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_attempts_scope_email_ip_created_at_idx" ON "login_attempts"("scope", "email", "ip", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_scope_ip_created_at_idx" ON "login_attempts"("scope", "ip", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_created_at_idx" ON "login_attempts"("created_at");

