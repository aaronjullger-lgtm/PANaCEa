-- Add new scoring dimension columns to OsceResult
ALTER TABLE "OsceResult" ADD COLUMN IF NOT EXISTS "differentialScore" DOUBLE PRECISION;
ALTER TABLE "OsceResult" ADD COLUMN IF NOT EXISTS "communicationScore" DOUBLE PRECISION;
ALTER TABLE "OsceResult" ADD COLUMN IF NOT EXISTS "dangerousActionsDetected" JSONB;

-- Add classification columns to PatientEncounterCase
ALTER TABLE "PatientEncounterCase" ADD COLUMN IF NOT EXISTS "targetSystem" TEXT;
ALTER TABLE "PatientEncounterCase" ADD COLUMN IF NOT EXISTS "difficulty" TEXT;
