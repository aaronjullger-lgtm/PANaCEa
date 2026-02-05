-- Migration: Add Multi-Modal Architecture Support
-- Date: 2026-02-05
-- Purpose: Add fields and tables for Modules 1-5 integration

-- ============================================================================
-- Module 1: Living Patient Encounter
-- ============================================================================

-- Add state machine to PatientEncounterCase
ALTER TABLE "PatientEncounterCase" 
ADD COLUMN IF NOT EXISTS "stateMachine" JSONB,
ADD COLUMN IF NOT EXISTS "videoUrls" JSONB,
ADD COLUMN IF NOT EXISTS "voiceConfig" JSONB;

COMMENT ON COLUMN "PatientEncounterCase"."stateMachine" IS 'PatientAVStateMachine JSON for clinical state transitions';
COMMENT ON COLUMN "PatientEncounterCase"."videoUrls" IS 'Map of state IDs to veo_cameos video URLs';
COMMENT ON COLUMN "PatientEncounterCase"."voiceConfig" IS 'Voice personality configuration';

-- ============================================================================
-- Module 5: Interface Fabric & Gamification
-- ============================================================================

-- User Avatar (progression system)
CREATE TABLE IF NOT EXISTS "UserAvatar" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "stage" TEXT NOT NULL DEFAULT 'student_year_1',
  "equippedAccessories" JSONB NOT NULL DEFAULT '[]',
  "xp" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserAvatar_userId_idx" ON "UserAvatar"("userId");

-- User Achievements (badge system)
CREATE TABLE IF NOT EXISTS "UserAchievement" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "displayOnProfile" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserAchievement_userId_badgeId_key" UNIQUE ("userId", "badgeId")
);

CREATE INDEX IF NOT EXISTS "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- Phantom Patient (motivation system)
CREATE TABLE IF NOT EXISTS "PhantomPatient" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "condition" TEXT NOT NULL,
  "healthState" INTEGER NOT NULL DEFAULT 100,
  "videoUrl" TEXT,
  "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhantomPatient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PhantomPatient_userId_idx" ON "PhantomPatient"("userId");

-- ============================================================================
-- Module 4: Smart Scribe & Automated Case Files
-- ============================================================================

-- Case File (automated learning artifact)
CREATE TABLE IF NOT EXISTS "CaseFile" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL UNIQUE,
  "soapComparison" JSONB NOT NULL,
  "timingAnalytics" JSONB NOT NULL,
  "infographics" JSONB NOT NULL DEFAULT '[]',
  "pdfUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientEncounterSession"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CaseFile_sessionId_idx" ON "CaseFile"("sessionId");

-- ============================================================================
-- User Circadian Profile (Module 5)
-- ============================================================================

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "circadianProfile" JSONB,
ADD COLUMN IF NOT EXISTS "preferredUIMode" TEXT;

COMMENT ON COLUMN "User"."circadianProfile" IS 'Peak hours, low energy hours, sleep schedule for adaptive UI';
COMMENT ON COLUMN "User"."preferredUIMode" IS 'User override for UI mode (focus, review, rest, standard)';

-- ============================================================================
-- Audio Review (Module 5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "AudioReview" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "audioUrl" TEXT NOT NULL,
  "duration" INTEGER NOT NULL,
  "weakAreas" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "playCount" INTEGER NOT NULL DEFAULT 0,
  "lastPlayed" TIMESTAMP(3),
  CONSTRAINT "AudioReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AudioReview_userId_idx" ON "AudioReview"("userId");
CREATE INDEX IF NOT EXISTS "AudioReview_createdAt_idx" ON "AudioReview"("createdAt");

-- ============================================================================
-- Consult Requests (Module 5 - SBAR Training)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ConsultRequest" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "consultantType" TEXT NOT NULL,
  "sbarProvided" JSONB,
  "transcript" JSONB NOT NULL DEFAULT '[]',
  "outcome" TEXT NOT NULL DEFAULT 'in_progress',
  "feedback" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ConsultRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ConsultRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientEncounterSession"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ConsultRequest_sessionId_idx" ON "ConsultRequest"("sessionId");
CREATE INDEX IF NOT EXISTS "ConsultRequest_userId_idx" ON "ConsultRequest"("userId");

-- ============================================================================
-- Generated Infographics (Module 4)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "GeneratedInfographic" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "requestId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "primaryConcept" TEXT NOT NULL,
  "secondaryConcept" TEXT,
  "imageUrl" TEXT NOT NULL,
  "svgMarkup" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedInfographic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "GeneratedInfographic_userId_idx" ON "GeneratedInfographic"("userId");
CREATE INDEX IF NOT EXISTS "GeneratedInfographic_sessionId_idx" ON "GeneratedInfographic"("sessionId");
CREATE INDEX IF NOT EXISTS "GeneratedInfographic_primaryConcept_idx" ON "GeneratedInfographic"("primaryConcept");

-- ============================================================================
-- Update User Stats for Gamification
-- ============================================================================

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "totalXP" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "longestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastStudyDate" TIMESTAMP(3);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS "PatientEncounterCase_stateMachine_idx" ON "PatientEncounterCase"(("stateMachine" IS NOT NULL));
CREATE INDEX IF NOT EXISTS "User_totalXP_idx" ON "User"("totalXP" DESC);
CREATE INDEX IF NOT EXISTS "User_currentStreak_idx" ON "User"("currentStreak" DESC);
