# Final Production Readiness Report

Status: final report for this execution pass, updated 2026-05-03 12:56 EDT.

## Launch Recommendation

**No launch.**

Initial grade: **62/100, D/no-launch**.
Final grade after this pass: **82/100, B/no-launch**.

The score improved because several security, data-truth, and functionality blockers were fixed: dependency audit is clean, unsafe Todoist OAuth linking is removed from client code, public health is liveness-only, AI rate limiting fails closed for AI routes, generated-question placeholders now fail closed, answer resolution no longer silently defaults to A/0 in the reviewed serving paths, legacy attempts create a pre-generated Question mirror before writing FK-backed attempts, approved/admin-seeded/pre-generated content now mirrors through a shared canonical `Question` helper, submitted pre-generated IDs must now be approved before compatibility paths can mirror them, study-plan launches route canonically, accepted persisted plans surface even without target metadata, study-path progress can target the exact cached plan/alternative, session IDs now reach ReviewLog/session summaries, SRS compatibility routes are no longer divergent DB writers/readers, smart review reads canonical progress and production-safe question sources, `UserProgress` now fails closed on wrong-domain condition IDs, reservoir condition-scoped refill resolves `MedicalContent.id` and legacy condition IDs, unusable reserved rows are failed instead of requeued even on partial fallback, batch review submit consumes answered reservoir rows, study-path recommendation/progress now use the unified API envelope and internal user IDs, accepted study paths can persist launchable daily-plan tasks from cache or submitted payload and are no longer overwritten on read, SRS review UI no longer advances after an unsaved review, the old localStorage `srsService` helper was deleted after consumer migration, staging promotion now keeps a stable staging-to-pool identity, pending staging questions can be explicitly human-approved without bypassing structural validation, admin review/auto-approval fail closed unless a canonical mirror can be created, enhanced generation now writes CoVe-passed rows as production-servable `Question` records, admin pool seed writes are answer-key validated and approved, RAG-generated questions are staged as preview-only, deep-context generation is admin-only preview, unused hot-path dynamic session generation was removed, duplicate attempt/drill/SRS/OSCE scheduling was neutralized, dashboard review coverage is identity-based, and stale/deferred visible surfaces are gated more consistently. The launch posture remains no-launch: unresolved P0s remain in canonical data identity migration/backfill, canonical UserProgress concept identity migration, generated-question adapter/refill policy, and production runtime smoke.

## Completed Work

- Created the required root audit, plan, study-mode, data-pipeline, deprecated-code, implementation-log, and final-report documents.
- Ran specialist review passes across repository map, product functionality, study modes, data pipeline, backend/API, database, AI generation, FSRS/scheduling, frontend architecture, design/UX, testing, security, performance, DevOps, deprecated code, and red-team review.
- Added Cloudflare Pages SPA fallback for React Router deep links.
- Hid deferred/private-beta Practice recommendations through readiness visibility.
- Made `/api/study-plan/current` first-login safe by resolving or creating the internal user row.
- Fixed singular and batch drill review OPTIONS handlers so browser preflight does not require auth/body validation.
- Added regression tests for drill review preflight behavior.
- Added durable ID, approved validation metadata, and provenance when promoting staging questions to `PreGeneratedQuestion`.
- Patched production dependency advisories so `npm audit --omit=dev` reports zero vulnerabilities.
- Removed client-side Todoist OAuth linking, callback handling, API export, browser client secret usage, and localStorage token storage; CSV export remains.
- Split public `/api/health` into sanitized liveness and admin-only `/api/admin/readiness` diagnostics.
- Expanded gateway AI route classification and made AI limiter faults fail closed at the gateway and `aiEndpoint` layer.
- Made `/api/questions/generate` fail closed for missing source content or generation failure, with no placeholder questions returned or cached.
- Removed silent A/0 scoring fallback from pool/system/condition/pharmacology/targeted-daily paths inspected in this pass.
- Added pre-generated Question identity mirror creation in `/api/questions/attempt` before FK-backed `QuestionAttempt` writes.
- Wired Today/command-center plan launch through the canonical `/study/main-session` route and blocked navigation on failed progress-start responses.
- Propagated `sessionId` from `CoreAdaptiveSession` through `QuizView` telemetry into `ReviewLog.sessionId`, and awaited linked study-plan completion writes before showing the session summary.
- Fixed profile/preferences/Rolling360/sync response-envelope parsing so user-facing state reads production API shapes.
- Mounted real protected admin, clinical profile, evidence search, simulation, and utility pages where backing components exist, and fixed stale admin type drift exposed by those imports.
- Gated Daily Challenges and hidden/deferred mode launches through private-beta/mode-readiness checks.
- Deleted the stale `components/command/CommandPalette.tsx` shim after import census confirmed the active palette is `components/navigation/CommandPalette.tsx`.
- Converted `/api/srs/submit` to a compatibility adapter over `drillReviewService`, made `/api/srs/due` read canonical progress, made `/api/srs/sync` no-op, and removed active SRSItem reads/writes from global sync, retention stats, user analytics, and smart review.
- Removed the redundant legacy `updateReviewOutcome` call from `drillReviewService`, leaving the canonical review service as the FSRS writer.
- Gated Sentry source-map upload against placeholder local configuration.
- Added a read-only learning identity audit script for `QuestionAttempt`, `ReviewLog`, `Card`, `UserProgress`, and `StudySession.questionIds`.
- Removed the legacy `scheduleConceptReview` side effect from `/api/questions/attempt` and marked that function deprecated away from review scheduling.
- Added a `UserProgress.conditionId` domain guard so new progress rows require `MedicalContent.id` compatibility or fail with explicit diagnostics.
- Preserved `reviewCardIds` through study-plan task compatibility paths and made adaptive dashboard review coverage claim protection only when planned condition/review IDs match due review identities.
- Added a production-like mocked pipeline proof covering review submit, attempt/log/progress/card writes, linked plan completion metadata, and dashboard signal input.
- Moved SRS schedule-result typing out of `lib/services/srsService.ts` to reduce localStorage-era coupling.
- Deleted the old localStorage `lib/services/srsService.ts` helper after moving the active flashcard UI to API-backed `srsReviewClient`.
- Changed staging promotion to preserve the staging id as the approved `PreGeneratedQuestion.id`, retain the staging row as approved provenance, and block structurally invalid high-scoring critic promotions.
- Removed the unused mid-session dynamic Gemini generation branch from the legacy session service so learner sessions only use approved persisted pools.
- Made admin pool seeding fail closed when `correctAnswer` does not resolve to an option and write approved validation metadata when it does.
- Canonicalized stale study-plan launch params during task sanitization so compatibility rows cannot keep `mode=rapid_recall` or other deferred modes on `/study/main-session`.
- Tightened `/api/questions/attempt` and `/api/questions/record` so pre-generated IDs must be approved before any canonical `Question` mirror or `QuestionAttempt` write can occur.
- Updated the canonical review writer to use the shared `Question` mirror helper, so pre-generated review attempts create `ACTIVE`/`APPROVED` mirrors consistently.
- Reworked `/api/drills/smart-review` to read canonical progress sources, apply production serving filters, and skip unresolved answer keys.
- Preserved pre-generated identity through `/api/questions/due-siblings` and flagged-review enrichment so downstream submissions retain `questionSource` and `sourceQuestionId`.
- Made `/api/questions/generate-deep` admin-only preview and kept its output non-submittable.
- Mounted `system_drill` as a real bounded feature through the CoreAdaptiveSession runner, with targeted topic session settings and private-beta discoverability.
- Fixed Practice system-target CTAs to navigate to `/modes/system-drill`, and removed the old pre-canonical `components/drill/SystemDrillSession.tsx` implementation after import census.
- Hardened legacy `/api/questions/session` so it only serves approved persisted content and no longer fills learner sessions with seed-expanded or hot-path generated questions that lack canonical submission identity.
- Fixed the client main-session orchestrator to unwrap production API envelopes from `/api/questions/session`.
- Normalized `/api/srs/next` question responses for pre-generated and canonical `Question` sources, while applying production serving filters.
- Fixed `/api/srs/due` query validation under production middleware and kept it as a bounded canonical progress compatibility read model.
- Removed legacy `scheduleConceptReview` side effects from active drill and SRS submit routes.
- Stopped reservoir refill from queuing standard `Question.id` rows into the `StudentReservoirItem.questionId` foreign key, which points to `PreGeneratedQuestion`.
- Resolved SRS ELO/session-order writes from Clerk IDs to internal `User.id`.
- Removed the remaining production `scheduleConceptReview` call from OSCE grading while preserving OSCE `ConceptGap` creation for Tutor/adaptive targeting.
- Added `/api/srs/due` progress-context filtering and duplicate suppression across Card, UserTopicProgress, and UserProgress.
- Fixed SRS SDK due-item date normalization to match the exported SDK type.
- Made reservoir bulk insert health count actual inserted rows returned by raw SQL instead of attempted rows hidden by `ON CONFLICT DO NOTHING`.
- Reconciled `/api/srs/due` with `/api/srs/next`: due Cards are now launchable first-class SRS next items, unsafe Card-linked `Question` rows are skipped, and `progressContext` is carried through `/api/srs/next` -> `SrsFlashcardView` -> `/api/srs/submit` so TARGETED due reviews update the TARGETED FSRS partition.
- Fixed condition-scoped reservoir refill so study-plan targets keyed by `MedicalContent.id` can still find due progress rows and approved pre-generated pool questions keyed by either `medicalContentId` or legacy `conditionId`.
- Added a reservoir failure path so reserved items that do not hydrate into production-safe questions are marked `failed` instead of being returned to the available queue.
- Classified partial reservoir reservations before fallback, failing unsafe rows and releasing only hydrated safe rows.
- Added reservoir consumption to batch `/api/drills/submit-reviews` when telemetry carries a session ID, matching singular submit behavior.
- Fixed study-path dashboard/progress fetchers to unwrap production API envelopes.
- Repaired `/api/study-path/progress` so it resolves the internal user ID, calls `generateStudyPlan(prisma, input)`, and normalizes cached plan dates before projection.
- Persisted accepted study paths into launchable `DailyStudyPlan.recommendedSessions` tasks, grouped by plan date, using the cached recommendation when available and the submitted accepted-plan payload when KV is unavailable.
- Added a shared canonical mirror helper for approved `PreGeneratedQuestion` content and wired it into attempt fallback, session generation, admin curation, admin pool seed, staging promotion, and admin question review.
- Made `/api/users/me/daily-plan` use request-scoped Edge Prisma rather than the module-level proxy.
- Made `/api/study-plan/current` return persisted accepted plan rows before `needs-target` target gating.
- Added `planId` support to `/api/study-path/progress` so `ProgressProjectionChart` projects the plan currently rendered by the dashboard.
- Made admin question review and auto-approval create the canonical `Question` mirror before flipping `PreGeneratedQuestion.validationStatus` to `approved`.
- Made enhanced generation write CoVe-passed rows as `ACTIVE`/`APPROVED` canonical `Question` rows and fixed its client adapter to send auth, required difficulty, and unwrap the API envelope.

## Category Readiness Table

| Category | Initial Grade | Final Grade | Status | Notes |
|---|---:|---:|---|---|
| Product functionality | 62 | 81 | Improved | SPA fallback, first-login plan lookup, canonical plan launch, accepted study-path persistence without hard KV dependence, accepted-plan visibility before target gating, profile sync, real protected route mounts, recommendation gating, approved/staged/enhanced generation behavior, and a real focused system-drill launch improved. |
| Study modes functionality | 50 | 62 | Blocked | Deferred recommendations/routes are hidden more consistently; `core_adaptive` and `system_drill` are current launch candidates. |
| Data pipeline / FSRS / scheduling | 56 | 80 | Blocked | Shared canonical PGQ mirror helper, staging promotion identity, generation fail-closed, enhanced-generation serving status, scoring resolution, session ReviewLog linkage, SRS compatibility retirement, UserProgress domain guarding, reservoir condition-domain refill, reservation failure handling, batch consumption, study-path progress/user-ID/plan-ID repair, duplicate attempt/drill/SRS/OSCE scheduler removal, SRS due/next context reconciliation, production-like pipeline proof, and legacy PGQ attempt mirroring improved; canonical identity migration remains unresolved. |
| Backend/API readiness | 67 | 85 | Improved | Health split, AI limiter fail-closed, preflight, generation error behavior, request-scoped daily-plan Prisma, stale admin type drift, production-safe `/api/questions/session`, approved admin pool seeding, admin review mirror gating, safer staging critic/human promotion, normalized/context-aware `/api/srs/next`, study-path envelope/progress repair, SRS due dedupe/context filtering, and SRS submit/due/sync compatibility behavior improved. |
| Database/data integrity | 62 | 72 | Blocked | PGQ promotion, stable staging-to-pool id preservation, attempt mirroring, lifecycle filter alignment, read-only identity probes, fail-closed UserProgress domain guard, and reservoir condition-domain reconciliation improved; schema/backfill decisions remain unresolved. |
| Frontend architecture | 68 | 76 | Improved | Deep links, mode gates, real route mounts, command-palette cleanup, and study-plan launcher are safer. |
| Design/UI/UX | 72 | 73 | Improved | Audit completed; stale placeholders are less visible, but design-token warnings and session polish remain. |
| Testing/QA | 68 | 80 | Improved | Added focused route/session/identity tests, production-like learning pipeline proof, and ran full Vitest. |
| Security/privacy | 62 | 75 | Improved | Dependency audit clean, Todoist client-token risk removed, health diagnostics protected, AI limiter fail-closed. |
| Deployment/devops | 58 | 63 | Improved | SPA fallback, public health shape, and route gating improved; scheduler/deploy gates remain. |
| Performance/scalability | 61 | 66 | Blocked | AI limiting, lazy route mounting, reservoir refill worker ownership, and vendor chunk splitting improved; runtime perf smoke remains. |

## Study Mode Readiness Table

| Study Mode | UI Exists | Backend Exists | Data Persists | FSRS/Progress Updates | Tests Exist | Production Ready | Blockers |
|---|---|---|---|---|---|---|---|
| `core_adaptive` | Yes | Yes | Partial | Yes | Yes | No | Identity migration/backfill, condition FK domain migration, and production runtime smoke. |
| PANCE main | Yes | Yes | Partial | Partial | Partial | No | Needs canonical plan/task/dashboard truth. |
| EOR / rotation | Partial | Partial | Partial | Partial | Partial | No | Urgency not fully threaded into submit/scheduling. |
| Didactic exam | Structural | Partial | Partial | Unproven | Minimal | No | Course/exam planning and language need proof. |
| PANRE / maintenance | Structural | Partial | Partial | Unproven | Minimal | No | Needs distinct maintenance cadence/session profile. |
| System drill | Yes | Shared study session backend | Partial | TARGETED via shared submit-review path | Yes | Partial | Needs browser smoke and canonical identity migration. |
| Other drill modes | Deferred | Partial | Unproven | Intended TARGETED | Minimal | No | Hidden until real mounted components and canonical submit behavior exist. |
| Rapid recall / cram | Deferred | Partial | Attempt-only intended | Should not write FSRS | Minimal | No | Needs real attempt-only mode implementation and tests. |
| OSCE / simulation | Deferred | Partial/mock | Partial | Isolated | Some | No | Mock/deferred surfaces must stay hidden. |

## Data Pipeline Readiness Table

| Stage | Input | Output | Current Status | Blockers | Verification |
|---|---|---|---|---|---|
| Question generation | Prompt/context/condition | Question payload | Improved | Primary endpoint fails closed; broader generated/RAG/staging adapters still need one canonical persistence contract. | Missing-condition/provider-failure fail-closed tests. |
| Staging promotion | `StagingQuestion` | `PreGeneratedQuestion` | Improved | Needs broader transactional promotion proof and lifecycle serving filters. | Staging approval test. |
| Session generation | Goal/mode/profile | Served question set | Partial | Source identity and reservoir lifecycle incomplete. | Production-like session smoke. |
| Answer submission | Served question + selection | Attempt/review result | Improved | Typed source identity is now carried into review telemetry; full persisted/queryable source identity and cross-user guards still need a migration design. | FK-backed PGQ submit tests plus review resolver identity tests. |
| FSRS/progress | Attempt result | Card/log/progress | Improved | `/api/srs/submit` delegates to the canonical writer and preserves TARGETED/READINESS context from launched due items; active SRSItem sync/due/retention/smart-review API paths have been retired to compatibility shells or canonical progress reads; `/api/questions/attempt`, drill submit, batch drill submit, SRS submit, and OSCE grading no longer call the legacy concept scheduler. | TARGETED/READINESS tests, SRS adapter tests, scheduler-ownership tests, and canonical due/retention/smart-review tests. |
| Study plan | Progress/due/deadline | Daily tasks | Improved | Split task contracts remain; compatibility paths now preserve `reviewCardIds`, linked completion metadata, and accepted study-path tasks can persist into daily plans from cache or submitted accepted-plan payload. | `StudyPlanTaskV2` contract tests plus pipeline proof. |
| Scheduling | Tasks/reviews/calendar | Due queue/session plan | Partial | Condition-scoped reservoir refill now reconciles `MedicalContent.id` and legacy condition keys; full and partial reservation hydration failures now mark bad rows failed instead of requeueing them; singular and batch review submit consume answered reservoir rows when session telemetry is present. Broader duplicate scheduler ownership still needs operator follow-through. | Scheduler ownership + refill smoke. |
| Dashboard signals | Plan/progress/reviews | Adaptive widgets | Improved | Review coverage now only claims protection when due condition/review identities match plan task IDs; real data completeness still depends on upstream IDs. | Dashboard signal and production-like pipeline tests. |

## Deprecated Code Table

| File/Area | Issue | Evidence | Action Taken | Risk |
|---|---|---|---|---|
| Legacy dashboard files | Deleted in worktree, could conflict if referenced. | Import census finds no live old dashboard route; docs still mention old names. | Documented; no new deletion needed. | Low if tests stay green. |
| `components/dashboard/UnifiedDashboard/` | Old unmounted dashboard tree. | Deleted in worktree; stale docs only. | Documented as safe cleanup candidate. | Low. |
| `components/command/CommandPalette.tsx` | Deprecated duplicate/no-op palette. | Import census showed active palette is `components/navigation/CommandPalette.tsx`; no production imports of old shim remained. | Deleted. | Low. |
| `/api/srs/*` | Deprecated SRS compatibility surface. | `SRSItem` is deprecated in schema; old sync/due/submit routes existed for clients. | `/api/srs/submit` delegates to `drillReviewService`; `/api/srs/due` reads canonical progress; `/api/srs/next` launches canonical Cards before fallbacks and preserves progress context; `/api/srs/sync` is a deprecated no-op. | Medium if deleted early; low for active DB writes after this slice. |
| Todoist OAuth/linking | Browser secret/token storage and direct Todoist API export. | Deleted `TodoistCallback`, `TodoistExportModal`; `rg` finds no live client OAuth/token storage references. | Removed linking; CSV export remains. | Low for current client; future OAuth must be server-side. |
| Deferred route placeholders | Some real protected pages were still registered as production-deferred. | `config/lazyComponents.tsx` had real backing pages for admin, clinical profile, evidence search, simulation, and utilities. | Mounted real components; Daily Challenges remains gated because underlying modes are not ready. | Medium; runtime smoke still needed. |
| `components/drill/SystemDrillSession.tsx` | Old direct-fetch system drill conflicted with the CoreAdaptiveSession-backed system drill. | Import census found no production imports after lazy export moved to `components/session/StudyModeAdaptiveSession.tsx`. | Deleted. | Low if route/readiness tests stay green. |
| Public health diagnostics | Public liveness leaked operational internals. | `/api/health` now returns only liveness; `/api/admin/readiness` is admin-authenticated. | Split and updated tests. | Low for diagnostics leakage; admin readiness needs production smoke. |
| `routes/` Express API | Local-only duplicate API. | PANaCEa skills and audits identify production API as `functions/api`. | Documented; do not use for production claims. | Medium documentation risk. |
| Duplicate schedulers | Cloudflare cron and GitHub schedules overlap. | DevOps audit found multiple mutating scheduled lanes. | Plan now requires inventory and operator decision before deletion. | High. |
| Old generation paths | Multiple generation/staging services. | AI/data audits found split validation/persistence. | Plan requires typed adapter before cleanup. | High. |

## Implementation Log Summary

| Phase | Files Changed | Tests Run | Result | Remaining Risk |
|---|---|---|---|---|
| Audit/planning | Root audit/report docs | Static inspections | Complete | Plans need continued execution. |
| Red-team second pass | Audit/plan/study/log docs | Read-only review | Complete | Security and identity still P0. |
| Fail-closed slice 1 | `_redirects`, Practice, study-plan current, drill submit handlers, staging promotion, tests | Focused Vitest, typecheck, lint, build, full Vitest | Passed | Full production smoke not run. |
| Security/data hardening slice | Dependency manifests, Todoist service/components, health/readiness APIs, rate limiters, generation, answer resolution, attempt identity, tests | Focused Vitest, audit, typecheck, lint, build, full Vitest | Passed | Canonical identity migration and runtime smoke remain. |
| Functionality/route cohesion slice | Session linkage, study-plan launch, command center, route mounts, profile/sync hooks, private-beta gates, admin type drift, docs | Focused Vitest, typecheck, lint, build, full Vitest, audit | Passed | Production runtime smoke and canonical identity remain. |
| Remaining-risk hardening slice | SRS submit adapter, review question resolver identity, drill review telemetry, reservoir orchestrator/worker, Vite vendor chunking | Focused Vitest, reservoir suites, typecheck, lint, SENTRY_UPLOAD=false build | Passed | Production runtime smoke, full SRSItem retirement, and raw-color migration remain. |
| SRSItem compatibility retirement slice | SRS due/sync, global sync, retention stats, user analytics, smart review, drill review ownership, Sentry upload gate | Focused Vitest, typecheck | Passed | Runtime smoke, localStorage SRS helper cleanup, and canonical identity migration remain. |
| Remaining-risk closure slice | Learning identity audit, questions attempt scheduler removal, UserProgress domain guard, study-plan review IDs, dashboard identity coverage, SRS type decoupling, pipeline proof | Focused Vitest, typecheck, lint, build, full Vitest, audit | Passed | Live DB audit, no-migration identity/backfill design, browser smoke, and UI-token migration remain. |
| Functionality slice | System drill wrapper, CoreAdaptiveSession selector/source settings, mode readiness, private-beta tests | Focused Vitest, typecheck, lint, build, full Vitest | Passed | Browser smoke and identity migration remain. |
| Study-mode backend compatibility slice | Legacy session service, SRS next/due/submit, review resolver, reservoir refill, SRS ELO/session-order, focused tests | Focused Vitest, typecheck, lint, build, full Vitest, audit | Passed | Later slices closed OSCE scheduler, SRS due dedupe, and reservoir lifecycle handling; browser smoke and identity migration remain. |
| OSCE/SRS/reservoir read-model slice | OSCE grade scheduler removal, SRS due context/dedupe, SDK date normalization, reservoir insert counts | Focused Vitest, typecheck, lint, build, full Vitest, audit | Passed | Later slices closed SRS due/next launchability, context propagation, and reservoir lifecycle handling; browser smoke and identity migration remain. |
| SRS next/submit context reconciliation slice | SRS next, SRS submit adapter, SRS flashcard view, SRS client types/tests | Focused Vitest, typecheck, diff check | Passed | Browser smoke, localStorage-era helper cleanup, and identity migration remain. |
| Reservoir condition-domain refill slice | Reservoir refill worker and tests | Focused reservoir Vitest, typecheck, diff check | Passed | Later slices closed full/partial reservation failure cleanup and batch consumption; capacity policy, browser smoke, and identity migration remain. |
| Reservoir reservation failure cleanup slice | Reservoir service, session generation endpoint/tests | Focused reservoir/session Vitest, typecheck | Passed | Capacity policy, browser smoke, live DB audit, and identity migration remain. |
| Reservoir partial cleanup and batch consume slice | Session generation fallback, batch submit endpoint/tests | Focused reservoir/session/submit Vitest, typecheck | Passed | Capacity policy, browser smoke, live DB audit, and identity migration remain. |
| Study-path contract and accepted-plan persistence slice | Study-path dashboard fetchers, progress endpoint, accept endpoint/tests | Focused study-path Vitest, typecheck | Passed | Route smoke, durable accepted-plan storage, full StudyPlanTask V2 consolidation, and identity migration remain. |
| Generation/staging/SRS cleanup slice | SRS review client, staging critic/promotion, admin pool seed, study-plan sanitization, session service cleanup/tests | Focused Vitest, typecheck | Passed | Identity migration, route smoke, and SRSItem schema cleanup remain. |

## Remaining P0 Issues

- Canonical `Question`/`PreGeneratedQuestion`/attempt/session/review identity contract and migration/backfill are not complete.
- `UserProgress.conditionId` now fails closed for wrong-domain IDs, but the canonical concept identity migration/backfill is not complete.
- Duplicate scheduler ownership remains unresolved outside the reviewed `drillReviewService`/reservoir paths; the known `scheduleConceptReview` production endpoint call sites have been neutralized.
- No live production-like Cloudflare/Clerk/DB smoke gate exists yet.

## Remaining P1 Issues

- Legacy `SRSItem` database surfaces are retired from active submit/due/sync/retention/smart-review paths; the flashcard UI now fails closed on unsaved review writes and the old localStorage helper is deleted, but route shells/schema/types still require migration-backed cleanup.
- `/api/srs/due` still merges Card/UserTopicProgress/UserProgress as a compatibility read model; launchability, unsafe Card-linked `Question` handling, and progress-context propagation are now reconciled with `/api/srs/next`, but permanent removal still requires source-typed identity migration and consumer cleanup.
- Study-plan task contracts need full V2 consolidation, though current launch/completion linkage, condition/review identity preservation, accepted-plan preservation, per-attempt progress, and session-end sync flushing are improved.
- The read-only identity audit script needs to be run against a disposable or production-like database before migration design is finalized.
- Mode visibility and command palette links are improved, but still need browser-level route smoke across every visible CTA.
- Session UI contrast/accessibility and invalid nested controls still need design hardening.
- Sentry source-map upload is now gated against placeholder local config; production still needs real org/project/token verification.
- Broader generated/RAG/staging content lifecycle still needs one canonical adapter, but ungraded/structurally invalid approval bypasses are removed, staging-to-pool id preservation is stronger, admin pool seed is answer-key validated, and RAG output persists only as staging preview content.
- Full removal of pre-generated `Question` mirror compatibility still requires a source-typed attempt/card migration and backfill; no migration was applied in the latest closure loop.

## Tests And Checks Run

- Latest backend functionality closure:
  `npx vitest run components/session/CoreAdaptiveSession.test.ts functions/api/study/session-summary.test.ts functions/api/_shared/studyPlanService.test.ts lib/services/studyPlanService.test.ts lib/ensureDueVariant.test.ts functions/api/srs/due.test.ts functions/api/srs/next.test.ts components/session/SrsFlashcardView.test.tsx services/core/mainSessionService.test.ts functions/api/questions/generate-enhanced.test.ts services/ai/enhancedQuestionService.test.ts lib/verified-question-generator.test.ts hooks/useStudyPlanLaunch.test.tsx lib/study/mainSessionLaunch.test.ts functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts functions/api/drills/smart-review.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`: passed, 20 files, 156 tests. `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`, `git diff --check`, `npm run lint`, `npm run build`, `npm test -- --pool=threads --maxWorkers=4`, and `npm audit --omit=dev` also passed. Full Vitest result: 493 files, 9,540 tests passed, 1 skipped. Lint reports 422 existing raw-color/design-token warnings and 0 errors.
- Latest continuation:
  `npx vitest run lib/services/studyPlanService.test.ts functions/api/study-path/accept.test.ts hooks/useStudyPlanLaunch.test.tsx lib/study/mainSessionLaunch.test.ts functions/api/study-plan/progress.test.ts components/session/SrsFlashcardView.test.tsx lib/sdk/__tests__/srsClient.test.ts functions/api/srs/submit.test.ts functions/api/srs/submit-compat.test.ts functions/api/_shared/staging-questions.test.ts functions/api/questions/generate.test.ts functions/api/questions/pool-security.test.ts functions/api/study/session-generate.test.ts` passed, 59 tests. `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`, `git diff --check`, `npm run lint`, and `npm run build` also passed. Lint still reports 422 existing raw-color/design-token warnings and 0 errors.
- `npx vitest run tests/privateBetaVisibility.test.ts tests/submitReviewIdempotency.test.ts`: passed, 15 tests after CORS additions.
- Latest remaining-risk closure loop:
  `git diff --check`, `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`, `npm run lint && npm run build`, `npm test`, and `npm audit --omit=dev` all passed. Full Vitest result: 482 files, 9,502 tests passed, 1 skipped. Lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `npx vitest run functions/api/_shared/__tests__/backend-hardening.test.ts functions/api/_middleware.test.ts`: passed, 10 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/__tests__/backend-hardening.test.ts functions/api/_middleware.test.ts`: passed, 13 tests.
- `npx vitest run functions/api/questions/attempt.test.ts lib/study/questionIdentity.test.ts functions/api/questions/generate.test.ts`: passed, 40 tests.
- After tightening PGQ mirror scoring, `npx vitest run functions/api/questions/attempt.test.ts && NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npx vitest run functions/api/drills/submit-review.test.ts functions/api/study/session-summary.test.ts hooks/useStudyPlanLaunch.test.tsx components/navigation/command-center/CommandCenterWorkspace.test.tsx tests/syncResponseShape.test.ts`: passed, 42 tests.
- `npx vitest run tests/privateBetaVisibility.test.ts tests/routeRegistry.test.ts lib/modes/modeReadiness.test.ts hooks/useStudyPlanLaunch.test.tsx components/navigation/command-center/CommandCenterWorkspace.test.tsx tests/syncResponseShape.test.ts functions/api/drills/submit-review.test.ts functions/api/study/session-summary.test.ts`: passed, 78 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `npx vitest run functions/api/srs/submit.test.ts tests/refillOrchestrator.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts`: passed, 46 tests.
- `npx vitest run functions/api/drills/_shared/reviewQuestionResolver.test.ts functions/api/srs/submit.test.ts tests/refillOrchestrator.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts`: passed, 49 tests.
- `npx vitest run tests/refillWorker.test.ts tests/reservoir-service.test.ts tests/reservoir-policy.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts tests/submitReviewIdempotency.test.ts`: passed, 84 tests.
- `npx vitest run functions/api/srs/due.test.ts functions/api/srs/sync.test.ts functions/api/sync.test.ts functions/api/sync.integration.test.ts tests/syncResponseShape.test.ts tests/api/analytics/retentionStats.test.ts functions/api/drills/smart-review.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`: passed, 77 tests.
- `npx vitest run functions/api/drills/smart-review.test.ts`: passed, 3 tests after indexed-answer/incomplete-card normalization hardening.
- `npx vitest run tests/learningIdentityAudit.test.ts lib/services/userProgressService.test.ts functions/api/questions/attempt.test.ts components/dashboard/adaptive/engine/resolveDashboardWidgets.test.tsx tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts`: passed, 91 tests.
- `npx vitest run components/navigation/command-center/CommandCenterWorkspace.test.tsx`: passed, 9 tests.
- `npx vitest run components/session/CoreAdaptiveSession.test.ts lib/modes/modeReadiness.test.ts tests/privateBetaVisibility.test.ts tests/routeRegistry.test.ts`: passed, 41 tests.
- `npx vitest run lib/services/session/sessionService.test.ts services/core/mainSessionService.test.ts functions/api/srs/next.test.ts functions/api/srs/due.test.ts functions/api/srs/submit-compat.test.ts functions/api/srs/submit.test.ts functions/api/drills/_shared/reviewQuestionResolver.test.ts tests/reviewQuestionResolver.test.ts functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts tests/refillWorker.test.ts tests/reservoir-policy.test.ts functions/api/questions/pool-security.test.ts functions/api/questions/study-mode-compat-routes.test.ts functions/api/questions-root.test.ts`: passed, 128 tests.
- `npx vitest run functions/api/osce/analysis/grade.test.ts functions/api/srs/due.test.ts lib/sdk/__tests__/srsClient.test.ts tests/reservoir-service.test.ts tests/refillWorker.test.ts functions/api/srs/next.test.ts functions/api/srs/submit-compat.test.ts functions/api/drills/submit-review.test.ts`: passed, 107 tests.
- `npx vitest run functions/api/srs/next.test.ts functions/api/srs/due.test.ts functions/api/srs/submit-compat.test.ts functions/api/srs/submit.test.ts`: passed, 26 tests after SRS next/submit context reconciliation.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after SRS next/submit context reconciliation.
- `npm run lint && npm run build`: passed after SRS next/submit context reconciliation; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `npm test`: failed in the default forks pool due Vitest worker startup/termination timeouts; isolated rerun of `tests/regeneratePoolV2Safety.test.ts` passed.
- `npx vitest run --pool=threads --maxWorkers=4`: passed after SRS next/submit context reconciliation, 482 files, 9,506 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed after SRS next/submit context reconciliation, zero vulnerabilities.
- `npx vitest run tests/refillWorker.test.ts tests/reservoir-service.test.ts tests/reservoir-policy.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts`: passed after reservoir condition-domain refill reconciliation, 87 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after reservoir condition-domain refill reconciliation.
- `git diff --check`: passed after reservoir condition-domain refill reconciliation.
- `npx vitest run functions/api/study/session-generate.test.ts tests/reservoir-service.test.ts`: passed after reservoir reservation failure cleanup, 31 tests.
- `npx vitest run tests/refillWorker.test.ts tests/reservoir-service.test.ts tests/reservoir-policy.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts`: passed after reservoir reservation failure cleanup, 88 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after reservoir reservation failure cleanup.
- `npx vitest run functions/api/study/session-generate.test.ts tests/submitReviewIdempotency.test.ts tests/reservoir-service.test.ts`: passed after partial-reservation and batch-consume cleanup, 45 tests.
- `npx vitest run tests/reservoir-service.test.ts tests/refillWorker.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts functions/api/srs/submit-compat.test.ts`: passed after partial-reservation and batch-consume cleanup, 116 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after partial-reservation and batch-consume cleanup.
- `npx vitest run functions/api/study-path/studyPath.test.ts`: passed after study-path progress/envelope repair, 5 tests.
- `npx vitest run functions/api/study-path/accept.test.ts functions/api/study-path/studyPath.test.ts`: passed after accepted-plan persistence grouping, 8 tests; passed again after accepted-plan payload fallback, 9 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after study-path contract and accepted-plan persistence.
- Latest continuation final targeted pass:
  `npx vitest run functions/api/study-path/accept.test.ts functions/api/study-path/studyPath.test.ts functions/api/study/session-generate.test.ts tests/submitReviewIdempotency.test.ts tests/reservoir-service.test.ts tests/refillWorker.test.ts tests/refillOrchestrator.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit-compat.test.ts`: passed, 125 tests.
- Latest continuation final `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- Latest continuation final `git diff --check`: passed.
- Latest continuation final `npm run lint`: passed with 422 existing raw-color/design-token warnings and no errors.
- Latest continuation final `npm run build`: passed.
- Latest continuation final `npm audit --omit=dev`: passed, zero vulnerabilities.
- `npm run build`: passed with no Sentry upload warning and no chunk-size warning.
- `SENTRY_UPLOAD=false npx vite build --mode production`: passed with the vendor chunk-size warning resolved by manual chunking.
- `npm test`: passed, 478 files, 9,471 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `git diff --check`: passed.

## Known Risks

- The worktree contains many pre-existing changes and deletions beyond this pass; they were preserved.
- The pre-existing deleted Prisma migration remains untouched.
- Production Cloudflare/Clerk/DB runtime smoke was not run in this pass.
- Default fork-pool full Vitest execution is resource-sensitive in this environment; the same full suite passed using `--pool=threads --maxWorkers=4`.
- Dependency upgrades/overrides were performed and passed audit/build/tests, but production runtime parity still needs verification.
- Scheduler deletion and database migration changes were not performed.
- `/api/srs/submit`, `/api/srs/due`, `/api/srs/next`, `/api/srs/sync`, global `/api/sync`, retention stats, and smart review no longer perform active SRSItem DB scheduling reads/writes. The old `lib/services/srsService.ts` localStorage helper is deleted; route shells and schema/types remain for compatibility until a migration-backed cleanup.
- No production endpoint call sites remain for `scheduleConceptReview`; the helper is still present for deprecated compatibility and regression-test mocks.
- Reservoir condition-scoped refill now reconciles `MedicalContent.id` and legacy condition keys, unusable full/partial reservation hydration failures are now failed rather than requeued, and batch submit consumes answered reservoir rows; capacity still counts queued rows only.
- Accepted study-path persistence no longer hard-depends on KV because the client submits the accepted plan payload as a fallback; durable accepted-plan storage remains part of the larger plan contract consolidation.
- The learning identity audit script is read-only and has not been executed against a live or disposable production-like database in this pass.

## Recommended Next Agent Prompt

Implement the canonical identity migration design slice only: run the read-only learning identity audit against a disposable migrated database, decide the persisted source-identity shape for sessions/attempts/review logs/cards, add compatibility reads, and prepare a no-loss backfill plan. Keep `/api/srs/*` route shells until browser/runtime compatibility and migration-backed SRSItem schema cleanup are verified.
