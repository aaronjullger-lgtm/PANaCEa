---
name: "panacea-content-refinery"
description: "Use this skill for PANaCEa clinical content library, refinery, ingestion, enrichment, AI question generation, staging review, media approval, reservoir refill, citations, guideline/RAG content, and quality loops. It is repo-specific and should be used instead of generic content-generation guidance for PANaCEa content workflows."
---

# PANaCEa Content Refinery

Use for content generation, ingestion, enrichment, media, staging, question pools, and content quality dashboards.

## First Files By Surface

- Content API: `functions/api/content/*`, `functions/api/conditions/*`, `functions/api/admin/content/*`
- Refinery/admin: `functions/api/admin/refinery/*`, `functions/api/admin/staging/*`, `components/admin/*`, `pages/admin/*`
- Generation: `functions/api/_shared/aiQuestionService.ts`, `functions/api/_shared/question-generator.ts`, `lib/services/question/generationService.ts`
- Validation: `functions/api/_shared/question-validator.ts`, `functions/api/_shared/question-schema.ts`, `lib/services/questionReviewGate.ts`
- Search/RAG: `lib/services/search/*`, `lib/services/ragContextService.ts`, `functions/api/_shared/content-search.ts`
- Reservoir: `lib/services/reservoir/*`, `functions/api/cron/reservoir-maintenance.ts`
- Scripts: `scripts/db/*`, `scripts/refinery/*`, `scripts/generators/*`, `scripts/images/*`

## Clinical Content Rules

- Preserve PA/PANCE/PANRE relevance; do not broaden to generic medical trivia.
- Use `Condition`/`MedicalContent` as source-of-truth candidates before adding parallel registries.
- Generated questions need board-style stems, unambiguous correct answers, plausible distractors, and explanation quality.
- Citation/provenance fields are not decoration. Preserve them through ingestion and UI display when present.
- Media workflows must track source, approval state, storage path, and condition/entity linkage.

## Workflow

1. Identify whether the task is ingestion, enrichment, generation, review, serving, or analytics.
2. Trace the data model in `prisma/schema.prisma`.
3. Find the existing owner script or endpoint; extend it instead of creating a parallel pipeline.
4. Keep generated/staged content separate from approved/published content until review gates pass.
5. Run validators before surfacing content to students.
6. Update admin UI only after the backend contract is clear.

## Quality Gates

- Validate generated/staged questions with repo validators.
- Check content status transitions for draft/staged/published/rejected flows.
- For search/RAG, verify retrieval returns the intended source type and citation metadata.
- For reservoir changes, check no-repeat, TTL, priority, and question freshness behavior.
- For scripts, default to dry-run when there is any mutation risk.

## Useful Commands

- `npm run db:quality`
- `npm run db:completeness`
- `npm run db:health`
- `npm run assess:adequacy`
- `npm run content-doctor:phase1`
- `npm run benchmark:relevance`
- `npm run images:status`

## Common Traps

- Treating `src/conditionContent.generated.*` as the only content source
- Publishing AI output without staging/validator checks
- Dropping provenance during transformations
- Creating content scripts that do not support incremental/idempotent runs
- Updating question generation without checking downstream `Question` and `PreGeneratedQuestion` consumers
