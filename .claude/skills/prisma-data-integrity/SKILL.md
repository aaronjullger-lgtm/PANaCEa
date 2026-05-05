---
name: prisma-data-integrity
description: "PANaCEa Prisma/Postgres integrity skill. Use for schema changes, migrations, model relationships, indexes, enums, query patterns, scripts that mutate data, Edge-safe Prisma usage, and investigation of wrong/missing/duplicated learning or content data."
---

# Prisma Data Integrity

`prisma/schema.prisma` is the source of truth. Ask before migrations or destructive data operations.

## First Files

- `prisma/schema.prisma`
- Owning service/endpoint for the write path
- Existing scripts in `scripts/db/`, `scripts/maintenance/`, or relevant generator/ingestion folders
- `functions/api/_shared/prisma-edge.ts` for Edge lifecycle

## Core Model Clusters

- Learning: `Question`, `QuestionAttempt`, `ReviewLog`, `UserProgress`, `StudySession`
- Content: `Condition`, `MedicalContent`, `MedicalContentStructured`, `MedicalContentEmbedding`, `MediaAsset`
- Generation/staging: `QuestionSeed`, `QuestionVariant`, `QuestionVersion`, `QuestionSubmission`
- Auth/admin/audit: user and role models, `AuditLog`
- Background work: reservoir, job, cron, and aggregate models

## Workflow

1. Trace UI/API -> service -> Prisma model.
2. Identify the canonical writer before adding another mutation path.
3. Check required fields, defaults, unique constraints, relation names, indexes, cascade behavior, and enum casing.
4. For new fields, define backfill/null semantics before migration.
5. Update typed service boundaries; let TypeScript reveal callers.
6. Add targeted tests for normalization, service mutation shape, endpoint contract, and idempotency where applicable.

## Edge Prisma

- Edge handlers use `createEdgePrismaClient(env.DATABASE_URL)`.
- Always disconnect in `finally`.
- Never import Prisma into frontend/browser code.
- Avoid raw SQL unless the existing path already uses it and the query is bounded/reviewed.

## Validation

- Schema/type impact: `npm run typecheck`
- Service/API mutation: targeted Vitest
- Broad data changes: `npm test`
- Existing audits: `npm run audit:prisma`, `npm run db:validate`, `npm run db:health`

## Common Traps

- Adding nullable fields without semantic meaning.
- Changing enums without mapping old values.
- Indexing fields that do not match real query predicates.
- Mutating live data by default instead of dry-run/explicit apply.
- Updating `routes/` DB logic while production `functions/api/` remains unchanged.
