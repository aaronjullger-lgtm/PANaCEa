# Medical Database Implementation Log

## Entry: 2026-05-02

### Slice
Medical database second-pass audit consolidation and implementation planning.

### Files Changed
- `MEDICAL_DATABASE_COMPLETENESS_AUDIT.md`
- `MEDICAL_KNOWLEDGE_SCHEMA_AUDIT.md`
- `CONDITIONS_COVERAGE_AUDIT.md`
- `MEDICATIONS_COVERAGE_AUDIT.md`
- `PROCEDURES_COVERAGE_AUDIT.md`
- `BLUEPRINT_AND_TAXONOMY_MAPPING_AUDIT.md`
- `MEDICAL_CONTENT_IMPLEMENTATION_PLAN.md`
- `MEDICAL_CONTENT_SEEDING_PLAN.md`
- `MEDICAL_DATABASE_FINAL_REPORT.md`

### Reason
The first-pass audit understated risks that became clear in deeper review: live content provenance is absent, medication classes are fragmented, question-drug linkage is missing, raw pharm drill generation can bypass approved-question safety gates, blueprint analytics can under-report attempts, and several routed medical surfaces still return mock or placeholder content.

### What Changed
Updated grades, P1/P2 findings, required tables, deprecated-content risk, seed requirements, QA requirements, and implementation order. The revised plan prioritizes learner-facing safety gates and taxonomy normalization before broader schema/content expansion.

### Verification
- `npx prisma validate --schema prisma/schema.prisma`
- `npx vitest run functions/api/_shared/condition-loader.test.ts`

### Result
Pass for schema validation and the targeted condition-loader unit test. Partial overall: the audit artifacts now reflect the deeper findings, but product code safety fixes are still pending.

### Remaining Risks
`/api/drills/pharm`, blueprint gap analytics, Rolling360/readiness projection, and mock guideline/placeholder routes still need code changes and tests.

### Follow-Up Tasks
- Gate or disable raw pharm drill generation for learner-facing use.
- Normalize `QuestionAttempt.systemNormalized` on all attempt write paths.
- Add `DrugClass`/`QuestionDrugLink` migration plan and backfill.
- Add deterministic provenance audit for `MedicalContent`.
- Replace mock/placeholder medical routes with unavailable responses or reviewed sources.

## Entry: 2026-05-02 00:08 EDT

### Slice
Question-generation condition source loading.

### Files Changed
- `functions/api/_shared/condition-loader.ts`
- `functions/api/_shared/condition-loader.test.ts`
- `MEDICAL_DATABASE_COMPLETENESS_AUDIT.md`
- `MEDICAL_KNOWLEDGE_SCHEMA_AUDIT.md`
- `CONDITIONS_COVERAGE_AUDIT.md`
- `MEDICATIONS_COVERAGE_AUDIT.md`
- `PROCEDURES_COVERAGE_AUDIT.md`
- `BLUEPRINT_AND_TAXONOMY_MAPPING_AUDIT.md`
- `MEDICAL_CONTENT_IMPLEMENTATION_PLAN.md`
- `MEDICAL_CONTENT_SEEDING_PLAN.md`
- `MEDICAL_DATABASE_FINAL_REPORT.md`

### Reason
The audit found that `functions/api/_shared/condition-loader.ts` queried `MedicalContent.name`, but the Prisma schema defines the condition display field as `MedicalContent.condition`. This could prevent `/api/questions/generate` from resolving approved clinical source content.

### What Changed
Updated the loader to query/select `condition`, map it back to the `ConditionData.name` API contract, and reuse a shared row mapper across exact, partial, system, and random condition loaders. Added a focused unit test covering exact lookup and non-exact loaders.

### Verification
`npx vitest run functions/api/_shared/condition-loader.test.ts`

### Result
Pass. 1 test file passed, 2 tests passed.

### Remaining Risks
Other generation paths still need grounding and approved-only serving fixes. `conditionId` remains overloaded across `Condition`, `MedicalContent`, and progress models.

### Follow-Up Tasks
- Add canonical condition/content identity migration.
- Update batch generation to require source content ids.
- Add approved-only checks to learner-facing pre-generated question reads.
- Add seed completeness and relationship integrity checks.
