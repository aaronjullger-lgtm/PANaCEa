-- ============================================================================
-- Proposed migration: add version column to PersonalizedFSRSParams
-- Date: 2026-04-23
-- Status: DRAFT — awaiting Aaron's approval to apply.
-- Paired with: prisma/schema.prisma PersonalizedFSRSParams.version field
--              (already added), lib/fsrs-v7.ts FSRSAlgorithmVersion type,
--              functions/api/user/fsrs-params.ts POST handler (persists
--              version via `as any` cast until this column exists).
--
-- Context:
-- The FSRS v7-alpha opt-in path (see lib/fsrs-v7.ts) runs a 29-parameter
-- forgetting curve while v6 uses 21. Today the version is INFERRED from
-- w.length (21 -> "6", 29 -> "7-alpha") in
-- lib/fsrs-version-selector.ts -> inferVersion(). This works correctly but
-- makes three pre-existing cases hard to distinguish at an admin-tool
-- level:
--   1. A user whose optimizer has never run (no PersonalizedFSRSParams
--      row at all) -- their scheduler uses defaultParameters.
--   2. A user whose v6 optimizer ran but failed to converge (21-length w,
--      near-default values).
--   3. A user explicitly enrolled in v7-alpha secondary validation
--      (29-length w).
--
-- Without a persisted tag, case (3) is only distinguishable from (2) by
-- counting w[]. An explicit `version` string makes admin dashboards and
-- calibration-stratification queries unambiguous.
--
-- This migration is OPTIONAL. The codebase works without it via inference.
-- Apply when admin observability tooling needs the explicit tag.
--
-- Backfill semantics:
--   - Existing rows with w.length === 21  -> default "6" (DDL default)
--   - Existing rows with w.length === 29  -> NEED UPDATE to "7-alpha"
--     (but zero such rows are expected today since v7-alpha is not yet
--      enrolled; the UPDATE is defensive)
--
-- Apply via:
--   npx prisma migrate dev --name add_personalized_fsrs_params_version
-- or Supabase MCP apply_migration once reconnected.
-- ============================================================================

ALTER TABLE "PersonalizedFSRSParams"
  ADD COLUMN "version" TEXT NOT NULL DEFAULT '6';

-- Defensive backfill: any 29-length row (v7-alpha) gets tagged "7-alpha".
-- Runs safely even when no such rows exist -- WHERE clause filters to zero.
UPDATE "PersonalizedFSRSParams"
  SET "version" = '7-alpha'
  WHERE array_length("w", 1) = 29;

-- Constraint: version must be a known algorithm tag. Matches the TypeScript
-- FSRSAlgorithmVersion union in lib/fsrs-v7.ts -- if you add a new version
-- tag (e.g. '7') update this constraint AND the union type together.
ALTER TABLE "PersonalizedFSRSParams"
  ADD CONSTRAINT "PersonalizedFSRSParams_version_check"
  CHECK ("version" IN ('6', '7-alpha'));

-- Observability index (optional): lets admin queries filter by version cheaply.
-- Skip for small tables (under 10k rows).
CREATE INDEX IF NOT EXISTS "PersonalizedFSRSParams_version_idx"
  ON "PersonalizedFSRSParams"("version");
