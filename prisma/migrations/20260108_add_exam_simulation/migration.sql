-- Migration: Simulated PANCE/PANRE-LA Architecture
-- Sprint 5: Exam simulation infrastructure
-- Date: 2026-01-08

-- =============================================================================
-- PART 1: ExamConfig - Exam settings (PANCE vs PANRE-LA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "ExamConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE, -- "PANCE", "PANRE-LA"
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "totalQuestions" INTEGER NOT NULL, -- 300 or 240
  "timeMinutes" INTEGER NOT NULL, -- 300 or 240
  "blocks" INTEGER NOT NULL, -- 5 or 4
  "questionsPerBlock" INTEGER NOT NULL, -- 60
  "passingScore" DECIMAL(5,2), -- 450 scaled score
  "blueprintWeights" JSONB NOT NULL, -- NCCPA percentages by system
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PART 2: ExamAttempt - User exam sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS "ExamAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "configId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentBlock" INTEGER NOT NULL DEFAULT 1,
  "currentQuestionInBlock" INTEGER NOT NULL DEFAULT 1,
  "blockTimes" JSONB DEFAULT '[]', -- [{block: 1, startedAt, endedAt, timeUsed}]
  "status" TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'paused', 'completed', 'abandoned', 'timed_out'
  "totalTimeUsedSeconds" INTEGER DEFAULT 0,
  "score" DECIMAL(5,2), -- Final scaled score
  "percentCorrect" DECIMAL(5,2),
  "systemScores" JSONB, -- {cardiovascular: 85, pulmonary: 72, ...}
  "passStatus" TEXT, -- 'passed', 'failed', 'pending'
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ExamAttempt_configId_fkey" FOREIGN KEY ("configId") 
    REFERENCES "ExamConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") 
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- =============================================================================
-- PART 3: ExamAnswer - Individual question answers
-- =============================================================================

CREATE TABLE IF NOT EXISTS "ExamAnswer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "blockNumber" INTEGER NOT NULL,
  "questionNumber" INTEGER NOT NULL, -- Position in block (1-60)
  "selectedAnswer" TEXT, -- A, B, C, D, E or null if skipped
  "isCorrect" BOOLEAN,
  "isFlagged" BOOLEAN DEFAULT false,
  "timeSpentSeconds" INTEGER DEFAULT 0,
  "answeredAt" TIMESTAMP(3),
  "organSystem" TEXT, -- For system-by-system scoring
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") 
    REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") 
    REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExamAnswer_attemptId_questionId_key" UNIQUE("attemptId", "questionId")
);

-- =============================================================================
-- PART 4: Indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS "ExamConfig_name_idx" ON "ExamConfig"("name");
CREATE INDEX IF NOT EXISTS "ExamConfig_isActive_idx" ON "ExamConfig"("isActive");

CREATE INDEX IF NOT EXISTS "ExamAttempt_userId_idx" ON "ExamAttempt"("userId");
CREATE INDEX IF NOT EXISTS "ExamAttempt_configId_idx" ON "ExamAttempt"("configId");
CREATE INDEX IF NOT EXISTS "ExamAttempt_status_idx" ON "ExamAttempt"("status");
CREATE INDEX IF NOT EXISTS "ExamAttempt_startedAt_idx" ON "ExamAttempt"("startedAt");

CREATE INDEX IF NOT EXISTS "ExamAnswer_attemptId_idx" ON "ExamAnswer"("attemptId");
CREATE INDEX IF NOT EXISTS "ExamAnswer_questionId_idx" ON "ExamAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "ExamAnswer_blockNumber_idx" ON "ExamAnswer"("blockNumber");
CREATE INDEX IF NOT EXISTS "ExamAnswer_organSystem_idx" ON "ExamAnswer"("organSystem");
CREATE INDEX IF NOT EXISTS "ExamAnswer_isFlagged_idx" ON "ExamAnswer"("isFlagged");

-- =============================================================================
-- PART 5: Seed exam configurations
-- =============================================================================

INSERT INTO "ExamConfig" ("id", "name", "displayName", "description", "totalQuestions", "timeMinutes", "blocks", "questionsPerBlock", "passingScore", "blueprintWeights")
VALUES 
  (
    'pance-2024',
    'PANCE',
    'Physician Assistant National Certifying Exam',
    'Initial certification exam for PA-C credential',
    300,
    300,
    5,
    60,
    450,
    '{
      "cardiovascular": 11,
      "pulmonary": 9,
      "gastrointestinal": 9,
      "musculoskeletal": 9,
      "heent": 8,
      "reproductive": 8,
      "neurological": 7,
      "psychiatry": 7,
      "endocrine": 6,
      "dermatology": 5,
      "genitourinary": 5,
      "hematology": 4,
      "infectious_disease": 4,
      "nephrology": 4,
      "emergency_medicine": 2,
      "professional_practice": 2
    }'::jsonb
  ),
  (
    'panre-la-2024',
    'PANRE-LA',
    'Physician Assistant National Recertifying Exam - Longitudinal Assessment',
    'Ongoing certification maintenance via quarterly question sets',
    240,
    240,
    4,
    60,
    450,
    '{
      "cardiovascular": 11,
      "pulmonary": 9,
      "gastrointestinal": 9,
      "musculoskeletal": 9,
      "heent": 8,
      "reproductive": 8,
      "neurological": 7,
      "psychiatry": 7,
      "endocrine": 6,
      "dermatology": 5,
      "genitourinary": 5,
      "hematology": 4,
      "infectious_disease": 4,
      "nephrology": 4,
      "emergency_medicine": 2,
      "professional_practice": 2
    }'::jsonb
  )
ON CONFLICT ("name") DO NOTHING;

-- =============================================================================
-- PART 6: Add RLS policies for exam tables
-- =============================================================================

ALTER TABLE "ExamAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamAnswer" ENABLE ROW LEVEL SECURITY;

-- Users can only see their own exam attempts
CREATE POLICY "ExamAttempt_select_own" ON "ExamAttempt"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "ExamAttempt_insert_own" ON "ExamAttempt"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "ExamAttempt_update_own" ON "ExamAttempt"
  FOR UPDATE USING (auth.uid()::text = "userId");

-- Users can only see answers for their own attempts
CREATE POLICY "ExamAnswer_select_own" ON "ExamAnswer"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "ExamAttempt" 
      WHERE "ExamAttempt"."id" = "ExamAnswer"."attemptId" 
      AND "ExamAttempt"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "ExamAnswer_insert_own" ON "ExamAnswer"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ExamAttempt" 
      WHERE "ExamAttempt"."id" = "ExamAnswer"."attemptId" 
      AND "ExamAttempt"."userId" = auth.uid()::text
    )
  );

CREATE POLICY "ExamAnswer_update_own" ON "ExamAnswer"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "ExamAttempt" 
      WHERE "ExamAttempt"."id" = "ExamAnswer"."attemptId" 
      AND "ExamAttempt"."userId" = auth.uid()::text
    )
  );

COMMIT;
