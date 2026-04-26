-- Sprint OSCE-01: EasyMED factorization
-- Add ClinicalIntent enum, ClinicalIntentLog, OsceSession, SpbenchScore models

-- Create ClinicalIntent enum type
CREATE TYPE "ClinicalIntent" AS ENUM (
  'DEMOGRAPHICS',
  'CHIEF_COMPLAINT',
  'ONSET',
  'CAUSE',
  'LOCATION',
  'CHARACTER',
  'DURATION',
  'MODIFIERS',
  'ASSOCIATED',
  'PROGRESSION',
  'TREATMENT',
  'TESTS',
  'GENERAL',
  'ELIMINATION',
  'CHANGES',
  'HEALTH',
  'CHRONIC',
  'INFECTIOUS',
  'SURGICAL',
  'TRANSFUSIONS',
  'ALLERGIES',
  'IMMUNIZATION',
  'TRAVEL',
  'HABITS',
  'OCCUPATION',
  'SEXUAL',
  'OBSTETRIC',
  'FAMILY',
  'MENSTRUAL',
  'COMMUNICATION',
  'OTHER'
);

-- Create ClinicalIntentLog table
CREATE TABLE "ClinicalIntentLog" (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL REFERENCES "PatientEncounterSession"(id) ON DELETE CASCADE,
  "intent" "ClinicalIntent" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "studentText" TEXT NOT NULL,
  "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create index on ClinicalIntentLog
CREATE INDEX "ClinicalIntentLog_sessionId_classifiedAt_idx" ON "ClinicalIntentLog"("sessionId", "classifiedAt");

-- Create OsceSession table
CREATE TABLE "OsceSession" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "caseId" TEXT NOT NULL REFERENCES "PatientEncounterCase"(id) ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'active',
  "currentAgent" TEXT,
  "auxiliaryState" JSONB,
  "patientState" JSONB,
  "evaluationState" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMP(3)
);

-- Create indexes on OsceSession
CREATE INDEX "OsceSession_userId_status_idx" ON "OsceSession"("userId", "status");
CREATE INDEX "OsceSession_caseId_idx" ON "OsceSession"("caseId");

-- Create SpbenchScore table
CREATE TABLE "SpbenchScore" (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL UNIQUE REFERENCES "OsceSession"(id) ON DELETE CASCADE,
  "queryCompetence" DOUBLE PRECISION NOT NULL, -- QC: 0-100
  "caseCoverage" DOUBLE PRECISION NOT NULL, -- CC: 0-100
  "clinicalDepth" DOUBLE PRECISION NOT NULL, -- CD: 0-100
  "relevanceCheck" DOUBLE PRECISION NOT NULL, -- RC: 0-100
  "logicalConsistency" DOUBLE PRECISION NOT NULL, -- LC: 0-100
  "languageNaturality" DOUBLE PRECISION NOT NULL, -- LN: 0-100
  "clinicalSafety" DOUBLE PRECISION NOT NULL, -- CS: 0-100
  "professionalDemeanor" DOUBLE PRECISION NOT NULL, -- PD: 0-100
  "overallScore" DOUBLE PRECISION NOT NULL, -- weighted average
  "justification" TEXT,
  "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- Create index on SpbenchScore
CREATE INDEX "SpbenchScore_sessionId_idx" ON "SpbenchScore"("sessionId");
