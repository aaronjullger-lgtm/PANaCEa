-- Create ECGPattern table (missing from migration history)
CREATE TABLE IF NOT EXISTS "ECGPattern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "panceYield" INTEGER,
    "isHighYield" BOOLEAN NOT NULL DEFAULT false,
    "boardYieldFacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "rate" TEXT,
    "rhythm" TEXT,
    "pWave" TEXT,
    "prInterval" TEXT,
    "qrsComplex" TEXT,
    "qtInterval" TEXT,
    "stSegment" TEXT,
    "tWave" TEXT,
    "diagnosticCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pathognomonic" TEXT,
    "etiology" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hemodynamicEffect" TEXT,
    "associatedConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acuteManagement" TEXT,
    "medications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cardioversion" TEXT,
    "pacing" TEXT,
    "referral" TEXT,
    "mimics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "distinguishingFeatures" JSONB,
    "exampleEcgUrl" TEXT,
    "annotatedEcgUrl" TEXT,
    "clinicalPearls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commonMistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "testQuestionTips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mnemonics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "exampleImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "annotatedImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ECGPattern_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ECGPattern_name_key" ON "ECGPattern"("name");
CREATE INDEX IF NOT EXISTS "ECGPattern_category_idx" ON "ECGPattern"("category");
CREATE INDEX IF NOT EXISTS "ECGPattern_isEmergency_idx" ON "ECGPattern"("isEmergency");
CREATE INDEX IF NOT EXISTS "ECGPattern_panceYield_idx" ON "ECGPattern"("panceYield");