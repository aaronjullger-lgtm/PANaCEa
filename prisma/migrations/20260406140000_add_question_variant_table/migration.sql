-- CreateTable: QuestionVariant
-- Enables the reactive variant pipeline (variantQueueService) and unlocks
-- adaptive variant serving based on confusion pairs and weakness patterns.
-- The batch variant cron (generate-variants.ts) also writes to this table
-- for on-demand variants triggered by incorrect answers.
--
-- Related services:
--   services/core/variantQueueService.ts
--   lib/questionVariantGenerator.ts
--   functions/api/cron/generate-variants.ts

-- ============================================================================
-- QuestionVariant Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "QuestionVariant" (
    "id"             TEXT NOT NULL,
    "baseQuestionId" TEXT NOT NULL,
    "variantType"    TEXT NOT NULL,
    "vignette"       TEXT,
    "question"       TEXT NOT NULL,
    "options"        TEXT[],
    "correctAnswer"  TEXT NOT NULL,
    "explanation"    TEXT NOT NULL,
    "difficulty"     TEXT NOT NULL DEFAULT 'medium',
    "taskType"       TEXT,
    "usedByUsers"    TEXT[],
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVariant_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Fast lookup of all variants for a given base question
CREATE INDEX "QuestionVariant_baseQuestionId_idx" ON "QuestionVariant"("baseQuestionId");

-- Filter variants by PANCE task type
CREATE INDEX "QuestionVariant_taskType_idx" ON "QuestionVariant"("taskType");
