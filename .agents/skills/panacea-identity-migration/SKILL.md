---
name: "panacea-identity-migration"
description: "Use to design, implement, audit, and verify PANaCEa's canonical question/source identity migration and condition/content identity migration — the P0 schema blockers. Trigger when working on QuestionIdentity, identity columns, migration scripts, backfill, identity probes, or the normalized study schema rollout."
---

# PANaCEa Identity Migration

You own the P0 identity migration: enabling canonical question identity and condition/content identity across the schema, without breaking existing read/write paths.

## First Files

- `prisma/schema.prisma` — current schema, identity columns, QuestionIdentity model
- `prisma/migrations/20260517000000_add_question_identity_contract/migration.sql` — existing additive migration
- `docs/database/normalized-study-schema.md` — identity contract documentation
- `prisma/README.md` — migration notes
- `lib/study/questionIdentityPersistence.ts` — server-side identity helpers
- `lib/study/questionIdentity.ts` — identity types and normalization
- `scripts/db/audit-learning-identity.ts` — existing audit/probe script
- `functions/api/study/session/generate.ts` — identity writing in session generation
- `lib/services/drillReviewService.ts` — identity writing in review submission
- `functions/api/questions/attempt.ts` — identity writing in attempt recording
- `APP_FUNCTIONALITY_PLAN.md` — current P0 blockers

## Current State

- `QuestionIdentity` model and nullable FK columns exist in schema
- Migration `20260517000000` adds identity columns with deterministic backfill for `Question`, `PreGeneratedQuestion`, `StagingQuestion`, and `QuestionSeed` sources
- Active runtime writers dual-write `questionIdentityId` to session questions, attempts, review logs, saved questions, and cards
- Audit probe script can check rollout state
- **Not yet applied to production** — this is the P0 blocker

## Migration Tasks

### 1. Probe Current State
Run `npm run db:audit-learning-identity` to check:
- Does the `question_identities` table exist?
- Are nullable identity columns present?
- Which source types have unresolved identity targets?
- What percentage of rows have `questionIdentityId` populated?

### 2. Design Migration Plan
- Confirm migration order: `question_identities` table → FK columns → backfill
- Verify backfill scripts handle all source types (Question, PreGeneratedQuestion, StagingQuestion, QuestionSeed)
- Ensure zero-downtime: additive columns, nullable FKs, no data loss
- Plan rollback path

### 3. Execute and Verify
- Run migration
- Run backfill
- Verify probe reports 100% coverage
- Run critical FSRS/session tests

### 4. Condition/Content Identity (Next)
- Design condition identity migration for `UserProgress.conditionId` → `MedicalContent.id`
- Map condition-linked review writes
- Probe, migrate, backfill, verify

## Rules

- Never run production migrations without explicit approval
- All identity migrations must be additive (no column drops, no data loss)
- Backfill scripts must be idempotent
- Existing read/write paths must continue working during rollout
- Nullable FKs are intentional — allow gradual adoption
- Test with `npm run test:critical` after any migration script change

## Tests To Look For

- `lib/study/questionIdentityPersistence.test.ts`
- `lib/study/questionIdentity.test.ts`
- `lib/sessionGeneration.test.ts`
- `functions/api/study/session-generate.test.ts`
- `tests/drillReviewService.test.ts`
- `functions/api/questions/attempt.test.ts`
- `functions/api/questions/record.test.ts`
- `functions/api/sync.saved-question-identity.test.ts`
- `tests/learningIdentityAudit.test.ts`
- `tests/express-sync.test.ts`

## Verification

```bash
npm run db:audit-learning-identity
npx prisma validate
npx vitest run lib/study/questionIdentity*.test.ts tests/learningIdentityAudit.test.ts
npm run test:critical
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
```

## Hard Guardrails

- Do not run production migrations without explicit Aaron approval
- Do not drop existing columns during rollout
- Do not make identity columns non-nullable until backfill is confirmed
- Preserve legacy question ID fields for backward compatibility
- Document every migration step in `docs/database/`
