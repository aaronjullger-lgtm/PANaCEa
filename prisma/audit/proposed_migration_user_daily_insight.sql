-- ============================================================================
-- Proposed migration: create UserDailyInsight table
-- Date: 2026-04-18
-- Status: DRAFT — awaiting Aaron's approval to apply.
-- Paired with: prisma/schema.prisma UserDailyInsight model (already added),
--              functions/api/cron/generate-daily-insights.ts (code rewrite).
--
-- Context (see DATABASE_AUDIT_2026-04-17.md Addendum §A.7 item 4):
-- The cron was writing insight blobs into DailyStudyPlan.planData — a column
-- that doesn't exist. DailyStudyPlan is a planning/commitment table with
-- required fields (targetQuestionsCount, estimatedTimeMinutes, status,
-- recommendedSessions) that don't match an insight-cache workload.
--
-- Apply via:
--   npx prisma migrate dev --name create_user_daily_insight
-- or let Supabase MCP apply_migration handle it once the MCP reconnects.
-- ============================================================================

CREATE TABLE "UserDailyInsight" (
  "id"              TEXT      NOT NULL PRIMARY KEY,
  "userId"          TEXT      NOT NULL,
  "insightDate"     DATE      NOT NULL,
  "insights"        TEXT      NOT NULL,
  "metricsSnapshot" JSONB     NOT NULL,
  "model"           TEXT      NOT NULL,
  "generatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDailyInsight_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserDailyInsight_userId_insightDate_key"
  ON "UserDailyInsight" ("userId", "insightDate");

CREATE INDEX "UserDailyInsight_userId_insightDate_idx"
  ON "UserDailyInsight" ("userId", "insightDate" DESC);

CREATE INDEX "UserDailyInsight_insightDate_idx"
  ON "UserDailyInsight" ("insightDate");

COMMENT ON TABLE "UserDailyInsight" IS
  'Dashboard insight cache generated daily by generate-daily-insights cron. One row per (user, date). Separated from DailyStudyPlan which is a planning/commitment table.';

-- RLS: users read/write only their own insights (cron runs as service role,
-- which bypasses RLS).
ALTER TABLE "UserDailyInsight" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_daily_insight_select_own"
  ON "UserDailyInsight"
  FOR SELECT
  USING (auth.uid()::text = "userId");

CREATE POLICY "user_daily_insight_insert_own"
  ON "UserDailyInsight"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "user_daily_insight_update_own"
  ON "UserDailyInsight"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "user_daily_insight_delete_own"
  ON "UserDailyInsight"
  FOR DELETE
  USING (auth.uid()::text = "userId");
