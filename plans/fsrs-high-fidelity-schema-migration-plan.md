# FSRS High‑Fidelity Learning Curve Schema Migration Plan

## Objective
Add three new float columns to the `ReviewLog` table to store continuous rating, implicit confidence, and computed retrievability, enabling high‑precision learning‑curve analysis without breaking existing queries.

## Target Schema Changes
```prisma
// In schema.prisma, modify the ReviewLog model:

model ReviewLog {
  // ... existing fields ...

  // NEW: Continuous FSRS rating (1.0–4.0)
  grade_continuous      Float?   @map("grade_continuous")

  // NEW: Implicit confidence derived from behavioral telemetry (0.5–0.95)
  implicit_confidence   Float?   @map("implicit_confidence")

  // UPDATED: Currently nullable; will be computed and stored as a float
  retrievability        Float?   // remove default null, keep nullable for edge cases

  // ... keep existing grade (Int), stability (Float), difficulty (Float) ...
}
```

**Notes:**
- `grade_continuous` and `implicit_confidence` are nullable to allow backward compatibility (existing rows will have `NULL`).
- `retrievability` remains nullable but will be populated for all new reviews where FSRS state is not New.
- Column names use snake_case to match the existing naming convention (`time_to_first_interaction`, `hover_oscillations`).
- No changes to indexes are required because these columns are not used in high‑frequency filtering.

## Migration Steps

### 1. Create a New Prisma Migration
```bash
npx prisma migrate dev --name add_fsrs_high_fidelity_columns
```

Expected generated SQL (PostgreSQL):
```sql
ALTER TABLE "ReviewLog"
ADD COLUMN grade_continuous DOUBLE PRECISION,
ADD COLUMN implicit_confidence DOUBLE PRECISION;
-- retrievability column already exists as FLOAT, no change needed
```

### 2. Update the Edge Client
Because the project uses `@prisma/client/edge` in Cloudflare Functions, regenerate the Edge client after the migration:
```bash
npm run deploy:hook
# or the project‑specific command that triggers Edge client generation
```

### 3. Verify Column Presence
Run a quick query to confirm the columns exist:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ReviewLog'
  AND column_name IN ('grade_continuous', 'implicit_confidence', 'retrievability');
```

### 4. Backfill Existing Data (Optional)
Existing `ReviewLog` rows can be backfilled from the `telemetry` JSON column:
```sql
UPDATE "ReviewLog"
SET
  grade_continuous = (telemetry->'server_computed'->>'grade_continuous')::float,
  implicit_confidence = (telemetry->'server_computed'->>'implicit_confidence')::float,
  retrievability = NULL; -- cannot be derived retroactively
```
**Decision:** Backfilling is not required for the new feature to work, but can be performed later if needed for analytics.

## Impact Assessment
### Breaking Changes
- None. New columns are nullable; all existing application code continues to work.
- The `retrievability` column remains nullable; existing code that expects `null` will still receive `null` for old rows.

### Performance
- Adding two nullable float columns has negligible storage overhead (~16 bytes per row).
- No new indexes → no write penalty.
- Read performance unaffected.

### Data Consistency
- The `drillReviewService` will populate the new columns for all new reviews (Main session, non‑rapid‑guess, with conditionId).
- The service already computes `gradeContinuous` and `implicitConfidence`; we merely persist them to dedicated columns.
- Retrievability will be computed via `fsrs.calculateRetrievability(elapsed_days, stability)`.

## Rollback Plan
If the migration causes unexpected issues, revert with:
```sql
ALTER TABLE "ReviewLog"
DROP COLUMN grade_continuous,
DROP COLUMN implicit_confidence;
```
(No need to revert `retrievability` as it already existed.)

## Deployment Checklist
- [ ] Run migration in a development environment and verify `prisma migrate dev` succeeds.
- [ ] Regenerate Edge client and confirm no TypeScript errors in Cloudflare Functions.
- [ ] Update `drillReviewService.ts` to populate the new columns (see implementation plan).
- [ ] Run the newly written unit tests (`drillReviewService.test.ts`) to confirm they pass with the updated service.
- [ ] Deploy migration to staging, run smoke tests.
- [ ] Deploy migration to production during low‑traffic window.
- [ ] Monitor error logs for any issues related to the new columns.

## Timeline
- Migration creation: 5 minutes
- Edge client regeneration: 2 minutes
- Service update: 15 minutes
- Testing and validation: 30 minutes
- Production deployment: 10 minutes (zero‑downtime)

## Dependencies
- Prisma version: compatible with current project.
- Database: PostgreSQL (already used).
- Cloudflare Pages: Edge client must be regenerated after schema change.

## Next Steps
1. Obtain approval for this migration plan.
2. Switch to **Code** mode to implement the service updates.
3. Execute the migration and verify functionality.
4. Update analytics dashboards to use the new columns (optional).