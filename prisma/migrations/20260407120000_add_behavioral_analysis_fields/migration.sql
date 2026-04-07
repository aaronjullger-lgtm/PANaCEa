-- Add behavioral analysis fields for grade modulation pipeline
-- Phase 0 of Behavioral Analysis Audit implementation

-- ReviewLog: store raw vs modulated grade and behavioral deltas
ALTER TABLE "ReviewLog" ADD COLUMN "rawGrade" DOUBLE PRECISION;
ALTER TABLE "ReviewLog" ADD COLUMN "effectiveGrade" DOUBLE PRECISION;
ALTER TABLE "ReviewLog" ADD COLUMN "behavioralDeltas" JSONB;

-- UserSRSConfig: per-user response time baseline for RT zone classification
ALTER TABLE "UserSRSConfig" ADD COLUMN "medianResponseTimeMs" INTEGER;
ALTER TABLE "UserSRSConfig" ADD COLUMN "responseTimeSampleN" INTEGER NOT NULL DEFAULT 0;

-- DrillSessionRecord: rolling window stats for fatigue detection
ALTER TABLE "DrillSessionRecord" ADD COLUMN "rollingAccuracy" DOUBLE PRECISION;
ALTER TABLE "DrillSessionRecord" ADD COLUMN "rollingMeanRtMs" INTEGER;
ALTER TABLE "DrillSessionRecord" ADD COLUMN "sessionMeanAccuracy" DOUBLE PRECISION;

-- Index effectiveGrade for FSRS optimizer queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewLog_effectiveGrade_idx"
  ON "ReviewLog" ("effectiveGrade")
  WHERE "effectiveGrade" IS NOT NULL;
