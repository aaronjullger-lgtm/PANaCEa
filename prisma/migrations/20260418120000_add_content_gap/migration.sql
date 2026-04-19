-- Sprint 15 — ContentGap model
-- Tracks blueprint topics with insufficient coverage or poor user mastery so
-- the proactive-reservoir and daily-insights pipelines can surface targeted
-- remediation. Supports both:
--   1. Per-user gaps (userId IS NOT NULL) — used by learner-profile / daily-load
--   2. Global/content gaps (userId IS NULL)    — used by admin content tooling
--
-- Greenfield DB per prisma/audit/DATABASE_AUDIT_2026-04-17.md §live snapshot
-- (0 QuestionAttempts, 0 ReviewLogs, 3 users), so no backfill required.
--
-- Related services (pending):
--   lib/services/contentGapService.ts   — gap detection from attempts + progress
--   functions/api/analytics/daily-load.ts — consumes gap severity for load plan

-- ============================================================================
-- ContentGap Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "ContentGap" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT,
    "system"         TEXT NOT NULL,
    "taskCategory"   TEXT,
    "conditionId"    TEXT,
    "topic"          TEXT NOT NULL,
    "gapType"        TEXT NOT NULL,               -- COVERAGE | MASTERY | STALENESS
    "severity"       DOUBLE PRECISION NOT NULL DEFAULT 0,   -- 0..1 gap score
    "questionCount"  INTEGER NOT NULL DEFAULT 0,
    "avgAccuracy"    DOUBLE PRECISION,
    "lastReviewAt"   TIMESTAMP(3),
    "detectedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"     TIMESTAMP(3),
    "metadata"       JSONB,

    CONSTRAINT "ContentGap_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Foreign Keys
-- ============================================================================
ALTER TABLE "ContentGap"
    ADD CONSTRAINT "ContentGap_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX "ContentGap_userId_idx"               ON "ContentGap"("userId");
CREATE INDEX "ContentGap_system_idx"               ON "ContentGap"("system");
CREATE INDEX "ContentGap_userId_system_idx"        ON "ContentGap"("userId", "system");
CREATE INDEX "ContentGap_userId_resolvedAt_idx"    ON "ContentGap"("userId", "resolvedAt");
CREATE INDEX "ContentGap_gapType_idx"              ON "ContentGap"("gapType");
CREATE INDEX "ContentGap_severity_idx"             ON "ContentGap"("severity");

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE "ContentGap" ENABLE ROW LEVEL SECURITY;

-- Users can read their own per-user gaps; service role bypasses RLS for
-- populating global (userId IS NULL) rows.
CREATE POLICY "content_gap_select_own"
  ON "ContentGap"
  FOR SELECT
  USING (auth.uid()::text = "userId");

CREATE POLICY "content_gap_insert_own"
  ON "ContentGap"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "content_gap_update_own"
  ON "ContentGap"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "content_gap_delete_own"
  ON "ContentGap"
  FOR DELETE
  USING (auth.uid()::text = "userId");
