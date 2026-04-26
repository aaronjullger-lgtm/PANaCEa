-- Sprint OSCE-01: ClinicalIntentLog - tracks intent classifications during OSCE sessions
CREATE TABLE "ClinicalIntentLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "studentText" TEXT NOT NULL,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalIntentLog_pkey" PRIMARY KEY ("id")
);

-- Sprint OSCE-01: OsceSession - multi-agent session state management
CREATE TABLE "OsceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentAgent" TEXT NOT NULL,
    "auxiliaryState" JSONB,
    "patientState" JSONB,
    "evaluationState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OsceSession_pkey" PRIMARY KEY ("id")
);

-- Sprint OSCE-01: SpbenchScore - SPBench 8-dimension rubric scoring
CREATE TABLE "SpbenchScore" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "queryCompetence" DOUBLE PRECISION NOT NULL,
    "caseCoverage" DOUBLE PRECISION NOT NULL,
    "clinicalDepth" DOUBLE PRECISION NOT NULL,
    "relevanceCheck" DOUBLE PRECISION NOT NULL,
    "logicalConsistency" DOUBLE PRECISION NOT NULL,
    "languageNaturality" DOUBLE PRECISION NOT NULL,
    "clinicalSafety" DOUBLE PRECISION NOT NULL,
    "professionalDemeanor" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "justification" TEXT,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpbenchScore_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SpbenchScore_sessionId_key" UNIQUE ("sessionId")
);

-- Create indexes
CREATE INDEX "ClinicalIntentLog_sessionId_classifiedAt_idx" ON "ClinicalIntentLog"("sessionId", "classifiedAt");
CREATE INDEX "OsceSession_userId_status_idx" ON "OsceSession"("userId", "status");
CREATE INDEX "OsceSession_caseId_idx" ON "OsceSession"("caseId");
CREATE INDEX "SpbenchScore_sessionId_idx" ON "SpbenchScore"("sessionId");

-- Create enum type for ClinicalIntent
DO $$ BEGIN
    CREATE TYPE "ClinicalIntent" AS ENUM (
        'DEMOGRAPHICS', 'CHIEF_COMPLAINT', 'ONSET', 'CAUSE', 'LOCATION',
        'CHARACTER', 'DURATION', 'MODIFIERS', 'ASSOCIATED', 'PROGRESSION',
        'TREATMENT', 'TESTS', 'GENERAL', 'ELIMINATION', 'CHANGES', 'HEALTH',
        'CHRONIC', 'INFECTIOUS', 'SURGICAL', 'TRANSFUSIONS', 'ALLERGIES',
        'IMMUNIZATION', 'TRAVEL', 'HABITS', 'OCCUPATION', 'SEXUAL',
        'OBSTETRIC', 'FAMILY', 'MENSTRUAL', 'COMMUNICATION', 'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraint for ClinicalIntentLog.sessionId -> PatientEncounterSession.id
ALTER TABLE "ClinicalIntentLog"
    ADD CONSTRAINT "ClinicalIntentLog_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "PatientEncounterSession"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Add foreign key constraint for OsceSession.caseId -> PatientEncounterCase.id
ALTER TABLE "OsceSession"
    ADD CONSTRAINT "OsceSession_caseId_fkey"
    FOREIGN KEY ("caseId")
    REFERENCES "PatientEncounterCase"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Add foreign key constraint for SpbenchScore.sessionId -> OsceSession.id
ALTER TABLE "SpbenchScore"
    ADD CONSTRAINT "SpbenchScore_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "OsceSession"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
