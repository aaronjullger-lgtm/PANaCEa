-- Add version column to PersonalizedFSRSParams for FSRS algorithm version tracking.
-- Schema declaration: prisma/schema.prisma PersonalizedFSRSParams.version @default("6")
-- Paired with: lib/fsrs-v7.ts FSRSAlgorithmVersion, lib/fsrs-version-selector.ts

ALTER TABLE "PersonalizedFSRSParams"
  ADD COLUMN IF NOT EXISTS "version" TEXT NOT NULL DEFAULT '6';

-- Defensive backfill: tag 29-param rows as v7-alpha (currently zero such rows expected)
UPDATE "PersonalizedFSRSParams"
  SET "version" = '7-alpha'
  WHERE array_length("w", 1) = 29;

-- Constraint: version must be a known algorithm tag
ALTER TABLE "PersonalizedFSRSParams"
  ADD CONSTRAINT "PersonalizedFSRSParams_version_check"
  CHECK ("version" IN ('6', '7-alpha'));

-- Observability index for admin version-filtered queries
CREATE INDEX IF NOT EXISTS "PersonalizedFSRSParams_version_idx"
  ON "PersonalizedFSRSParams"("version");
