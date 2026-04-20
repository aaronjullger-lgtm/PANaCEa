-- Sprint 15 — UserDailyInsight table
-- Dashboard insight cache generated daily by functions/api/cron/generate-daily-insights.ts.
-- One row per (user, date). Replaces the broken pattern of writing insight blobs into
-- DailyStudyPlan.planData (a column that does not exist on that model).
--
-- Model is already in schema.prisma (UserDailyInsight, line ~4171).
-- Schema is greenfield at time of writing (0 QuestionAttempts, 3 users).
-- No backfill required.
--
-- Apply:
--   Option A — Prisma manages it:
--     npm run db:migrate:deploy
--   Option B — Already applied via Supabase MCP:
--     npx prisma migrate resolve --applied 20260418120200_create_user_daily_insight

CREATE TABLE "UserDailyInsight" (
  "id"              TEXT         NOT NULL,
  "userId"          TEXT         NOT NULL,
  "insightDate"     DATE         NOT NULL,
  "insights"        TEXT         NOT NULL,
  "metricsSnapshot" JSONB        NOT NULL,
  "model"           TEXT         NOT NULL,
  "generatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDailyInsight_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserDailyInsight"
  ADD CONSTRAINT "UserDailyInsight_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserDailyInsight_userId_insightDate_key"
  ON "UserDailyInsight" ("userId", "insightDate");

CREATE INDEX "UserDailyInsight_userId_insightDate_idx"
  ON "UserDailyInsight" ("userId", "insightDate" DESC);

CREATE INDEX "UserDailyInsight_insightDate_idx"
  ON "UserDailyInsight" ("insightDate");

ALTER TABLE "UserDailyInsight" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_daily_insight_select_own"
  ON "UserDailyInsight" FOR SELECT
  USING (auth.uid()::text = "userId");

CREATE POLICY "user_daily_insight_insert_own"
  ON "UserDailyInsight" FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "user_daily_insight_update_own"
  ON "UserDailyInsight" FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "user_daily_insight_delete_own"
  ON "UserDailyInsight" FOR DELETE
  USING (auth.uid()::text = "userId");
