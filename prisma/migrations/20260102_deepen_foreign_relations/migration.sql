-- Migration: Deepen Foreign Key Relationships
-- Purpose: Intertwine tables for efficient API queries and reduced latency
-- Date: 2026-01-02

-- =============================================================================
-- PART 1: Add FK columns to existing tables (nullable to not break existing data)
-- =============================================================================

-- Question → Condition link
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "conditionId" TEXT;

-- QuestionAttempt → proper FK relations
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;

-- ScoringSystem → Condition link
ALTER TABLE "ScoringSystem" ADD COLUMN IF NOT EXISTS "conditionId" TEXT;

-- ClinicalPearl → Condition link
ALTER TABLE "ClinicalPearl" ADD COLUMN IF NOT EXISTS "conditionId" TEXT;

-- ConfusionPair → Condition links (both sides)
ALTER TABLE "ConfusionPair" ADD COLUMN IF NOT EXISTS "realConditionId" TEXT;
ALTER TABLE "ConfusionPair" ADD COLUMN IF NOT EXISTS "mistakenForId" TEXT;
ALTER TABLE "ConfusionPair" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;

-- WeaknessPattern → User FK
ALTER TABLE "WeaknessPattern" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;
ALTER TABLE "WeaknessPattern" ADD COLUMN IF NOT EXISTS "conditionId_fk" TEXT;

-- DifferentialDiagnosis → Primary Condition link  
ALTER TABLE "DifferentialDiagnosis" ADD COLUMN IF NOT EXISTS "primaryConditionId" TEXT;

-- VitalSignRange → Condition links (for associated conditions)
-- Already has associatedConditions as JSON, but we'll create a proper link table

-- StudySession → User FK (critical for analytics)
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;

-- UserLearningProfile → User FK  
ALTER TABLE "UserLearningProfile" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;

-- ACLSAlgorithm → ECGPattern link
ALTER TABLE "ACLSAlgorithm" ADD COLUMN IF NOT EXISTS "ecgPatternId" TEXT;

-- BaselineAssessment → User FK
ALTER TABLE "BaselineAssessment" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;

-- QuestionFlag → User FK
ALTER TABLE "QuestionFlag" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;

-- PreGeneratedQuestion → Condition FK
ALTER TABLE "PreGeneratedQuestion" ADD COLUMN IF NOT EXISTS "conditionId_fk" TEXT;

-- QuestionSeed → Condition FK
ALTER TABLE "QuestionSeed" ADD COLUMN IF NOT EXISTS "conditionId_fk" TEXT;

-- SavedQuestion → Condition FK
ALTER TABLE "SavedQuestion" ADD COLUMN IF NOT EXISTS "conditionId" TEXT;

-- ExplanationReaction → User FK
ALTER TABLE "ExplanationReaction" ADD COLUMN IF NOT EXISTS "userId_fk" TEXT;

-- =============================================================================
-- PART 2: Create new junction/link tables for many-to-many relationships
-- =============================================================================

-- Differential Diagnosis ↔ Condition (many conditions per differential)
CREATE TABLE IF NOT EXISTS "DifferentialConditionLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "differentialId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "rankOrder" INTEGER DEFAULT 0,
  "likelihood" TEXT, -- 'common', 'less_common', 'rare', 'must_not_miss'
  "distinguishingFeatures" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DifferentialConditionLink_differentialId_conditionId_key" UNIQUE("differentialId", "conditionId")
);

-- Antibiotic ↔ Condition (which conditions an antibiotic treats)
CREATE TABLE IF NOT EXISTS "AntibioticConditionLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "antibioticId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "isFirstLine" BOOLEAN DEFAULT false,
  "evidenceLevel" TEXT,
  "dosing" TEXT,
  "duration" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AntibioticConditionLink_antibioticId_conditionId_key" UNIQUE("antibioticId", "conditionId")
);

-- Vital Sign ↔ Condition (which conditions affect vital signs)
CREATE TABLE IF NOT EXISTS "VitalSignConditionLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "vitalSignId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "expectedChange" TEXT, -- 'elevated', 'decreased', 'variable'
  "typicalRange" TEXT,
  "clinicalSignificance" TEXT,
  "isEmergency" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VitalSignConditionLink_vitalSignId_conditionId_key" UNIQUE("vitalSignId", "conditionId")
);

-- Scoring System ↔ Condition (direct link table)
CREATE TABLE IF NOT EXISTS "ScoringSystemConditionLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scoringSystemId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "usageContext" TEXT, -- 'diagnosis', 'prognosis', 'risk_stratification'
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoringSystemConditionLink_scoringSystemId_conditionId_key" UNIQUE("scoringSystemId", "conditionId")
);

-- Clinical Pearl ↔ Condition (pearls can relate to multiple conditions)
CREATE TABLE IF NOT EXISTS "PearlConditionLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pearlId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "relevance" TEXT, -- 'primary', 'secondary', 'differential'
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PearlConditionLink_pearlId_conditionId_key" UNIQUE("pearlId", "conditionId")
);

-- Drug ↔ Drug interactions (self-referential many-to-many)
CREATE TABLE IF NOT EXISTS "DrugInteraction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "drugId1" TEXT NOT NULL,
  "drugId2" TEXT NOT NULL,
  "severity" TEXT NOT NULL, -- 'major', 'moderate', 'minor'
  "mechanism" TEXT,
  "clinicalEffect" TEXT,
  "management" TEXT,
  "isContraindicated" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrugInteraction_drugId1_drugId2_key" UNIQUE("drugId1", "drugId2")
);

-- Condition ↔ Condition (related/differential conditions)
CREATE TABLE IF NOT EXISTS "ConditionRelation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conditionId1" TEXT NOT NULL,
  "conditionId2" TEXT NOT NULL,
  "relationType" TEXT NOT NULL, -- 'differential', 'complication', 'precursor', 'associated'
  "bidirectional" BOOLEAN DEFAULT true,
  "clinicalContext" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConditionRelation_conditionId1_conditionId2_relationType_key" UNIQUE("conditionId1", "conditionId2", "relationType")
);

-- =============================================================================
-- PART 3: Add foreign key constraints
-- =============================================================================

-- Question → Condition
DO $$ BEGIN
  ALTER TABLE "Question" ADD CONSTRAINT "Question_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ScoringSystem → Condition
DO $$ BEGIN
  ALTER TABLE "ScoringSystem" ADD CONSTRAINT "ScoringSystem_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ClinicalPearl → Condition
DO $$ BEGIN
  ALTER TABLE "ClinicalPearl" ADD CONSTRAINT "ClinicalPearl_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ConfusionPair → Condition (realCondition)
DO $$ BEGIN
  ALTER TABLE "ConfusionPair" ADD CONSTRAINT "ConfusionPair_realConditionId_fkey" 
    FOREIGN KEY ("realConditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ConfusionPair → Condition (mistakenFor)
DO $$ BEGIN
  ALTER TABLE "ConfusionPair" ADD CONSTRAINT "ConfusionPair_mistakenForId_fkey" 
    FOREIGN KEY ("mistakenForId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ConfusionPair → User
DO $$ BEGIN
  ALTER TABLE "ConfusionPair" ADD CONSTRAINT "ConfusionPair_userId_fkey" 
    FOREIGN KEY ("userId_fk") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WeaknessPattern → User
DO $$ BEGIN
  ALTER TABLE "WeaknessPattern" ADD CONSTRAINT "WeaknessPattern_userId_fkey" 
    FOREIGN KEY ("userId_fk") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WeaknessPattern → Condition
DO $$ BEGIN
  ALTER TABLE "WeaknessPattern" ADD CONSTRAINT "WeaknessPattern_conditionId_fkey" 
    FOREIGN KEY ("conditionId_fk") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DifferentialDiagnosis → Condition
DO $$ BEGIN
  ALTER TABLE "DifferentialDiagnosis" ADD CONSTRAINT "DifferentialDiagnosis_primaryConditionId_fkey" 
    FOREIGN KEY ("primaryConditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- StudySession → User
DO $$ BEGIN
  ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" 
    FOREIGN KEY ("userId_fk") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- UserLearningProfile → User
DO $$ BEGIN
  ALTER TABLE "UserLearningProfile" ADD CONSTRAINT "UserLearningProfile_userId_fkey" 
    FOREIGN KEY ("userId_fk") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ACLSAlgorithm → ECGPattern
DO $$ BEGIN
  ALTER TABLE "ACLSAlgorithm" ADD CONSTRAINT "ACLSAlgorithm_ecgPatternId_fkey" 
    FOREIGN KEY ("ecgPatternId") REFERENCES "ECGPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BaselineAssessment → User
DO $$ BEGIN
  ALTER TABLE "BaselineAssessment" ADD CONSTRAINT "BaselineAssessment_userId_fkey" 
    FOREIGN KEY ("userId_fk") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- QuestionFlag → User
DO $$ BEGIN
  ALTER TABLE "QuestionFlag" ADD CONSTRAINT "QuestionFlag_userId_fkey" 
    FOREIGN KEY ("userId_fk") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PreGeneratedQuestion → Condition
DO $$ BEGIN
  ALTER TABLE "PreGeneratedQuestion" ADD CONSTRAINT "PreGeneratedQuestion_conditionId_fkey" 
    FOREIGN KEY ("conditionId_fk") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- QuestionSeed → Condition
DO $$ BEGIN
  ALTER TABLE "QuestionSeed" ADD CONSTRAINT "QuestionSeed_conditionId_fkey" 
    FOREIGN KEY ("conditionId_fk") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SavedQuestion → Condition
DO $$ BEGIN
  ALTER TABLE "SavedQuestion" ADD CONSTRAINT "SavedQuestion_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ExplanationReaction → User
DO $$ BEGIN
  ALTER TABLE "ExplanationReaction" ADD CONSTRAINT "ExplanationReaction_userId_fkey" 
    FOREIGN KEY ("userId_fk") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Junction table FKs
DO $$ BEGIN
  ALTER TABLE "DifferentialConditionLink" ADD CONSTRAINT "DifferentialConditionLink_differentialId_fkey" 
    FOREIGN KEY ("differentialId") REFERENCES "DifferentialDiagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DifferentialConditionLink" ADD CONSTRAINT "DifferentialConditionLink_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AntibioticConditionLink" ADD CONSTRAINT "AntibioticConditionLink_antibioticId_fkey" 
    FOREIGN KEY ("antibioticId") REFERENCES "AntibioticGuideline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AntibioticConditionLink" ADD CONSTRAINT "AntibioticConditionLink_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "VitalSignConditionLink" ADD CONSTRAINT "VitalSignConditionLink_vitalSignId_fkey" 
    FOREIGN KEY ("vitalSignId") REFERENCES "VitalSignRange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "VitalSignConditionLink" ADD CONSTRAINT "VitalSignConditionLink_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ScoringSystemConditionLink" ADD CONSTRAINT "ScoringSystemConditionLink_scoringSystemId_fkey" 
    FOREIGN KEY ("scoringSystemId") REFERENCES "ScoringSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ScoringSystemConditionLink" ADD CONSTRAINT "ScoringSystemConditionLink_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PearlConditionLink" ADD CONSTRAINT "PearlConditionLink_pearlId_fkey" 
    FOREIGN KEY ("pearlId") REFERENCES "ClinicalPearl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PearlConditionLink" ADD CONSTRAINT "PearlConditionLink_conditionId_fkey" 
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DrugInteraction" ADD CONSTRAINT "DrugInteraction_drugId1_fkey" 
    FOREIGN KEY ("drugId1") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DrugInteraction" ADD CONSTRAINT "DrugInteraction_drugId2_fkey" 
    FOREIGN KEY ("drugId2") REFERENCES "Drug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConditionRelation" ADD CONSTRAINT "ConditionRelation_conditionId1_fkey" 
    FOREIGN KEY ("conditionId1") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ConditionRelation" ADD CONSTRAINT "ConditionRelation_conditionId2_fkey" 
    FOREIGN KEY ("conditionId2") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- PART 4: Create indexes for new columns and tables
-- =============================================================================

CREATE INDEX IF NOT EXISTS "Question_conditionId_idx" ON "Question"("conditionId");
CREATE INDEX IF NOT EXISTS "ScoringSystem_conditionId_idx" ON "ScoringSystem"("conditionId");
CREATE INDEX IF NOT EXISTS "ClinicalPearl_conditionId_idx" ON "ClinicalPearl"("conditionId");
CREATE INDEX IF NOT EXISTS "ConfusionPair_realConditionId_idx" ON "ConfusionPair"("realConditionId");
CREATE INDEX IF NOT EXISTS "ConfusionPair_mistakenForId_idx" ON "ConfusionPair"("mistakenForId");
CREATE INDEX IF NOT EXISTS "WeaknessPattern_userId_fk_idx" ON "WeaknessPattern"("userId_fk");
CREATE INDEX IF NOT EXISTS "WeaknessPattern_conditionId_fk_idx" ON "WeaknessPattern"("conditionId_fk");
CREATE INDEX IF NOT EXISTS "DifferentialDiagnosis_primaryConditionId_idx" ON "DifferentialDiagnosis"("primaryConditionId");
CREATE INDEX IF NOT EXISTS "StudySession_userId_fk_idx" ON "StudySession"("userId_fk");
CREATE INDEX IF NOT EXISTS "UserLearningProfile_userId_fk_idx" ON "UserLearningProfile"("userId_fk");
CREATE INDEX IF NOT EXISTS "ACLSAlgorithm_ecgPatternId_idx" ON "ACLSAlgorithm"("ecgPatternId");
CREATE INDEX IF NOT EXISTS "BaselineAssessment_userId_fk_idx" ON "BaselineAssessment"("userId_fk");
CREATE INDEX IF NOT EXISTS "QuestionFlag_userId_fk_idx" ON "QuestionFlag"("userId_fk");
CREATE INDEX IF NOT EXISTS "PreGeneratedQuestion_conditionId_fk_idx" ON "PreGeneratedQuestion"("conditionId_fk");
CREATE INDEX IF NOT EXISTS "QuestionSeed_conditionId_fk_idx" ON "QuestionSeed"("conditionId_fk");
CREATE INDEX IF NOT EXISTS "SavedQuestion_conditionId_idx" ON "SavedQuestion"("conditionId");
CREATE INDEX IF NOT EXISTS "ExplanationReaction_userId_fk_idx" ON "ExplanationReaction"("userId_fk");

-- Junction table indexes
CREATE INDEX IF NOT EXISTS "DifferentialConditionLink_differentialId_idx" ON "DifferentialConditionLink"("differentialId");
CREATE INDEX IF NOT EXISTS "DifferentialConditionLink_conditionId_idx" ON "DifferentialConditionLink"("conditionId");
CREATE INDEX IF NOT EXISTS "DifferentialConditionLink_likelihood_idx" ON "DifferentialConditionLink"("likelihood");

CREATE INDEX IF NOT EXISTS "AntibioticConditionLink_antibioticId_idx" ON "AntibioticConditionLink"("antibioticId");
CREATE INDEX IF NOT EXISTS "AntibioticConditionLink_conditionId_idx" ON "AntibioticConditionLink"("conditionId");
CREATE INDEX IF NOT EXISTS "AntibioticConditionLink_isFirstLine_idx" ON "AntibioticConditionLink"("isFirstLine");

CREATE INDEX IF NOT EXISTS "VitalSignConditionLink_vitalSignId_idx" ON "VitalSignConditionLink"("vitalSignId");
CREATE INDEX IF NOT EXISTS "VitalSignConditionLink_conditionId_idx" ON "VitalSignConditionLink"("conditionId");
CREATE INDEX IF NOT EXISTS "VitalSignConditionLink_isEmergency_idx" ON "VitalSignConditionLink"("isEmergency");

CREATE INDEX IF NOT EXISTS "ScoringSystemConditionLink_scoringSystemId_idx" ON "ScoringSystemConditionLink"("scoringSystemId");
CREATE INDEX IF NOT EXISTS "ScoringSystemConditionLink_conditionId_idx" ON "ScoringSystemConditionLink"("conditionId");

CREATE INDEX IF NOT EXISTS "PearlConditionLink_pearlId_idx" ON "PearlConditionLink"("pearlId");
CREATE INDEX IF NOT EXISTS "PearlConditionLink_conditionId_idx" ON "PearlConditionLink"("conditionId");

CREATE INDEX IF NOT EXISTS "DrugInteraction_drugId1_idx" ON "DrugInteraction"("drugId1");
CREATE INDEX IF NOT EXISTS "DrugInteraction_drugId2_idx" ON "DrugInteraction"("drugId2");
CREATE INDEX IF NOT EXISTS "DrugInteraction_severity_idx" ON "DrugInteraction"("severity");

CREATE INDEX IF NOT EXISTS "ConditionRelation_conditionId1_idx" ON "ConditionRelation"("conditionId1");
CREATE INDEX IF NOT EXISTS "ConditionRelation_conditionId2_idx" ON "ConditionRelation"("conditionId2");
CREATE INDEX IF NOT EXISTS "ConditionRelation_relationType_idx" ON "ConditionRelation"("relationType");

-- =============================================================================
-- PART 5: Backfill FK values from existing string references where possible
-- =============================================================================

-- Backfill StudySession.userId_fk from userId string
UPDATE "StudySession" s
SET "userId_fk" = u.id
FROM "User" u
WHERE s."userId" = u.id AND s."userId_fk" IS NULL;

-- Backfill UserLearningProfile.userId_fk  
UPDATE "UserLearningProfile" ulp
SET "userId_fk" = u.id
FROM "User" u
WHERE ulp."userId" = u.id AND ulp."userId_fk" IS NULL;

-- Backfill BaselineAssessment.userId_fk
UPDATE "BaselineAssessment" ba
SET "userId_fk" = u.id
FROM "User" u
WHERE ba."userId" = u.id AND ba."userId_fk" IS NULL;

-- Backfill WeaknessPattern from existing conditionId string
UPDATE "WeaknessPattern" wp
SET "conditionId_fk" = c.id
FROM "Condition" c
WHERE wp."conditionId" = c.id AND wp."conditionId_fk" IS NULL;

-- Backfill WeaknessPattern.userId_fk
UPDATE "WeaknessPattern" wp
SET "userId_fk" = u.id
FROM "User" u
WHERE wp."userId" = u.id AND wp."userId_fk" IS NULL;

-- Backfill ConfusionPair from existing realCondition/mistakenFor strings
UPDATE "ConfusionPair" cp
SET "realConditionId" = c.id
FROM "Condition" c
WHERE cp."realCondition" = c.name AND cp."realConditionId" IS NULL;

UPDATE "ConfusionPair" cp
SET "mistakenForId" = c.id
FROM "Condition" c
WHERE cp."mistakenFor" = c.name AND cp."mistakenForId" IS NULL;

-- Backfill QuestionSeed.conditionId_fk
UPDATE "QuestionSeed" qs
SET "conditionId_fk" = c.id
FROM "Condition" c
WHERE qs."conditionId" = c.id AND qs."conditionId_fk" IS NULL;

-- Backfill PreGeneratedQuestion.conditionId_fk
UPDATE "PreGeneratedQuestion" pgq
SET "conditionId_fk" = c.id
FROM "Condition" c
WHERE pgq."conditionId" = c.id AND pgq."conditionId_fk" IS NULL;

-- Backfill QuestionFlag.userId_fk
UPDATE "QuestionFlag" qf
SET "userId_fk" = u.id
FROM "User" u
WHERE qf."userId" = u.id AND qf."userId_fk" IS NULL;

-- Backfill ScoringSystem.conditionId from condition string match
UPDATE "ScoringSystem" ss
SET "conditionId" = c.id
FROM "Condition" c
WHERE ss."condition" = c.name AND ss."conditionId" IS NULL;

COMMIT;
