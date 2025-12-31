-- Refactor Treatment table from drug-specific to protocol-focused
-- Remove drug-specific columns
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "mechanism";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "dosing";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "sideEffects";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "comparativeEfficacy";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "pregnancySafe";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "pregnancyNotes";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "pediatricUse";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "geriatricUse";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "renalDoseAdjust";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "hepaticDoseAdjust";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "estimatedCost";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "insuranceCoverage";
ALTER TABLE "Treatment" DROP COLUMN IF EXISTS "genericAvailable";

-- Add protocol-focused columns for special populations
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "pediatricConsiderations" TEXT;
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "geriatricConsiderations" TEXT;
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "pregnancyConsiderations" TEXT;

-- Update description to be TEXT type if not already
ALTER TABLE "Treatment" ALTER COLUMN "description" TYPE TEXT;

-- Add comment to clarify table purpose
COMMENT ON TABLE "Treatment" IS 'Treatment PROTOCOLS and management approaches (NOT individual drugs - use Drug table for pharmacology). Examples: STEMI Protocol, DKA Management, CAP Treatment Algorithm';
