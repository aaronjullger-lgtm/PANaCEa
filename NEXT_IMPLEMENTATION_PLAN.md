# PANaCEa Next Implementation Plan

Status: integration plan refreshed 2026-05-05 12:03 EDT.

## Executive Summary

PANaCEa is now meaningfully closer to production readiness, but the remaining work should keep focusing on truthful learning data instead of new UI surface area. The next slices should close small verified gaps in production question filters, then continue into canonical identity and StudyPlanTask V2 consolidation.

Updated grade: **85/100, B/no-launch**.

## Integration Pass Completed

The latest integration slice closed several small P1 seams:

- Admin AI routes are classified into the fail-closed gateway AI tier.
- Legacy SRS submit forwards `attemptId` as the canonical idempotency key.
- `syncManager.syncAll()` drains in-flight review writes before session summary/plan completion can read progress.
- Enhanced generation review-held responses are explicit non-session questions.
- Public library answer errors are generic.
- Missing migration scripts were removed and `verify:health` now uses Wrangler Playwright config.

## Highest-Impact Remaining Work

1. Keep learner-facing direct canonical `Question` reads behind shared production safety filters.
2. Keep explanation generation on shared gateway, typed output, and fail-closed behavior instead of synthetic clinical fallback prose.
3. Keep pre-generated mirroring approved-only and source-identity-preserving.
4. Continue StudyPlanTask V2 consolidation without breaking `/api/users/me/daily-plan` compatibility.
5. Prepare the no-write DB probe output for canonical question/source and concept identity migrations.
6. Add runtime smoke coverage for route gating and core study flows when live credentials are available.

## P0/P1 Blockers

| Severity | Blocker | Files / Areas | Implementation Order |
|---|---|---|---|
| P0 | Canonical question/source identity migration not applied | `prisma/schema.prisma`, `Question`, `PreGeneratedQuestion`, `StudySession`, `QuestionAttempt`, `ReviewLog`, `Card` | Probe first, then migration/backfill plan |
| P0 | Canonical condition/content identity migration not applied | `UserProgress.conditionId`, `MedicalContent.id`, condition-linked review writes | Probe and migration design |
| P1 | Direct canonical question lifecycle filter gaps | `functions/api/questions/attempt.ts`, `functions/api/questions/record.ts`, `functions/api/questions/due-siblings.ts`, `functions/api/questions/context.ts` | Mostly addressed; keep import census and regressions |
| P1 | Explanation route bypassed shared gateway/fail-closed policy | `functions/api/questions/explain-rag.ts` | Addressed locally; keep regressions and add consumer unavailable-state handling if needed |
| P1 | StudyPlanTask V2 contract still split | `_shared/studyPlanService.ts`, `lib/services/studyPlanService.ts`, `daily-plan` routes | Implement after filter slice |
| P1 | Runtime smoke absent | Cloudflare Pages Functions, Clerk, Postgres, route registry | Add smoke gate after local code stays green |
| P1 | Generation adapter fragmentation | `functions/api/questions/generate*`, staging/refinery/admin paths | Centralize after current serving filters |
| P1 | Approval/mirror writes not atomic | `_shared/staging-questions.ts`, `admin/question-review.ts` | Wrap approval plus mirror writes or hold approval until mirror succeeds |
| P1 | Review durable writes not atomic | `lib/services/drillReviewService.ts` | Transactionalize ReviewLog/UserProgress/Card or return degraded non-scheduled response |

## Implementation Order

### Slice 1: Production Filter Closure For Compatibility Attempts

Status: completed in this continuation pass.

- Import `withProductionQuestionSafety`.
- Replace direct `question.findUnique` in `/api/questions/attempt` and `/api/questions/record` with `question.findFirst` using the shared production predicate.
- Ensure `UserQuestionSeen` uses the resolved canonical ID, not the raw submitted ID.
- Add tests for draft/unapproved canonical IDs failing closed.

Verification:

```bash
npx vitest run functions/api/questions/attempt.test.ts functions/api/questions/record.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
git diff --check
```

### Slice 2: Due-Sibling Variant Seed Safety

Status: completed in this continuation pass.

- Apply production question safety to fallback `Question` rows used for due-sibling variant generation.
- Add a focused test or helper-level test that unsafe originals are skipped.

### Slice 3: StudyPlanTask V2 Tightening

Status: partially completed in this continuation pass.

Completed now:

- New locally generated targeted plan tasks use task mode `targeted`, not hidden/deferred `rapid_recall`.
- Compatibility task sanitization canonicalizes stale targeted task modes while preserving route scope as `mode=condition` when conditions exist.
- System-only targeted tasks route as `mode=system`, not under-specified `mode=condition`.
- Current-plan output from `_shared/studyPlanService.ts` canonicalizes stale persisted targeted/review task modes and launch settings.
- Current-plan output now routes single-system tasks as `mode=system` instead of generic `mode=adaptive`.

Still open:

- Full cross-route StudyPlanTask V2 consolidation between `_shared/studyPlanService.ts`, `lib/services/studyPlanService.ts`, study-path, study-plan, and daily-plan compatibility routes.

- Re-inspect active normalized task shape.
- Add tests around `conditionIds`, `reviewCardIds`, `linkedSessionId`, and dashboard review coverage inputs.
- Keep compatibility endpoint shapes stable.

### Slice 4: Runtime Smoke Prep

- Add documented smoke commands gated by `BASE_URL` and Clerk test credentials.

### Slice 5: Integration Hardening

Status: partially completed in this integration pass.

Completed now:

- Gateway admin AI classification and regression.
- Legacy SRS idempotency forwarding and regression.
- Sync drain race fix and regression.
- Enhanced-generation review-held client behavior and regression.
- Library answer generic error contract.
- Missing package script cleanup and health script correction.

Still open:

- Atomic generated-question approval/mirror writes.
- Atomic durable review/progress/card writes.
- Route/menu duplicate cleanup (`CommandCenterPage`, `/menu`, `TrainingMenu`) after route registry and E2E expectations are reconciled.
- Historical docs/archive sweep for old dashboards, FSRS v5 claims, and old smoke routes.
- Ensure smoke can skip cleanly when credentials are absent.

### Slice 5: Question Context Endpoint Truth

Status: completed in this continuation pass.

- Replace direct `question.findUnique` with `findFirst(withProductionQuestionSafety({ id }))`.
- Resolve Clerk `auth.userId` to internal `User.id` before querying `ReviewLog`.
- Add focused tests proving unsafe canonical IDs return 404 and performance lookups use the internal user ID.

Verification:

```bash
npx vitest run functions/api/questions/context.test.ts
```

### Slice 6: Explanation Route Gateway And Fail-Closed Review

Status: completed in this continuation pass.

- Re-inspected `functions/api/questions/explain-rag.ts` and existing route tests.
- Replaced direct Gemini `fetch` calls and ad-hoc JSON parsing with `lib/ai/aiGateway` structured calls and a Zod explanation schema.
- Replaced synthetic fallback explanation prose with explicit unavailable errors for gateway/no-context failures.
- Ignored stale fallback cache entries so old generated-looking fallback prose does not continue to serve from KV.
- Updated tests around gateway success and fail-closed provider failure.

Verification:

```bash
npx vitest run functions/api/questions/explain-rag.test.ts functions/api/questions/context.test.ts functions/api/questions/attempt.test.ts functions/api/questions/record.test.ts functions/api/questions/due-siblings.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
git diff --check
```

### Slice 7: Next Candidate - Direct AI Call Census And Consumer Unavailable States

Status: partially completed in this continuation pass.

Completed now:

- Migrated active structured condition-card extraction from direct Gemini `fetch`/manual JSON parsing to `gateway.callStructured`.
- Added `StructuredConditionSchema` and kept safe fallback to stored content fields instead of synthetic generated data.
- Added focused route tests for gateway success and gateway failure fallback.
- Migrated active library answer generation from direct Gemini `fetch` to `gateway.callText`.
- Added focused tests proving searched references still return when gateway answer generation fails.
- Migrated admin condition enrichment from direct Gemini `fetch` and ad-hoc JSON parsing to `gateway.callStructured`.
- Added focused tests proving enrichment writes only requested enrichable fields and gateway failure does not mutate `MedicalContent`.
- Centralized active library/RAG search embeddings through `lib/gemini.ts#getEmbedding` for `library/answer`, `library/semantic-search`, `ragContextService`, `hybridSearch`, and legacy `lib/search`.
- Updated `library/answer` tests to mock the helper boundary and assert the route no longer performs direct provider `fetch`.
- Hardened RAG question generation so only successfully staged preview questions are returned; if every generated item fails staging, the route returns a typed 502 instead of exposing ephemeral generated content.
- Added `functions/api/questions/generate-rag.test.ts` for staged success, staging failure, and CRAG rejection.
- Hardened primary question generation so a new generated question is not returned or cached when staging fails.
- Added `functions/api/questions/generate.test.ts` coverage for primary generation staging failure.
- Added `functions/api/_shared/generated-question-preview.ts` to centralize preview-only generated-question metadata, stem/explanation normalization, staging persistence, and `staged_for_review` attribution for primary and RAG generation.
- Added helper-level tests and moved primary/RAG routes onto the shared helper.
- Hardened enhanced generation so CoVe-passed questions cannot be promoted live when staging/provenance persistence fails.
- Clarified admin-only deep generation metadata from `not_staged` to `admin_preview_only` and added focused route coverage.

Still open:

- Continue direct AI call census from `AI_LEARNING_ENGINE_AUDIT.md` for `clinical-eye/analyze.ts`, visualizer routes, cron jobs, and service utilities.
- Review remaining direct embedding callers separately for question-embedding backfill/model-versioning and benchmark-only utilities.
- Inspect the UI consumer of `/api/questions/explain-rag` and ensure explicit unavailable responses render as a calm retry/degraded state instead of a broken panel.
- Keep direct generation adapter consolidation as the next broader backend slice.
- Next schema step: create a canonical generated-question schema/prompt adapter that can be used by primary, RAG, enhanced, batch/refill, and admin-only preview routes without changing the current production serving gates.

Verification:

```bash
npx vitest run 'functions/api/conditions/[identifier]/structured.test.ts'
npx vitest run functions/api/library/answer.test.ts
npx vitest run functions/api/admin/enrich-condition.test.ts functions/api/library/answer.test.ts 'functions/api/conditions/[identifier]/structured.test.ts' functions/api/questions/explain-rag.test.ts functions/api/questions/context.test.ts functions/api/questions/attempt.test.ts functions/api/questions/record.test.ts functions/api/questions/due-siblings.test.ts
npx vitest run functions/api/library/answer.test.ts lib/services/search/hybridSearch.test.ts tests/ragContextService.test.ts tests/explainRag.test.ts
npx vitest run functions/api/questions/generate-rag.test.ts functions/api/questions/generate.test.ts functions/api/questions/generate-enhanced.test.ts
npx vitest run functions/api/_shared/generated-question-preview.test.ts functions/api/questions/generate.test.ts functions/api/questions/generate-rag.test.ts functions/api/questions/generate-enhanced.test.ts
npx vitest run functions/api/questions/generate-deep.test.ts functions/api/_shared/generated-question-preview.test.ts functions/api/questions/generate.test.ts functions/api/questions/generate-rag.test.ts functions/api/questions/generate-enhanced.test.ts
npx vitest run functions/api/questions/generate-enhanced.test.ts functions/api/questions/generate-deep.test.ts functions/api/_shared/generated-question-preview.test.ts functions/api/questions/generate.test.ts functions/api/questions/generate-rag.test.ts
npx vitest run functions/api/_shared/studyPlanService.test.ts hooks/useStudyPlanLaunch.test.tsx functions/api/study-plan/progress.test.ts functions/api/study-plan/today.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
git diff --check
```

## Rollback Plan

- Each slice is isolated and test-backed.
- If a compatibility endpoint starts rejecting legitimate approved content, revert only that endpoint change and keep the regression test adjusted to the real contract.
- No migrations or live DB writes are included in this pass.

## Acceptance Criteria For This Continuation

- Continuation docs exist and reflect current repo state.
- Slices 1, 2, 3, 5, and 6 are implemented and targeted tests pass.
- Typecheck and diff check pass after code changes.
- Remaining risks are updated in `CONTINUATION_IMPLEMENTATION_LOG.md`.
