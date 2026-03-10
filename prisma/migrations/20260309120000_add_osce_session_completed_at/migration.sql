-- Add completedAt to PatientEncounterSession for OSCE completion audit
ALTER TABLE "PatientEncounterSession" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
