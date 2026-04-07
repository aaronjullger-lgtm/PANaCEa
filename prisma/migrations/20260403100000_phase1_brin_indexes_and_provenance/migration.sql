-- Phase 1 Migration: BRIN Indexes + Content Provenance Fields
--
-- BRIN indexes: ~20% smaller than B-tree for time-correlated append-only data.
-- These supplement (do NOT replace) existing composite B-tree indexes.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction, so we use
-- regular CREATE INDEX IF NOT EXISTS which is safe for Prisma migrate.
--
-- Content provenance: Adds freshness and evidence tracking fields to
-- MedicalContent and Question for clinical reference library quality indicators
-- and AI output provenance (Principle 11: Trust requires provenance).

-- ============================================================================
-- 1. BRIN INDEXES ON TIME-SERIES COLUMNS
-- ============================================================================

-- ReviewLog.reviewedAt: append-only review events, naturally time-ordered
CREATE INDEX IF NOT EXISTS "idx_reviewlog_reviewedat_brin"
  ON "ReviewLog" USING brin ("reviewedAt");

-- QuestionAttempt.createdAt: append-only question attempts
CREATE INDEX IF NOT EXISTS "idx_questionattempt_createdat_brin"
  ON "QuestionAttempt" USING brin ("createdAt");

-- PerformanceRecord.timestamp: append-only performance events (BigInt epoch)
CREATE INDEX IF NOT EXISTS "idx_performancerecord_timestamp_brin"
  ON "PerformanceRecord" USING brin ("timestamp");

-- DailyUserAnalytics.sessionDate: daily analytics, one row per user per day
CREATE INDEX IF NOT EXISTS "idx_dailyuseranalytics_sessiondate_brin"
  ON "DailyUserAnalytics" USING brin ("sessionDate");

-- ============================================================================
-- 2. CONTENT PROVENANCE FIELDS ON MedicalContent
-- ============================================================================

-- When was this content last reviewed by a clinical expert?
ALTER TABLE "MedicalContent"
  ADD COLUMN IF NOT EXISTS "lastClinicalReviewAt" TIMESTAMPTZ;

-- Evidence grade: A (strong RCT evidence), B (moderate), C (expert opinion/case series)
ALTER TABLE "MedicalContent"
  ADD COLUMN IF NOT EXISTS "evidenceGrade" VARCHAR(1);

-- Source guideline (e.g., "AHA 2025", "ACOG Practice Bulletin 234")
ALTER TABLE "MedicalContent"
  ADD COLUMN IF NOT EXISTS "guidelineSource" TEXT;

-- Year of the source guideline
ALTER TABLE "MedicalContent"
  ADD COLUMN IF NOT EXISTS "guidelineYear" INTEGER;

-- Who last reviewed this content (admin username or "AI-generated")
ALTER TABLE "MedicalContent"
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;

-- Index for filtering by evidence grade (small cardinality: A/B/C/null)
-- Standard B-tree (not partial) to match Prisma schema @@index declaration.
-- A partial index would cause prisma migrate diff drift on every future migration.
CREATE INDEX IF NOT EXISTS "idx_medicalcontent_evidence_grade"
  ON "MedicalContent" ("evidenceGrade");

-- ============================================================================
-- 3. AI OUTPUT PROVENANCE FIELDS ON Question
-- ============================================================================
-- Tracks which AI model generated each question, when, and its verification
-- status. Enables trust scoring, model performance comparison, and human
-- review workflows for AI-generated content.

-- Which AI model generated this question (e.g., "gemini-2.5-pro")
ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "generatedByModel" TEXT;

-- When the question was AI-generated
ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMPTZ;

-- CoVe confidence score 0.0-1.0
ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "verificationScore" DOUBLE PRECISION;

-- Whether a human has reviewed this question
ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "humanReviewed" BOOLEAN DEFAULT false;
