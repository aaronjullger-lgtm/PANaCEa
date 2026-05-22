# Expanded PANaCEa Production Implementation Plan

Status: first full plan plus red-team order hardening, updated 2026-05-03 12:06 EDT. This plan preserves prior P0-P5 work and adds the deeper data-pipeline layer.

## Executive Summary

Current grade after the latest implementation pass: **81/100, B/no-launch**.

Grade rule: unresolved P0 launch blockers force no-launch regardless of the weighted score. The score may improve incrementally, but production release remains blocked until all P0s are resolved or explicitly accepted with documented mitigation.

PANaCEa should not expand the visible product until the launch surface fails closed and the learning data contract is canonical. The dashboard UI work is directionally strong, but it must be backed by truthful question identity, FSRS scheduling, study-plan tasks, and mode readiness.

Latest execution update, 2026-05-03 12:06 EDT:
- Added a shared canonical `Question` mirror helper for approved pre-generated content and wired it through attempt fallback, session generation, admin curation, admin pool seed, staging promotion, and admin question review.
- Made admin question review and auto-approval fail closed unless canonical mirror creation succeeds first.
- Made pending staging questions explicitly human-approvable from admin/refinery flows while preserving automated promotion as graded-only and structurally validated.
- Made CoVe-passed enhanced generation rows production-servable by writing `ACTIVE`/`APPROVED` canonical `Question` records with verification metadata.
- Fixed the enhanced-generation client adapter to send authorization when available, include required `difficulty`, and unwrap the unified API envelope.
- Made `/api/users/me/daily-plan` request-scoped for Edge Prisma, made `/api/study-plan/current` surface persisted accepted plans before target gating, and made `/api/study-path/progress` select the requested cached plan/alternative by `planId`.
- Latest targeted validation passes: 15 focused suites, 118 tests; production typecheck and `git diff --check` pass.

Previous execution update, 2026-05-02 19:50 EDT:
- Completed the Phase A0 security subset for dependencies, Todoist OAuth linking removal, public health split, and AI limiter fail-closed behavior.
- Completed the primary question-generation fail-closed slice for `/api/questions/generate`.
- Removed reviewed silent answer defaults to A/0 in pool, system drill, condition drill, pharmacology drill, and targeted daily submit.
- Added legacy `/api/questions/attempt` pre-generated Question mirror creation before FK-backed attempts.
- Added functionality hardening for study-plan launch success checks, session ID propagation into `ReviewLog`, linked study-plan completion, profile/preferences/sync envelope parsing, private-beta route/mode gating, real protected route mounting, and stale command-palette cleanup.
- Added a read-only learning identity audit script for attempt/log/card/progress/session identity probes.
- Removed the duplicate `scheduleConceptReview` side effect from `/api/questions/attempt`.
- Added `UserProgress.conditionId` domain guarding so wrong-domain IDs fail closed instead of being swallowed as normal scheduler outcomes.
- Added a production-like mocked learning-pipeline proof from review submission through dashboard review coverage input.
- Made dashboard review coverage identity-based through task `conditionIds`/`reviewCardIds`.
- Mounted `system_drill` as the first real focused-mode slice beyond core adaptive, using CoreAdaptiveSession with targeted topic settings.
- Hardened legacy study-mode compatibility routes after the backend route optimization pass: `/api/questions/session` now fails closed to approved persisted content, its client unwraps production response envelopes, `/api/srs/next` returns a normalized production-filtered question DTO, `/api/srs/due` validates flat query params, active drill/SRS submit routes no longer call `scheduleConceptReview`, and reservoir refill no longer queues `Question.id` into a `PreGeneratedQuestion` FK.
- Removed the remaining production `scheduleConceptReview` call from OSCE grading while preserving OSCE `ConceptGap` creation for Tutor/adaptive targeting.
- Tightened `/api/srs/due` with optional progress-context filtering and duplicate suppression across Card, UserTopicProgress, and UserProgress.
- Fixed SRS SDK due-item date normalization and made reservoir bulk insert health report actual inserted rows instead of attempted rows under `ON CONFLICT DO NOTHING`.
- Reconciled `/api/srs/due` and `/api/srs/next`: due Cards launch first, unsafe Card-linked questions are skipped, and TARGETED/READINESS context now flows through the legacy SRS flashcard submit path.
- Fixed condition-scoped reservoir refill so study-plan targets keyed by `MedicalContent.id` can find due progress rows and approved pre-generated pool questions keyed by either `medicalContentId` or legacy `conditionId`.
- Added terminal reservoir failure cleanup for full-session reservations that do not hydrate into production-safe questions.
- Closed the remaining reservoir lifecycle gap for partial reservations and batch review submit consumption.
- Fixed study-path dashboard/progress API-envelope handling, repaired `/api/study-path/progress` internal user/planner calls, persisted accepted study paths into launchable daily-plan tasks from cache or submitted accepted-plan payload, and preserved accepted pending plans on subsequent reads.
- Hardened SRS flashcard submit truth: the UI no longer shows explanations or advances when `/api/srs/submit` fails, offline legacy SRS submit no longer claims success, and SDK submit types match the current compatibility endpoint.
- Removed ungraded and structurally invalid staging approval bypasses, made adequacy checks fail closed when medical accuracy review is unavailable, preserved staging-to-pool identity on approval, and made RAG-generated questions persist only as preview staging rows until approval.
- Validation now passes: focused Vitest suites, production typecheck, lint, build, full Vitest, and `npm audit --omit=dev`.
- Still no launch: canonical identity migration/backfill, canonical UserProgress concept identity migration, remaining localStorage SRS helper exports, full StudyPlanTask V2 consolidation, and production runtime smoke remain.

Implementation order:

1. Fail closed.
2. Repair canonical data flow.
3. Re-enable functionality by readiness.

## Top 10 Launch Blockers

1. Missing SPA fallback in `public/_redirects`.
2. Critical/high production dependency advisories. **Status: fixed in current lockfile; `npm audit --omit=dev` passes.**
3. Duplicate/unsafe production schedulers can double-run mutating jobs. **Status: improved for questions attempt, study/SRS submit, and OSCE grading; cron/job ownership still needs operator review.**
4. Reservoir lifecycle needs live smoke proof and capacity policy review, though the reviewed FK, condition-domain refill, full/partial reservation failure, and batch-consume blockers are fixed.
5. AI rate limiting misses expensive routes and can fail open. **Status: improved for gateway + `aiEndpoint`; keep route inventory as P1.**
6. Canonical question identity absent across `Question`, `PreGeneratedQuestion`, attempts, sessions, cards, review logs.
7. `UserProgress.conditionId` identity mismatch risk. **Status: guarded fail-closed for new rows; canonical concept migration/backfill remains.**
8. Fake/placeholder question generation can reach learner-facing paths. **Status: fixed for `/api/questions/generate`; RAG output is preview-only staging, enhanced CoVe-passed output is ACTIVE/APPROVED, and admin approval now requires canonical mirrorability. Batch generation remains review-queue-only.**
9. Public `/api/health` exposes diagnostics. **Status: fixed; diagnostics moved to admin readiness.**
10. Remaining legacy SRS route/schema compatibility shells need a deletion window after browser/runtime compatibility and migration-backed cleanup are verified.

## Top 10 Functionality Blockers

1. Today CTA can route through legacy session path instead of canonical `/study/main-session`. **Status: improved; command center launches the first actionable task through canonical `/study/main-session` and blocks navigation when progress start fails.**
2. Onboarding profile fields are collected but not fully persisted/synced. **Status: improved; profile update now sends collected onboarding fields, pending schema audit for all fields.**
3. `/api/study-plan/current` can fail first-login user lookup. **Status: fixed; it resolves/creates the user and now surfaces persisted accepted plans before target gating.**
4. `CoreAdaptiveSession` passes broad `focus: 'due'` for non-due sessions. **Status: fixed for current session settings; scope now drives topic/all focus and systems.**
5. Practice recommendations can display hidden/deferred modes. **Status: improved; Practice, TrainingMenu, Daily Challenges, and command-palette launches fail closed through readiness gates; `system_drill` is now intentionally visible because it is real-mounted.**
6. Duplicate mode libraries conflict.
7. Study plan launch does not fully prove response success before navigation. **Status: fixed for the current launch hook; failed start-progress responses no longer navigate/write session intent.**
8. Session resume silently drops missing untyped question IDs.
9. Weakness tagging endpoint does not reliably update recurrence state.
10. Dashboard review coverage cannot prove exact condition/review coverage unless upstream plan tasks and forecasts carry IDs. **Status: renderer/normalizer now require matching `conditionIds`/`reviewCardIds`; upstream completeness remains.**

## Top 10 Data Pipeline Blockers

1. No durable shared question identity. **Status: improved with shared canonical mirror compatibility; migration/backfill remains.**
2. No typed persisted session question source.
3. PGQ attempts rely on mirror workaround or can fail FK. **Status: improved; attempt fallback and approval/serving paths now share canonical mirror logic.**
4. `UserProgress.conditionId` domain mismatch. **Status: guarded fail-closed; schema/domain migration remains.**
5. Review writes are not atomic across attempt/log/progress/card/topic.
6. Legacy SRS writes duplicate scheduling semantics. **Status: active drill/SRS submit paths, `/api/questions/attempt`, and OSCE grading duplicate scheduler side effects are neutralized; cron/job ownership remains.**
7. READINESS/TARGETED due-review context propagation is fixed for SRS due/next/submit; broader mode/context aggregation remains incomplete.
8. Staging promotion omits required PGQ ID and provenance.
9. Pool regeneration can orphan soft references.
10. Dashboard analytics include known scale/truth risks.

## Top 10 Study Mode Blockers

1. Only `core_adaptive` and the bounded `system_drill` slice are real mounted.
2. Mode contracts and mounted component readiness drift.
3. Deferred modes are routed and can be recommended.
4. EOR urgency not threaded into submit/scheduling.
5. Didactic/PANRE planner contexts are incomplete.
6. Rapid recall still lacks a real attempt-only mode implementation even though `/api/srs/due` now reads canonical progress.
7. Cram/rapid must remain attempt-only and be tested.
8. Drill modes need explicit progress context. **Status: `system_drill` now launches as `mode: "targeted"` / `focus: "topic"` through CoreAdaptiveSession; other drills remain hidden.**
9. Visual/media modes need real media inventories and no dummy content.
10. OSCE/patient modes remain mock/deferred and must stay hidden.

## Security And Privacy Risks

- Patch production dependency advisories. **Done for current lockfile; keep audit gate.**
- Remove Todoist client secret and localStorage token storage from client-visible code. **Done; client retains CSV-only export.**
- Split public health from protected readiness diagnostics. **Done; `/api/admin/readiness` is admin-only.**
- Keep `/api/srs/submit` as a compatibility adapter over `drillReviewService`; verify route/runtime consumers before deleting route shells and SRSItem schema/types.
- Add RLS for behavior metrics and fix reservoir policy identity comparison.
- Add deletion/export/purge/retention flows.
- Fail closed or use stronger policy for sensitive rate-limit/body-cap errors.
- Redact stable user IDs in logs and prompt/behavior telemetry in observability.

## Testing Gaps

- Canonical pipeline E2E: session -> submit-review -> attempt -> ReviewLog -> UserProgress/Card -> plan completion -> dashboard signal. **Status: mocked production-like proof added; live Cloudflare/Clerk/DB smoke still needed.**
- DB integrity: migration status, FK/orphan probes, PGQ/canonical identity.
- AI generation: fail-closed routes, staging promotion, RAG rewrite validation.
- Study-plan V2: no regeneration on read, launch links, linked completion.
- Mode readiness: no visible CTA to deferred/unknown routes.
- Health tests must stop expecting public diagnostics.
- Wrangler/API smoke should become a release gate.

## Deployment Risks

- Direct route refresh risk until SPA fallback is added.
- Deploy workflow uses production migrations and Pages deploy, but branch/deploy gate strictness and manual production controls need review.
- Cloudflare cron worker and GitHub scheduled workflows can overlap; scheduler ownership must be singular before production.
- Current cron worker includes jobs documented as manual/high-risk and not all endpoints match the worker auth/method contract.
- Preview Cloudflare KV/DB/Clerk/Gemini/Sentry parity needs operator verification.
- Public health endpoint currently leaks diagnostics and is used by smoke tests.
- Sentry sourcemap upload is gated against placeholder local config; production token/org/project must still be confirmed.

## Deprecated/Conflicting Code Risks

- Legacy dashboard code is deleted in worktree, but stale docs remain.
- Old SRS system is deprecated but still used.
- Express `routes/` are local-only and must not become production references.
- Duplicate command palettes and mode libraries should be consolidated.
- Old generation/staging services must be deprecated only after canonical adapter exists.

## Implementation Phases

### Phase A0: Security And Release Fail-Closed First

File-level tasks:
- `package.json` and lockfile: patch production dependency advisories, then add/keep `npm audit --omit=dev` as a release gate.
- Todoist integration files: disable production exposure or remove client-visible secret/token storage before any public launch.
- `functions/api/health.ts`: split public liveness from authenticated diagnostic readiness.
- `functions/api/_shared/middleware.ts`, `functions/api/_middleware.ts`, and AI routes: centralize AI limiter coverage and make sensitive limiter/body-cap failures fail closed.
- `.github/workflows/sched-*.yml` and `crons/panacea-cron-worker/src/index.ts`: inventory all mutating scheduled jobs and disable high-risk/manual-only unattended schedules. Final scheduler ownership requires an operator decision before workflow deletion.

### Phase A1: Fail Closed Foundations

File-level tasks:
- `public/_redirects`: add SPA fallback.
- `pages/PracticePage.tsx`: filter recommended modes with readiness/visibility.
- `functions/api/study-plan/current.ts`: use `resolveOrCreateUserRecord`.
- `functions/api/questions/generate.ts`: return typed error for missing condition/failure, no fake question. Ship this with session/UI empty/error handling in the same slice.
- `functions/api/_shared/staging-questions.ts`: add PGQ ID and provenance on promotion.
- `functions/api/drills/submit-reviews.ts`: unauthenticated OPTIONS 204.

### Phase B: API/Data Contract Hardening

File-level tasks:
- Add a schema decision record and migration plan before editing production writers: canonical identity fields, orphan probes, backfill, compatibility reads, dual-write/dual-read window, rollback, and no-data-loss acceptance checks.
- `lib/study/questionIdentity.ts`: expand contract from helper into shared API/runtime shape.
- `lib/sessionGeneration.ts`: persist question source identity in generated session records.
- `functions/api/study/session/generate.ts`: include source identity and lifecycle filters.
- `functions/api/study/session/[sessionId]/questions.ts`: hydrate by persisted source, fail clearly on missing questions.
- `functions/api/drills/_shared/reviewQuestionResolver.ts`: return canonical source identity and condition key.
- `functions/api/drills/submit-review.ts` and `submit-reviews.ts`: forward urgency multiplier and learning context.

### Phase C: FSRS And Scheduling Truth

File-level tasks:
- `functions/api/srs/submit.ts`: keep compatibility adapter behavior and add production smoke around canonical review writes. **Status: adapter now delegates to `drillReviewService` without the legacy concept scheduler side effect.**
- `lib/services/drillReviewService.ts`: define critical atomic write boundary and compensating behavior.
- `lib/services/userProgressService.ts`: fail closed or explicit diagnostic on FK identity mismatch.
- `lib/services/dailyStudyAllocatorService.ts`: explicitly aggregate or separate READINESS/TARGETED due pressure.
- `lib/services/reservoir/*`: add source identity, reserve/consume/release/fail tests, stuck repair tests. **Status: refill no longer queues standard `Question.id` rows into `StudentReservoirItem.questionId`, condition-scoped refill resolves `MedicalContent.id` and legacy condition IDs, full and partial reservation hydration failures are marked failed instead of requeued, batch submit consumes answered reservoir rows, and bulk insert counts now reflect actual inserted rows; capacity policy and live smoke remain.**

### Phase D: Study Plan Contract Consolidation

File-level tasks:
- `lib/api/types/studyPlan.ts`: define `StudyPlanTaskV2`.
- `functions/api/_shared/studyPlanService.ts`: preserve `conditionIds`, `reviewCardIds`, `launchSettings`, and route.
- `lib/services/studyPlanService.ts`: migrate or delegate to shared contract.
- `functions/api/study-path/accept.ts`: accepted study paths now persist launchable daily-plan tasks from cache or submitted payload; next step is replacing payload/cache reconstruction with durable accepted-plan storage under the V2 contract.
- `hooks/useTodayPlan.ts`: consume V2 schema.
- `hooks/useStudyPlanLaunch.ts`: check `response.ok`, carry `taskId` and `planDate`.
- `functions/api/study-plan/*` and `functions/api/users/me/daily-plan.ts`: compatibility wrappers after migration.

### Phase E: Study Modes

File-level tasks:
- `lib/modes/modeReadiness.ts`: keep as source of discoverability.
- `config/lazyComponents.tsx`: replace productionDeferred only when mode is real.
- `pages/PracticePage.tsx`, `TrainingMenu`, command palette: no visible deferred routes.
- Per mode: define backend/session/progress contract before enabling.

### Phase F: Dashboard Truth And UI Hardening

File-level tasks:
- `components/dashboard/adaptive/engine/normalizeSignals.ts`: derive coverage only from specific condition/review IDs.
- `ReviewCoverageWidget.tsx`: avoid normal red/risk styling unless critical.
- `visualBudget.ts`: account for red surfaces beyond `visual.tone`.
- `CoreAdaptiveSession.tsx`: fix contrast and use `QuizViewWithErrorBoundary`.
- `AnswerChoice.tsx`: remove nested interactive button.
- `PracticePage.tsx`: fix ModeCard invalid markup.

### Phase G: Security, Privacy, And Ops Follow-Through

File-level tasks:
- `functions/api/_shared/rateLimiter.ts`, middleware: body caps and sensitive fail-closed policy.
- RLS migrations: fix reservoir policy and add behavior metrics policy after migration drift is resolved.
- Logging/observability files: hash/truncate IDs and redact prompt/telemetry.
- `.github/workflows/deploy.yml`: require CI for manual deploys, run backend env validation, and reject non-200 health.
- `DEPLOYMENT_CHECKLIST.md`, `docs/deployment/ROLLBACK.md`, and automation docs: align Cloudflare project names, direct migration URL, and rollback procedure.

### Phase G2: Performance And Runtime Capacity

File-level tasks:
- `lib/services/reservoir/refillOrchestrator.ts`, `scripts/backgroundWorker.ts`, cron/worker files: dispatch reservoir refill jobs to `executeRefill`.
- `functions/api/study/session/generate.ts`: keep request path free of AI generation once reservoir worker is live.
- `hooks/useDashboardAnalytics.ts`, `functions/api/analytics/*`, `lib/services/dashboardAnalyticsService.ts`: collapse dashboard fanout into bounded aggregate endpoint.
- `prisma/schema.prisma`: add verified hot-path indexes after migration drift is resolved.
- `vite.config.ts`: remove long-lived Workbox caching for authenticated question/session API routes.

### Phase H: Deprecated Cleanup

File-level tasks:
- Keep verified deleted legacy dashboard files removed.
- Update docs that point to old dashboard or old launch paths.
- Remove/delegate old command palette after import census.
- Archive old plans or add superseded headers.
- Do not delete `/api/srs/*` until active callers are migrated.

### Phase I: Verification And Launch Gate

Run in order:

```bash
npx vitest run components/dashboard/adaptive/engine/resolveDashboardWidgets.test.tsx components/navigation/command-center/CommandCenterWorkspace.test.tsx lib/modes/modeReadiness.test.ts tests/privateBetaVisibility.test.ts
npx vitest run functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts tests/drillReviewService.test.ts tests/submitReviewSchema.test.ts
npx vitest run lib/study/questionIdentity.test.ts functions/api/study/session-generate.test.ts lib/sessionGeneration.test.ts lib/study/sessionRuntime.test.ts functions/api/study-plan/today.test.ts functions/api/users/me/daily-plan.test.ts
NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck
npm run lint
npm run build
npm test
npm audit --omit=dev
```

Production runtime smoke:

```bash
npm run build
npx wrangler pages dev dist --port 8788 --compatibility-date=2024-01-01 --compatibility-flags=nodejs_compat
BASE_URL=http://localhost:8788 npm run test:e2e:wrangler
E2E_REQUIRE_AUTH=1 npm run test:e2e:production-smoke
```

## Rollback Strategy

- Frontend fail-closed fixes should be reversible with small patches.
- Data model migrations require orphan probes before deploy and migration rollback docs.
- Feature gates should default to hidden/deferred until verified.
- Keep compatibility wrappers for old plan/SRS endpoints until callers are migrated.
- Do not delete old data or destructive scripts without archive path and operator confirmation.

## Red-Team Verification Additions

Before changing the canonical identity contract, run or create:
- Disposable migrated database smoke with real FK constraints.
- Orphan probes for Question/PreGeneratedQuestion/QuestionAttempt/ReviewLog/UserProgress/Card relationships.
- Cross-user forbidden write tests for legacy and compatibility endpoints.
- Cloudflare Pages Functions runtime smoke for CORS preflight, auth, idempotency, retry, and typed error envelopes.
- One production-like learning-pipeline test: session generate -> served question identity -> answer submit -> correctness -> ReviewLog/UserProgress/Card -> study-plan completion signal -> dashboard signal.

## Acceptance Criteria

- Build, typecheck, lint, and targeted tests pass.
- Public routes deep-link correctly.
- Visible modes are discoverable only when real and mounted.
- Fake generation paths fail closed.
- Question identity is canonical through session and submit.
- FSRS writes have one authoritative path.
- Study-plan tasks carry condition/review IDs and completion is linked.
- Dashboard coverage is backed by real plan/task evidence.
- No critical/high production dependency advisories remain.
- Public health is liveness only; diagnostics are protected.
- Remaining P0/P1 issues are documented if not fixed.
