-- Phase 4 Migration: Course Retention Map
--
-- Adds per-course desired retention overrides to UserSRSConfig.
-- This allows students to set different retention targets per course
-- (e.g., 95% for shelf prep, 85% for maintenance).

-- ============================================================================
-- 1. COURSE RETENTION MAP ON UserSRSConfig
-- ============================================================================

ALTER TABLE "UserSRSConfig"
  ADD COLUMN IF NOT EXISTS "courseRetentionMap" JSONB;
