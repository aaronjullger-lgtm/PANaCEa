-- Sprint 2: Database Performance Optimization Migration
-- Adds strategic indexes for hot paths and composite queries

-- ============================================================================
-- COMPOSITE INDEXES FOR HOT PATHS
-- ============================================================================

-- QuestionAttempt: userId + system + createdAt (analytics queries)
CREATE INDEX IF NOT EXISTS "QuestionAttempt_userId_system_createdAt_idx" 
  ON "QuestionAttempt"("userId", "system", "createdAt" DESC);

-- MedicalContent: system + conditionId (drill queries)
CREATE INDEX IF NOT EXISTS "MedicalContent_system_conditionId_idx" 
  ON "MedicalContent"("system", "conditionId");

-- ============================================================================
-- GIN INDEXES FOR ARRAY SEARCH
-- ============================================================================

-- Drug: drugClass array search
CREATE INDEX IF NOT EXISTS "Drug_drugClass_gin_idx" 
  ON "Drug" USING GIN ("drugClass");

-- Drug: indications array search
CREATE INDEX IF NOT EXISTS "Drug_indications_gin_idx" 
  ON "Drug" USING GIN ("indications");

-- MedicalContent: buzzwords array search
CREATE INDEX IF NOT EXISTS "MedicalContent_buzzwords_gin_idx" 
  ON "MedicalContent" USING GIN ("buzzwords");

-- MedicalContent: relatedSystems array search (if not exists)
CREATE INDEX IF NOT EXISTS "MedicalContent_relatedSystems_gin_idx" 
  ON "MedicalContent" USING GIN ("relatedSystems");

-- ============================================================================
-- JUNCTION TABLE INDEXES FOR FOREIGN KEY LOOKUPS
-- ============================================================================

-- DrugConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "DrugConditionLink_medicalContentId_idx" 
  ON "DrugConditionLink"("medicalContentId");

-- LabConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "LabConditionLink_medicalContentId_idx" 
  ON "LabConditionLink"("medicalContentId");

-- ECGConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "ECGConditionLink_medicalContentId_idx" 
  ON "ECGConditionLink"("medicalContentId");

-- ImagingConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "ImagingConditionLink_medicalContentId_idx" 
  ON "ImagingConditionLink"("medicalContentId");

-- FindingConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "FindingConditionLink_medicalContentId_idx" 
  ON "FindingConditionLink"("medicalContentId");

-- ProcedureConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "ProcedureConditionLink_medicalContentId_idx" 
  ON "ProcedureConditionLink"("medicalContentId");

-- PhysiologyConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "PhysiologyConditionLink_medicalContentId_idx" 
  ON "PhysiologyConditionLink"("medicalContentId");

-- TreatmentConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "TreatmentConditionLink_medicalContentId_idx" 
  ON "TreatmentConditionLink"("medicalContentId");

-- AnatomyConditionLink: medicalContentId lookup
CREATE INDEX IF NOT EXISTS "AnatomyConditionLink_medicalContentId_idx" 
  ON "AnatomyConditionLink"("medicalContentId");

-- ============================================================================
-- PARTIAL INDEXES FOR COMMON FILTERS
-- ============================================================================

-- High-yield conditions only (frequently filtered)
CREATE INDEX IF NOT EXISTS "Condition_isHighYield_true_idx" 
  ON "Condition"("panceYield" DESC) 
  WHERE "isHighYield" = true;

-- Approved MedicalContent only (production queries)
CREATE INDEX IF NOT EXISTS "MedicalContent_status_approved_idx" 
  ON "MedicalContent"("system", "subcategory") 
  WHERE "status" = 'approved';

-- Active study sessions only
CREATE INDEX IF NOT EXISTS "StudySession_active_idx" 
  ON "StudySession"("userId", "startedAt" DESC) 
  WHERE "completedAt" IS NULL;

-- ============================================================================
-- COVERING INDEXES FOR FREQUENT SELECT PATTERNS
-- ============================================================================

-- PerformanceRecord: Include commonly selected columns
CREATE INDEX IF NOT EXISTS "PerformanceRecord_userId_timestamp_covering_idx" 
  ON "PerformanceRecord"("userId", "timestamp" DESC) 
  INCLUDE ("isCorrect", "system", "topic");

-- QuestionAttempt: Include result columns for analytics
CREATE INDEX IF NOT EXISTS "QuestionAttempt_userId_createdAt_covering_idx" 
  ON "QuestionAttempt"("userId", "createdAt" DESC) 
  INCLUDE ("wasCorrect", "system", "conditionId", "timeSpentMs");

-- ============================================================================
-- TEXT SEARCH INDEXES
-- ============================================================================

-- MedicalContent: Full-text search on condition name
CREATE INDEX IF NOT EXISTS "MedicalContent_condition_trgm_idx" 
  ON "MedicalContent" USING gin (condition gin_trgm_ops);

-- Drug: Full-text search on drug name
CREATE INDEX IF NOT EXISTS "Drug_name_trgm_idx" 
  ON "Drug" USING gin (name gin_trgm_ops);

-- Enable pg_trgm extension if not exists (for fuzzy text search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE "QuestionAttempt";
ANALYZE "PerformanceRecord";
ANALYZE "MedicalContent";
ANALYZE "Drug";
ANALYZE "Condition";
ANALYZE "StudySession";
ANALYZE "SRSItem";
