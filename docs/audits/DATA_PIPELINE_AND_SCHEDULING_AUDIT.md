# PANaCEa Data Pipeline And Scheduling Audit

Status: initial and specialist-pass consolidation, updated 2026-05-03 12:56 EDT.

## Summary

Data pipeline / FSRS / scheduling readiness grade: **82/100, B/no-launch**.

The intended pipeline is:

```text
question generation -> content metadata -> question storage -> session creation
-> answer attempt -> correctness/scoring -> explanation -> weakness tagging
-> progress update -> FSRS/review log -> study plan -> schedule -> dashboard signals
```

The current code implements many stages, but not as one canonical contract. This pass improved primary generation fail-closed behavior, answer resolution, shared canonical mirroring for pre-generated content, approved-only mirror gating for legacy attempt/record compatibility paths, staging promotion metadata, stable staging-to-pool identity, admin review/auto-approval mirror gating, admin pool seed approval validation, enhanced-generation serving status for CoVe-passed rows, deep-context generation as admin-only preview, legacy pre-generated attempt mirroring, source identity preservation for due siblings, session ID propagation into `ReviewLog`, linked study-plan completion, study-plan launch gating, accepted-plan visibility before target gating, study-path progress plan-ID selection, active SRS compatibility retirement, canonical smart-review read behavior with production serving filters, duplicate attempt-endpoint scheduler neutralization, `UserProgress` fail-closed condition-domain guarding, reservoir condition-scoped refill across `MedicalContent.id` and legacy condition IDs, reservoir failed-hydration cleanup, batch reservoir consumption, study-path progress/user-ID repair, accepted study-path persistence into daily plan tasks from cache or submitted payload, accepted-plan preservation on read, read-only identity audit probes, SRS due/next launchability with context propagation, SRS flashcard fail-closed submit behavior, deletion of the old localStorage `srsService` helper, RAG preview staging, structurally invalid staging approval blocking with explicit human pending-review promotion support, removal of unused learner-facing hot-path dynamic session generation, and dashboard review coverage truthfulness. The largest remaining risks are split question identity, split condition identity that still needs schema/backfill resolution, partially split study-plan contracts, conservative batch generation/background refill policy that still fills review queue rather than learner-servable supply, and live production smoke coverage.

## Data Pipeline Readiness Table

| Stage | Input | Output | Current Status | Blockers | Verification |
|---|---|---|---|---|---|
| Question generation | MedicalContent, taxonomy, prompt anchors | Generated JSON | Improved | Primary `/api/questions/generate` fails closed; RAG output is staged as preview-only; CoVe-passed enhanced generation writes ACTIVE/APPROVED canonical rows; deep-context generation is admin-only preview; one canonical generation adapter still remains future work. | Route tests for fail-closed generation, enhanced serving status, and schema validation. |
| Content metadata | MedicalContent, Condition, blueprint mapping | System/category/task metadata | Partial | Condition ID semantics inconsistent. | Taxonomy mapping tests and FK probes. |
| Question storage | Generated/RAG/staged/pregenerated payloads | `Question`, `PreGeneratedQuestion`, `StagingQuestion` | Improved | Structurally invalid approval bypass is removed, explicit human review can promote pending staging rows, staging promotion keeps a stable staging id in the live pool, admin review/auto-approval and admin pool seeding now validate mirrorability before approval, and promotion preserves provenance; full source-identity schema is still missing. | Staging promotion, critic guard, human-review promotion, admin review/seed, and approved-only serving tests. |
| Session creation | Mode, blueprint, scope, reservoir | `StudySession`, normalized questions | Improved | `StudySession.questionIds` still untyped; launch now carries task/plan scope and session ID reaches review logs. | Session source identity tests plus launch/session-summary tests. |
| Session resume | `StudySession.questionIds` | Hydrated questions | Partial | Missing IDs silently filtered; no typed source discriminator. | Resume partial failure and missing ID tests. |
| Answer attempt | Selected answer, telemetry | `QuestionAttempt`, review request | Improved | Legacy attempt/record paths create PGQ mirrors before FK-backed attempts only when source PGQ rows are approved; full source identity still not persisted historically. | PGQ submission tests across submit paths. |
| Correctness/scoring | Selected answer + correct answer variants | Correct/incorrect, grade | Improved | Reviewed serving paths no longer silently default to A/0. | Correctness resolver tests, no silent A fallback. |
| Explanation | Stored rationale or RAG/Gemini | Feedback/explanation | Partial | Generated explanation shape loosely validated; weakness endpoint has auth/update gaps. | Explanation schema and auth tests. |
| Weakness tagging | Attempt/explanation/condition | WeaknessPattern/confusion pair | Partial | Duplicate/simple append path; `consecutiveWrong` not reliably updated. | Weakness recurrence tests and UI auth tests. |
| Progress update | Review event | UserProgress/UserTopicProgress/Card | Improved | New `UserProgress` rows now fail closed if `conditionId` cannot satisfy `MedicalContent.id`; canonical concept migration/backfill remains. | FK/domain guard tests and production-like pipeline proof. |
| FSRS/review log | Review event + telemetry | ReviewLog, next due | Improved | `ReviewLog.sessionId` now persists for QuizView submissions; `/api/srs/submit` delegates to the canonical writer and preserves TARGETED/READINESS context from launched due items; `/api/srs/next` serves launchable due Cards first and skips unsafe Card-linked questions; smart review reads canonical progress and applies production question filters; SRS flashcard UI no longer advances after an unsaved submit; active SRS due/sync/retention/smart-review DB paths avoid SRSItem; the old localStorage `srsService` helper is deleted after consumer migration; `/api/questions/attempt` no longer calls the legacy concept scheduler. | Single-writer, scheduler-ownership, SRS next/submit context, and transaction/compensation tests. |
| Study plan | User progress, reviews, goal | DailyStudyPlan/tasks | Improved | Current launch and completion path is linked by task/session; accepted study paths can persist into launchable daily-plan tasks from cache or submitted payload and are no longer overwritten on read; `reviewCardIds` now survive compatibility paths; two plan services and full V2 consolidation remain. | StudyPlanTaskV2 tests, linked session smoke, and pipeline proof. |
| Scheduling | UserProgress/Card dates | Due queue, reservoir | Partial | SRS due-review context propagation is fixed, condition-scoped refill now reconciles `MedicalContent.id`/legacy condition keys, failed full/partial reservoir hydration no longer requeues unusable rows, and singular/batch submit consume answered reservoir rows; broader mode/context aggregation policy and source-typed identity are still partial. | Due context tests and reservoir reserve/consume/release/fail tests. |
| Dashboard analytics | Attempts, plan, progress, forecast | Adaptive dashboard signals | Improved | Review coverage now only claims protection when planned condition/review IDs match due identities; accepted study paths can feed daily-plan tasks; actualAccuracy scale bug reported. | Dashboard signal source tests and pipeline proof. |

## Canonical Identity Risks

| Severity | Finding | Evidence | Fix |
|---|---|---|---|
| P0 | `Question` and `PreGeneratedQuestion` are separate roots with no durable shared identity. | `prisma/schema.prisma` models; `lib/study/questionIdentity.ts` knows split exists. | Add `QuestionIdentity` table or explicit `(questionSource, sourceQuestionId, canonicalQuestionId)` columns across attempts/logs/sessions/cards. |
| P0 | `QuestionAttempt.questionId` requires `Question.id`, but PGQ content is served. | `prisma/schema.prisma`, `/api/questions/attempt`, `drillReviewService` mirror workaround. | Current legacy attempt path mirrors PGQs before writing; still add canonical mapping and source fields across sessions/logs/cards. |
| P0 | `UserProgress.conditionId` domain likely mismatches some session/review condition IDs. | `prisma/schema.prisma`, `userProgressService.ts`, `reviewQuestionResolver.ts`. | Guard is now fail-closed for new rows; still decide canonical concept key and migrate schema/writers/backfill. |
| P1 | `StudySession.questionIds String[]` has no source discriminator. | `prisma/schema.prisma`, session generation/resume route. | Improved: session generation now best-effort writes `StudySessionQuestion` rows and resume prefers them when available. Full closure still depends on schema rollout/backfill. |
| P1 | Pool regeneration deletes PGQs and can orphan soft references. | `scripts/regenerate-pool-v2.ts`. | Fixed for tooling safety: default destructive clear is disabled; `--clear` now requires `ALLOW_DESTRUCTIVE_POOL_REGENERATION=true`. |

## FSRS And Scheduling Risks

| Severity | Finding | Evidence | Fix |
|---|---|---|---|
| P1 | Legacy SRS compatibility route/schema shells remain after submit/due/next/sync adapter work. | `/api/srs/*`, `SRSItem` schema, SDK compatibility types. | Active DB API paths are canonical/no-op or canonical progress reads; `/api/srs/next` launches due Cards and preserves progress context; flashcard submit and SDK payload shape are fail-closed/current; `lib/services/srsService.ts` localStorage helper was deleted. Keep route shells until browser/runtime compatibility is verified, then remove SRSItem schema/types in a migration-backed cleanup. |
| P1 | Urgency multiplier is supported but not passed by submit endpoints. | `drillReviewService.ts`, `functions/api/drills/submit-review.ts`. | Fixed: typed telemetry now carries `urgency_multiplier`, QuizView queues it, and single/batch submit endpoints pass it to `drillReviewService`. |
| P1 | Daily allocator reads TARGETED pressure while main/drill writes READINESS. | `dailyStudyAllocatorService.ts`, `drillReviewService.ts`. | Explicit context aggregation policy and tests. |
| P1 | Batch submit OPTIONS is auth-wrapped. | `functions/api/drills/submit-reviews.ts`. | Fixed: batch preflight now returns unauthenticated CORS 204. |
| P1 | Study-plan tasks lose condition IDs. | `_shared/studyPlanService.ts`. | Improved: current task normalization preserves `conditionIds`, `reviewCardIds`, launch settings, route, and linked session/attempt metadata. Full V2 consolidation remains. |

## Immediate Data Contract Plan

1. Define `QuestionIdentity` and `LearningEventContext` as the canonical contract across session generation, answer submit, FSRS, plan tasks, and dashboard signals.
2. Add source identity to served questions and persisted study sessions.
3. Run the read-only identity audit against a disposable or production-like database, then resolve `UserProgress.conditionId` domain/backfill before relying on due scheduling at launch.
4. Make `drillReviewService` the only FSRS writer; `/api/srs/*` becomes compatibility or hidden.
5. Consolidate study-plan services around `StudyPlanTaskV2`.
6. Only claim dashboard review coverage when planned condition IDs or review card IDs match due items.
