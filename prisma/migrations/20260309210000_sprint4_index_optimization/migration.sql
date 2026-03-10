-- Sprint 4: Database Index Optimization
-- Additive migration - hot path indexes per Next Five Sprints plan

-- Composite index for user performance queries (ORDER BY timestamp DESC)
CREATE INDEX IF NOT EXISTS "PerformanceRecord_userId_timestamp_idx"
  ON "PerformanceRecord"("userId", "timestamp" DESC);

-- Composite index for condition/library queries
CREATE INDEX IF NOT EXISTS "MedicalContent_system_conditionId_idx"
  ON "MedicalContent"("system", "conditionId");

-- Composite index for question attempts by user+system
CREATE INDEX IF NOT EXISTS "QuestionAttempt_userId_system_createdAt_idx"
  ON "QuestionAttempt"("userId", "system", "createdAt" DESC);

-- GIN indexes for array search (Drug lookup, buzzword search)
CREATE INDEX IF NOT EXISTS "Drug_drugClass_gin_idx"
  ON "Drug" USING GIN ("drugClass");

CREATE INDEX IF NOT EXISTS "Drug_indications_gin_idx"
  ON "Drug" USING GIN ("indications");

CREATE INDEX IF NOT EXISTS "MedicalContent_buzzwords_gin_idx"
  ON "MedicalContent" USING GIN ("buzzwords");

-- Junction tables: medicalContentId indexes (DrugConditionLink, LabConditionLink, ECGConditionLink)
-- Already exist in schema; no-op if present:
CREATE INDEX IF NOT EXISTS "DrugConditionLink_medicalContentId_idx"
  ON "DrugConditionLink"("medicalContentId");

CREATE INDEX IF NOT EXISTS "LabConditionLink_medicalContentId_idx"
  ON "LabConditionLink"("medicalContentId");

CREATE INDEX IF NOT EXISTS "ECGConditionLink_medicalContentId_idx"
  ON "ECGConditionLink"("medicalContentId");
