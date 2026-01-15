-- Rolling 360 Statistical Engine Migration
-- Adds support for user-facing "Current Form" metrics based on last 360 Main Session questions

-- =============================================================================
-- 1. Modify QuestionAttempt to support Rolling 360 tagging
-- =============================================================================

-- Add isMainSession flag to QuestionAttempt
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "isMainSession" BOOLEAN NOT NULL DEFAULT false;

-- Add pre-computed normalized system for fast aggregation
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "systemNormalized" TEXT;

-- Index for efficient Rolling 360 queries
CREATE INDEX IF NOT EXISTS "QuestionAttempt_userId_isMainSession_createdAt_idx" 
ON "QuestionAttempt" ("userId", "isMainSession", "createdAt" DESC);

-- =============================================================================
-- 2. Create NCCPA Blueprint Configuration Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "NCCPABlueprintConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "weights" JSONB NOT NULL,
    "systemCount" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "expirationDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NCCPABlueprintConfig_version_key" UNIQUE ("version")
);

CREATE INDEX IF NOT EXISTS "NCCPABlueprintConfig_isActive_idx" ON "NCCPABlueprintConfig" ("isActive");

-- Insert the 2024 PANCE Blueprint (Official NCCPA weights)
INSERT INTO "NCCPABlueprintConfig" ("id", "version", "isActive", "weights", "systemCount", "effectiveDate")
VALUES (
    gen_random_uuid()::text,
    '2024',
    true,
    '{
        "Cardiovascular": 0.13,
        "Pulmonary": 0.10,
        "Gastrointestinal": 0.10,
        "Musculoskeletal": 0.10,
        "HEENT": 0.09,
        "Reproductive": 0.08,
        "Neurological": 0.07,
        "Psychiatry": 0.06,
        "Endocrine": 0.06,
        "Dermatology": 0.05,
        "Genitourinary": 0.05,
        "Hematology": 0.03,
        "Infectious Disease": 0.03,
        "Renal": 0.05
    }'::jsonb,
    14,
    '2024-01-01'
) ON CONFLICT ("version") DO NOTHING;

-- =============================================================================
-- 3. Create UserRolling360Stats Cache Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "UserRolling360Stats" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    
    -- Rolling Aggregates (max 360)
    "totalInWindow" INTEGER NOT NULL DEFAULT 0,
    "correctInWindow" INTEGER NOT NULL DEFAULT 0,
    "accuracyPercent" DECIMAL(5,2),
    
    -- System Breakdown (JSONB)
    "systemStats" JSONB NOT NULL DEFAULT '{}',
    
    -- PANCE Score Prediction (200-800 scale)
    "predictedScore" INTEGER,
    "scoreConfidence" TEXT,
    "passLikelihood" DECIMAL(5,2),
    
    -- Blueprint Adherence
    "blueprintAdherence" DECIMAL(5,4),
    "isValidExamDistribution" BOOLEAN NOT NULL DEFAULT false,
    
    -- Weakness Detection
    "weakestSystems" TEXT[] DEFAULT '{}',
    "strongestSystems" TEXT[] DEFAULT '{}',
    
    -- Window Tracking
    "windowStartAttemptId" TEXT,
    "windowEndAttemptId" TEXT,
    "windowStartTime" TIMESTAMP(3),
    "windowEndTime" TIMESTAMP(3),
    
    -- Circular Buffer Index
    "currentSlotIndex" INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    "lastRecalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recalculationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "UserRolling360Stats_userId_key" UNIQUE ("userId"),
    CONSTRAINT "UserRolling360Stats_userId_fkey" FOREIGN KEY ("userId") 
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserRolling360Stats_userId_idx" ON "UserRolling360Stats" ("userId");
CREATE INDEX IF NOT EXISTS "UserRolling360Stats_predictedScore_idx" ON "UserRolling360Stats" ("predictedScore");

-- =============================================================================
-- 4. Create Rolling360Buffer Circular Buffer Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Rolling360Buffer" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    
    -- Cached data from original QuestionAttempt
    "attemptId" TEXT,
    "isCorrect" BOOLEAN,
    "systemNormalized" TEXT,
    "answeredAt" TIMESTAMP(3),
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Rolling360Buffer_userId_slotIndex_key" UNIQUE ("userId", "slotIndex")
);

CREATE INDEX IF NOT EXISTS "Rolling360Buffer_userId_slotIndex_idx" ON "Rolling360Buffer" ("userId", "slotIndex");

-- =============================================================================
-- 5. Pre-populate Rolling360Buffer with 360 empty slots for existing users
-- (This will be done lazily on first access in the service layer)
-- =============================================================================

-- Comment: The service layer will create buffer slots on-demand when a user
-- first answers a Main Session question. This avoids creating 360 rows per user upfront.

-- =============================================================================
-- 6. Add helpful comments
-- =============================================================================

COMMENT ON TABLE "NCCPABlueprintConfig" IS 'Stores NCCPA PANCE blueprint weights by version. Used to validate Rolling 360 distribution matches real exam.';
COMMENT ON TABLE "UserRolling360Stats" IS 'Cache table for O(1) dashboard reads. Updated incrementally on each Main Session answer.';
COMMENT ON TABLE "Rolling360Buffer" IS 'Circular buffer (360 slots per user) for O(1) sliding window updates.';
COMMENT ON COLUMN "QuestionAttempt"."isMainSession" IS 'True only for Main Session mode. Drills/Quizzes are excluded from Rolling 360.';
COMMENT ON COLUMN "QuestionAttempt"."systemNormalized" IS 'Pre-computed normalized system name for fast aggregation (e.g., Cardiovascular instead of CV).';
