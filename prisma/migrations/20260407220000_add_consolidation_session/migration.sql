-- Add consolidation session support (Tier 2, Feature 5)
--
-- Adds bedtime/consolidation preference fields to UserPreferences
-- and adds CONSOLIDATION to the SessionType enum.
--
-- Research basis: Mazza et al. (2016) — pre-sleep review + sleep → 2× retention

-- Add CONSOLIDATION to SessionType enum
ALTER TYPE "SessionType" ADD VALUE IF NOT EXISTS 'CONSOLIDATION';

-- Add consolidation preference fields to UserPreferences
ALTER TABLE "UserPreferences"
  ADD COLUMN IF NOT EXISTS "bedtimeHour" INTEGER,
  ADD COLUMN IF NOT EXISTS "bedtimeMinute" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "consolidationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consolidationMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "consolidationTimezone" TEXT,
  ADD COLUMN IF NOT EXISTS "pushSubscription" JSONB;

-- Validation constraints
ALTER TABLE "UserPreferences"
  ADD CONSTRAINT "chk_bedtime_hour" CHECK ("bedtimeHour" IS NULL OR ("bedtimeHour" >= 0 AND "bedtimeHour" <= 23)),
  ADD CONSTRAINT "chk_bedtime_minute" CHECK ("bedtimeMinute" IS NULL OR ("bedtimeMinute" >= 0 AND "bedtimeMinute" <= 59)),
  ADD CONSTRAINT "chk_consolidation_minutes" CHECK ("consolidationMinutes" >= 5 AND "consolidationMinutes" <= 30);
