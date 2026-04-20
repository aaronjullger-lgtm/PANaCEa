-- Add missing composite indexes for hot-path queries.
--
-- Context: 2026-04-18 audit (DATABASE_AUDIT_2026-04-17.md §2.2).
-- All @@index directives already present in schema.prisma — this migration
-- materializes them in the DB.
--
-- All CREATE INDEX use IF NOT EXISTS for idempotency.
-- CONCURRENTLY omitted: tables are small at apply time (<thousands of rows).
-- Add CONCURRENTLY if re-applying against a hot replica with millions of rows.
--
-- Query patterns covered:
--   1. PreGeneratedQuestion (validationStatus, qualityScore)
--      auto-author quality filter: WHERE validationStatus=? AND qualityScore>=?
--   2. PreGeneratedQuestion (validationStatus, flagCount)
--      quarantine sweep: WHERE validationStatus=? AND flagCount>=?
--   3. Question (lifecycleStatus, contentHealthScore)
--      content-hygiene queue: WHERE lifecycleStatus=? AND contentHealthScore<?
--   4. ConfusionPair (userId, count DESC, lastOccurrence DESC)
--      dashboard order: WHERE userId=? ORDER BY count DESC, lastOccurrence DESC

CREATE INDEX IF NOT EXISTS "PreGeneratedQuestion_validationStatus_qualityScore_idx"
  ON "PreGeneratedQuestion" ("validationStatus", "qualityScore");

CREATE INDEX IF NOT EXISTS "PreGeneratedQuestion_validationStatus_flagCount_idx"
  ON "PreGeneratedQuestion" ("validationStatus", "flagCount");

CREATE INDEX IF NOT EXISTS "Question_lifecycleStatus_contentHealthScore_idx"
  ON "Question" ("lifecycleStatus", "contentHealthScore");

CREATE INDEX IF NOT EXISTS "ConfusionPair_userId_count_lastOccurrence_idx"
  ON "ConfusionPair" ("userId", "count" DESC, "lastOccurrence" DESC);
