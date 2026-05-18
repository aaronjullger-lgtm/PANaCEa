---
name: tabular-memory
description: Use this skill when reviewing SQL-backed memory, learner progress, FSRS state, question attempts, review logs, study sessions, semantic cache, knowledge cache, CSV imports, or table/query correctness.
---

# Tabular Memory

Use this skill when reviewing SQL-backed memory, learner progress, FSRS state, question attempts, review logs, study sessions, semantic cache, knowledge cache, CSV imports, or table/query correctness.

## First Files

- `prisma/schema.prisma`
- `functions/api/srs/semantic-reorder.ts`
- `functions/api/embeddings/generate-questions.ts`
- `functions/api/knowledge/cache/student-context.ts`
- `functions/api/knowledge/cache.ts`
- `functions/api/knowledge/caches.ts`
- `functions/api/knowledge/cache/[id].ts`
- `functions/api/knowledge/cache/[name].ts`
- `lib/services/semanticSpacingService.ts`
- `lib/services/semanticCacheService.ts`
- `functions/api/_shared/semantic-cache.ts`
- `scripts/db/audit-user-progress.ts`
- `scripts/restore_medical_content_csv.ts`

## Loop

detect schemas -> validate data types -> test SQL/table queries -> check joins and filters -> compare expected answers -> document schema gaps

## Checks

- User-scoped queries include user isolation.
- Cache records include expiry and deletion behavior.
- CSV/import scripts have dry-run or duplicate protection.
- Query paths have indexes for expected filters.
- Sensitive learner data is not logged.
- External cached content has deletion verification.

## Commands

- `npx prisma validate`
- `npm test -- tests/knowledgeTutorCache.test.ts`
- `npm run test:memory`
- `npm test -- functions/api/embeddings/generate-questions.test.ts` if present.
- Run data audits only against approved environments.
