-- Push notification engine: templates, campaigns (now / once / daily / weekly) and their runs.
ALTER TABLE "notifications" ADD COLUMN "url" TEXT;

CREATE TYPE "PushScheduleType" AS ENUM ('NOW', 'ONCE', 'DAILY', 'WEEKLY');
CREATE TYPE "PushCampaignStatus" AS ENUM ('SCHEDULED', 'PAUSED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "push_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "detail" TEXT,
    "url" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "push_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_campaigns" (
    "id" TEXT NOT NULL,
    "template_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "detail" TEXT,
    "url" TEXT,
    "audience" JSONB NOT NULL,
    "audience_size" INTEGER NOT NULL DEFAULT 0,
    "platforms" TEXT[],
    "save_to_inbox" BOOLEAN NOT NULL DEFAULT true,
    "schedule_type" "PushScheduleType" NOT NULL,
    "send_at" TIMESTAMP(3),
    "time_of_day" TEXT,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "start_date" DATE,
    "end_date" DATE,
    "next_run_at" TIMESTAMP(3),
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_campaign_runs" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'sending',
    "partners" INTEGER NOT NULL DEFAULT 0,
    "devices" INTEGER NOT NULL DEFAULT 0,
    "accepted" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    CONSTRAINT "push_campaign_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "push_campaigns_status_next_run_at_idx" ON "push_campaigns"("status", "next_run_at");
CREATE UNIQUE INDEX "push_campaign_runs_campaign_id_scheduled_for_key" ON "push_campaign_runs"("campaign_id", "scheduled_for");

ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "push_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "push_campaign_runs" ADD CONSTRAINT "push_campaign_runs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "push_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
