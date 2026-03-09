-- Create ACLSAlgorithm table (missing from migration history)
CREATE TABLE IF NOT EXISTS "ACLSAlgorithm" (
    "id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "algorithmName" TEXT,
    "algorithmStep" INTEGER,
    "boardYieldFacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clinicalContext" TEXT,
    "clinicalPearls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commonMistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correctIntervention" TEXT,
    "cprGuidance" TEXT,
    "criticalActions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "drugDose" TEXT,
    "drugTiming" TEXT,
    "ecgFindings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "energyDose" TEXT,
    "isHighYield" BOOLEAN NOT NULL DEFAULT false,
    "mnemonics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "panceYield" INTEGER,
    "patientAge" TEXT,
    "relatedAlgorithms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rhythm" TEXT,
    "rhythmDescription" TEXT,
    "testQuestionTips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,

    CONSTRAINT "ACLSQuestion_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "ACLSQuestion_algorithmName_idx" ON "ACLSAlgorithm"("algorithmName");
CREATE INDEX IF NOT EXISTS "ACLSQuestion_category_idx" ON "ACLSAlgorithm"("category");
CREATE INDEX IF NOT EXISTS "ACLSQuestion_panceYield_idx" ON "ACLSAlgorithm"("panceYield");
CREATE INDEX IF NOT EXISTS "ACLSQuestion_rhythm_idx" ON "ACLSAlgorithm"("rhythm");