---
name: "panacea-identity-migration"
description: "Use to design and implement PANaCEa's canonical question identity and concept identity migrations, schema changes, backfill scripts, database probes, and identity contract rollout. Trigger when working on question identity, source identity, concept identity, QuestionIdentity model, identity migration, or normalized study schema."
---

# PANaCEa Identity Migration

You own the canonical identity migration — the P0 blocker for production. Your job: migrate PANaCEa from legacy ID-based content references to durable, source-tracked canonical identities.

## First Files

- `CLAUDE.md` for repo invariants
- `prisma/schema.prisma` — current schema with `QuestionIdentity` model and nullable identity links
- `prisma/migrations/20260517000000_add_question_identity_contract/migration.sql` — current migration
- `docs/database/normalized-study-schema.md` — identity contract documentation
- `prisma/README.md` — schema documentation
- `lib/study/questionIdentityPersistence.ts` — server-side identity helpers
- `lib/study/questionIdentity.ts` — identity type definitions
- `scripts/db/audit-learning-identity.ts` — identity audit probe
- `APP_FUNCTIONALITY_PLAN.md` — current blockers
- `NEXT_IMPLEMENTATION_PLAN.md` — identity migration tasks

## Current State

The additive migration layer EXISTS but is not deployed:
- `QuestionIdentity` model created with nullable FK links on `Card`, `QuestionAttempt`, `ReviewLog`, `SavedQuestion`, `StudySessionQuestion`
- Runtime writers already dual-write `questionIdentityId` where available
- Identity resolution helpers exist in `lib/study/questionIdentityPersistence.ts`
- Audit probe scripts check for table existence and coverage

## What Still Needs Doing

### P0: Canonical Question/Source Identity Migration
- Apply the existing migration to production
- Backfill `QuestionIdentity` rows for all existing `Question`, `PreGeneratedQuestion`, `StagingQuestion`, and `QuestionSeed` sources
- Backfill `questionIdentityId` on existing `Card`, `QuestionAttempt`, `ReviewLog`, `SavedQuestion`, and `StudySessionQuestion` rows
- Make identity FK columns non-nullable after backfill verification
- Remove legacy ID-based join paths after identity is universal

### P0: Condition/Content Identity Migration
- Design `ContentIdentity` model for `MedicalContent`, `Drug`, `Condition`
- Add nullable `contentIdentityId` to `UserProgress`, review-linked tables
- Migration design and backfill plan
- Apply and verify

### P1: Identity Contract Hardening
- `QuestionIdentity` lookup should be the canonical path for all content references
- Remove or deprecate legacy `sourceQuestionId`/`canonicalQuestionId` dual-ID patterns
- Ensure all read paths resolve through identity, not raw FKs

## Rules

- Never run production migrations without explicit approval
- All migrations must be additive first (nullable columns → backfill → non-nullable)
- Every migration must have a rollback plan
- Probe scripts must work before AND after migration (skip gracefully pre-migration)
- Backfill scripts must be idempotent (safe to re-run)
- Identity resolution must fall back safely when FKs are not yet available
- Do not change existing runtime writers unless identity contract changes

## Common Traps

- Forgetting to backfill existing rows before making columns non-nullable
- Not updating read paths that still join on legacy IDs
- Missing identity links in drill session manager (non-main sessions)
- Sync compatibility paths that write without identity
- Express compatibility routes that bypass identity

## Tests To Look For

- `lib/study/questionIdentity.test.ts`
- `lib/study/questionIdentityPersistence.test.ts`
- `tests/learningIdentityAudit.test.ts`
- `functions/api/study/session-generate.test.ts` — identity in session generation
- `tests/drillReviewService.test.ts` — identity in review writes
- `functions/api/questions/attempt.test.ts` — identity in attempt recording
- `functions/api/questions/record.test.ts` — identity in record path
- `functions/api/sync.saved-question-identity.test.ts` — identity in sync
- `tests/express-sync.test.ts` — identity in Express compatibility

## Verification

```bash
npx prisma validate
npx vitest run lib/study/questionIdentity*.test.ts tests/learningIdentityAudit.test.ts functions/api/study/session-generate.test.ts tests/drillReviewService.test.ts functions/api/questions/attempt.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
npm run test:critical
```
