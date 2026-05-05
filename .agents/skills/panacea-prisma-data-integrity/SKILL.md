---
name: "panacea-prisma-data-integrity"
description: "Use this skill for PANaCEa database work: Prisma schema changes, migrations, Supabase/Postgres data integrity, model relationships, indexes, enums, content tables, user progress, ReviewLog, QuestionAttempt, MedicalContent, Condition, and scripts that read or write production-like data."
---

# PANaCEa Prisma Data Integrity

Use when a task touches `prisma/schema.prisma`, migration scripts, database maintenance scripts, or services/endpoints that persist learning/content data.

## First Files

- `CLAUDE.md`
- `prisma/schema.prisma`
- The service or endpoint that owns the write path
- Existing scripts in `scripts/db/` or `scripts/maintenance/` before creating new scripts
- Relevant tests near `lib/services/*.test.ts`, `functions/api/_shared/__tests__`, or `tests/`

## Approval Boundary

Ask before running Prisma migrations or destructive data operations. It is fine to inspect schema, run typecheck/tests, write migration-ready code, and create non-destructive validation scripts.

## Model Clusters

- Learning pipeline: `Question`, `QuestionAttempt`, `ReviewLog`, `UserProgress`, `StudySession`
- Content library: `Condition`, `MedicalContent`, `MedicalContentStructured`, `MedicalContentEmbedding`, `MediaAsset`
- Generation/staging: `QuestionSeed`, `QuestionVariant`, `QuestionVersion`, `QuestionSubmission`
- Auth/admin: `User`, `UserRole`, audit log models
- Background work: job, cron, reservoir, queue, and analytics aggregate models

Always read the exact model before assuming field names, enum casing, uniqueness, or relation names.

## Change Workflow

1. Trace the write path from UI/API to service to Prisma model.
2. Identify the canonical owner of the data mutation. Do not add a second writer unless the current owner cannot support the workflow.
3. Check uniqueness, cascade behavior, required fields, default values, and indexes in `schema.prisma`.
4. If adding fields, decide how existing rows get valid data before any migration is applied.
5. Update typed service boundaries first; let TypeScript reveal downstream callers.
6. Add integrity tests for pure normalization logic and endpoint/service tests for DB mutation shape.

## Prisma In PANaCEa

- Edge endpoints use `functions/api/_shared/prisma-edge.ts`.
- Server-only service logic can live in `lib/services/` or `functions/api/_shared/`.
- Frontend must never import Prisma. Browser imports of `@prisma/client` are a bug even though Vite has a stub.
- Always use repo cleanup helpers for Prisma lifecycle in Edge code.

## Validation

Pick the smallest useful set:

- Schema/type impact: `npm run typecheck`
- DB write-path tests: targeted `npx vitest run <test-file>`
- Broad model changes: `npm test`
- Production build risk: `npm run build`
- Existing audits when relevant: `npm run audit:prisma`, `npm run db:validate`, `npm run db:health`

## Common Traps

- Adding nullable fields without defining their semantic empty state
- Changing enum values without mapping existing frontend string literals
- Adding indexes that do not match actual query predicates
- Writing scripts that mutate live data by default instead of requiring dry-run/explicit apply
- Updating `routes/` DB logic and missing the production `functions/api/` path
