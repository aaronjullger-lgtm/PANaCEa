# PANaCEa Production Readiness Audit

Status: initial audit plus specialist/red-team consolidation, updated 2026-05-01 18:46 EDT.

## Executive Summary

Current production readiness grade: **71/100, C/no-launch**.

Launch gate rule: any unresolved P0 keeps the product in **no-launch** status regardless of the weighted numeric score. The numeric grade is useful for trend tracking, but it must not be used to green-light production while P0 findings remain open.

PANaCEa has a credible product spine: React/Vite frontend, Cloudflare Pages Functions API, Clerk auth, Prisma/Postgres data model, real adaptive session generation, a stronger adaptive dashboard, and many focused tests. It is not production-ready because the release surface is still larger than the proven product, and the learning pipeline is not one canonical contract from question identity through attempts, FSRS, study planning, scheduling, and dashboard signals.

The most important launch posture is: **fail closed first, then repair canonical learning data, then re-enable study modes by readiness.**

Implementation update:
- Fixed current production dependency advisories; `npm audit --omit=dev` now reports zero vulnerabilities.
- Removed browser Todoist OAuth linking, direct API export, client secret use, and localStorage token storage; CSV export remains.
- Changed `/api/health` to public liveness only and added admin-authenticated `/api/admin/readiness`.
- Expanded AI gateway route classification and made AI limiter faults fail closed for AI routes.
- Made `/api/questions/generate` fail closed instead of returning placeholder learner-facing content.
- Removed reviewed silent A/0 answer fallbacks and added alternate correct-answer field support.
- Added pre-generated Question mirror creation in `/api/questions/attempt` before FK-backed attempts.
- Hardened functionality routing: canonical study-plan launches, session ID propagation into `ReviewLog`, linked plan completion, mode/route gating, real protected route mounting, and stale command-palette deletion.
- Added read-only learning identity probes, fail-closed `UserProgress.conditionId` domain guarding, duplicate attempt-endpoint scheduler neutralization, and a production-like mocked learning-pipeline proof.
- Made dashboard review coverage truthful by requiring planned condition/review IDs to match due identities before claiming protection.
- Mounted `system_drill` as a real focused session slice through CoreAdaptiveSession while keeping condition/pharm/rapid/mini-lab candidates hidden.
- Full validation now passes: focused tests, typecheck, lint, build, full Vitest, and audit.

## Grading Scale

Overall score uses the user-specified weighted categories.

Letter grade:
- A: 90-100, production-ready with minor polish.
- B: 80-89, mostly production-ready, moderate fixes needed.
- C: 70-79, promising but not launch-safe.
- D: 60-69, major functionality and reliability gaps.
- F: below 60, not production-ready.

Severity:
- P0: launch blocker.
- P1: serious issue, should fix before production.
- P2: important improvement.
- P3: polish or maintainability.
- P4: nice-to-have.

## Category Grades

| Category | Weight | Grade | Weighted Points | Evidence Summary |
|---|---:|---:|---:|---|
| Product functionality | 15% | 73 | 10.95 | Core auth/app shell/session/progress surfaces exist; canonical study-plan launch, profile sync, route mounting, deep-link safety, and focused system drill improved. |
| Study modes functionality | 15% | 62 | 9.30 | `core_adaptive` and `system_drill` are current launch candidates; deferred modes are now hidden/fail-closed more consistently. |
| Data pipeline / FSRS / scheduling | 15% | 70 | 10.50 | Generation fail-closed, scoring resolution, PGQ attempt mirroring, session ID review linkage, staging promotion identity, SRS compatibility retirement and helper deletion, UserProgress domain guard, and pipeline proof improved; canonical identity migration still blocks launch. |
| Backend/API readiness | 10% | 78 | 7.80 | Health split, AI limiter fail-closed, drill preflight, generation errors, mounted-admin type drift, and SRS submit/due/sync compatibility retirement improved; runtime smoke remains risky. |
| Database/data integrity | 10% | 70 | 7.00 | PGQ promotion, attempt mirroring, lifecycle-filter alignment, read-only identity probes, and fail-closed domain guard improved; migration/backfill decisions remain unresolved. |
| Frontend architecture | 8% | 76 | 6.08 | Adaptive dashboard, route registry, real route mounts, command palette cleanup, and mode gates are stronger. |
| Design/UI/UX | 8% | 73 | 5.84 | Adaptive dashboard is strong and more stale placeholders are hidden; session contrast, nested controls, and design-token warnings remain. |
| Testing/QA | 8% | 80 | 6.40 | Large test base plus new focused route/session/identity tests and production-like learning pipeline proof; live runtime smoke still missing. |
| Security/privacy | 6% | 75 | 4.50 | Dependency audit clean, Todoist client-token risk removed, health diagnostics protected, AI limiter fail-closed; RLS/cross-user SRS risks remain. |
| Deployment/devops | 3% | 63 | 1.89 | Workflows exist and public health/route shape improved; duplicate schedulers, deploy gates, migration drift, and preview/prod parity block launch. |
| Performance/scalability | 2% | 66 | 1.32 | AI rate limiting, lazy route mounting, reservoir refill ownership, and vendor chunk splitting improved; runtime perf smoke remains. |
| **Overall** | **100%** | **71** | **71.43** | **C, no launch.** |

## Repository Orientation

Framework and app:
- Frontend: React 19, TypeScript, Vite, Tailwind, Framer Motion.
- Primary app entry: `index.tsx`, `App.tsx`, `config/AppRoutes.tsx`, `config/routeRegistry.ts`.
- Auth: Clerk frontend guards and Functions middleware in `functions/api/_shared/middleware.ts` and auth helpers.
- Production API: Cloudflare Pages Functions under `functions/api`.
- Local-only API: `routes/` and `server.ts`; should not be treated as production behavior.
- Database: PostgreSQL through Prisma/Prisma Edge, schema at `prisma/schema.prisma`.
- AI providers: Gemini via shared gateway/service patterns, with several direct Gemini calls still present.
- Tests: Vitest, Playwright, Wrangler smoke, production smoke configs.
- Deployment: Cloudflare Pages, `wrangler.toml`, `.github/workflows/deploy.yml`, scheduled automation workflows.

Major product areas:
- Adaptive command center/dashboard: `components/navigation/command-center`, `components/dashboard/adaptive`.
- Study session: `components/session`, `functions/api/study/*`, `functions/api/drills/*`.
- Study modes: `config/training-modes.ts`, `config/lazyComponents.tsx`, `components/layout/DrillViewRouter.tsx`, `pages/PracticePage.tsx`.
- Progress/analytics: `pages/ProgressPage.tsx`, `hooks/useDashboardAnalytics.ts`, `lib/services/dashboardAnalyticsService.ts`.
- Study plans/scheduling: `functions/api/_shared/studyPlanService.ts`, `lib/services/studyPlanService.ts`, `hooks/useTodayPlan.ts`, `hooks/useStudyPlanLaunch.ts`.
- Question generation/storage: `functions/api/questions/*`, `functions/api/_shared/question-*`, `PreGeneratedQuestion`, `Question`, `StagingQuestion`.
- FSRS/reviews: `lib/services/drillReviewService.ts`, `lib/services/userProgressService.ts`, `functions/api/drills/submit-review.ts`, legacy `/api/srs/*`.

## Top Launch Blockers

| Severity | Category | Finding | Affected Files | Why It Matters | Recommended Fix | Verification |
|---|---|---|---|---|---|---|
| Fixed | Frontend/deploy | SPA deep links had no Cloudflare Pages fallback. | `public/_redirects`, `config/AppRoutes.tsx`, `index.tsx` | Direct `/study`, `/practice`, `/study/main-session`, and `/session/:id` refresh/share links need refresh/share safety. | SPA fallback added; keep Wrangler deep-link smoke as release gate. | Build/full Vitest pass; runtime smoke still needed. |
| P0 | Data integrity | `QuestionAttempt.questionId` requires `Question.id`, while served content often uses `PreGeneratedQuestion.id`. | `prisma/schema.prisma`, `functions/api/questions/attempt.ts`, `lib/services/drillReviewService.ts` | Attempts can fail FK or rely on mirror rows, fragmenting question identity. | Add canonical question identity contract and source fields, then migrate writers. | PGQ and canonical question submission tests plus orphan probes. |
| P0 | Data integrity | `UserProgress.conditionId` appears tied to `MedicalContent.id`, while some session/review paths can pass Condition/question-domain IDs. | `prisma/schema.prisma`, `lib/services/userProgressService.ts`, `reviewQuestionResolver.ts` | FSRS progress must not silently accept the wrong domain; launch still needs canonical concept identity migration/backfill. | Guard now fails closed for new wrong-domain rows; resolve and migrate the canonical concept identity domain. | FK/domain guard tests and live identity audit. |
| P0 | AI generation | `/api/questions/generate` can return fake learner-facing fallback questions for missing conditions. | `functions/api/questions/generate.ts` | Clinical learning content must fail closed, not substitute placeholders. | Return typed error/empty state and block placeholder caching/serving. | Missing-condition route test. |
| Fixed | AI generation | Primary generation endpoint now returns typed errors for missing source content or failed generation. | `functions/api/questions/generate.ts`, `functions/api/questions/generate.test.ts` | Prevents placeholder clinical items from reaching learners through this route. | Keep broader generated/RAG/staging adapter consolidation in plan. | Focused fail-closed tests pass. |
| P0 | AI generation | Staging `promoteToLive` omits required `PreGeneratedQuestion.id`. | `functions/api/_shared/staging-questions.ts`, `functions/api/admin/staging/approve.ts`, `prisma/schema.prisma` | Approved generated questions may fail promotion or lose provenance. | Add durable ID, provenance, validation fields, and transactional promotion. | Staging approval test. |
| P0 | Security | Critical/high production dependency advisories exist. | `package.json`, `package-lock.json` | Known vulnerabilities are launch blockers. | Upgrade vulnerable Clerk/protobufjs/Workbox/PWA/serialize-javascript chain. | `npm audit --omit=dev` gate. |
| Fixed | Security | Current production dependency audit is clean. | `package.json`, `package-lock.json` | Removes known advisory launch blocker for current lockfile. | Keep audit as release gate. | `npm audit --omit=dev` passes. |
| P0 | DevOps | Duplicate/unsafe production schedulers can double-run mutating jobs. | `crons/panacea-cron-worker/*`, `.github/workflows/sched-*.yml`, `docs/automation/MIGRATION_MAP.md` | Cloudflare cron worker and GitHub scheduled workflows can overlap; manual-only jobs are scheduled. | Pick exactly one scheduler owner and remove manual/high-risk jobs from unattended cron. | Scheduler inventory test and dry-run production auth/method checks. |
| P0 | Performance | Reservoir refills are not wired to a production worker. | `functions/api/study/session/generate.ts`, `lib/services/reservoir/refillOrchestrator.ts`, `scripts/backgroundWorker.ts` | Warm queue can drain and force slow request-path selection/generation. | Deploy a real refill worker that dispatches `executeRefill` and records queue depth. | Low-reservoir refill test and session p95 latency test. |
| P1 | Performance/security | AI rate limiting had fail-open and route-coverage gaps; current pass fixed gateway/`aiEndpoint` fail-closed behavior for AI KV faults, but exhaustive route inventory and production KV smoke remain. | `functions/api/_shared/middleware.ts`, `functions/api/_middleware.ts`, AI route tests | Costly AI traffic must stay quota-bound in production. | Keep central limiter inventory current and add production KV smoke. | Focused gateway/backend hardening tests plus runtime smoke. |
| Improved | Performance/security | Gateway and `aiEndpoint` now classify more AI routes and fail closed when limiter KV errors. | `functions/api/_middleware.ts`, `functions/api/_shared/middleware.ts`, related tests | Reduces cost-abuse and fail-open risk. | Keep exhaustive route inventory and production KV smoke. | Focused gateway/backend hardening tests pass. |
| P1 | Security/API | Legacy SRS route/schema compatibility shells remain. | `/api/srs/*`, `lib/sdk/types.ts`, `SRSItem` schema. | Old clients may still depend on SRSItem-shaped data even though active DB endpoints are canonical/no-op and the localStorage helper was deleted. | Verify browser/runtime compatibility, then remove route shells/types/schema in a migration-backed cleanup. | Import census, route smoke, and migration/backfill plan. |
| P1 | API/security | Public `/api/health` leaks env presence, DB URL type, row counts, and errors. | `functions/api/health.ts`, `e2e/api-health.spec.ts` | Public diagnostics reveal operational internals. | Public liveness only; authenticated diagnostics elsewhere. | Health tests updated for minimal liveness. |
| Fixed | API/security | Public health is liveness-only; diagnostics moved behind admin auth. | `functions/api/health.ts`, `functions/api/admin/readiness.ts`, E2E specs | Reduces public operational leakage. | Run production Cloudflare smoke. | Typecheck/build/full Vitest pass. |
| P1 | Study modes | Many deferred modes are still configured/routed, and Practice recommendations can include hidden modes. | `config/lazyComponents.tsx`, `lib/modes/modeReadiness.ts`, `pages/PracticePage.tsx` | Users can see or reach unsupported modes. | Gate all recommendations/CTAs through readiness. | Route/CTA readiness tests. |
| P1 | Study plan | Canonical study-plan tasks lose condition IDs and old plan service can regenerate pending plans on read. | `functions/api/_shared/studyPlanService.ts`, `lib/services/studyPlanService.ts`, `functions/api/study-plan/today.ts` | Dashboard review coverage and task completion cannot prove what the plan covers. | Consolidate `StudyPlanTaskV2` and preserve condition/review IDs. | Study-plan V2 contract tests. |

## Confirmed Strengths

- Adaptive dashboard architecture exists and is registry driven with scoring, suppression, visual budgets, mode profiles, fixed slots, and focused tests.
- `WhyThisDrawer` already has Escape close, backdrop close, focus trap, and focus return.
- `drillReviewService` is a materially stronger FSRS core than the surrounding split paths.
- Durable idempotency has been added to `/api/drills/submit-review(s)`.
- Mode readiness gating exists in `lib/modes/modeReadiness.ts` and tests exist, but the UI must consistently use it.
- Many tests pass in prior validation, including adaptive dashboard, command center, mode readiness, submit-review, and critical FSRS suites.

## Specialist Agent Status

| Agent | Status | Grade / Score | Key Output |
|---|---|---:|---|
| Repository cartographer | Complete | 58 | Mapped product/API/data boundaries; found duplicate production/local APIs and deferred modes. |
| Product functionality | Complete | 62 | Found SPA fallback, onboarding sync, study-plan current first-login, and legacy Today launch risks. |
| Study modes | Complete | 50 | Found only `core_adaptive` real-mounted initially; `system_drill` is now mounted through the shared session runner while most modes remain deferred/partial. |
| Data pipeline | Complete | 56 | Traced generation to dashboard; found split-brain learning data and weak scheduling continuity. |
| Backend/API | Complete | 69 | Found `/api/srs/submit` ownership, public health, AI timeout, and envelope issues; submit/due/sync SRS compatibility routes are now safer but runtime smoke remains. |
| Database/Prisma | Complete | 62 | Found migration drift and question/condition identity integrity risks. |
| AI generation | Complete | 62 | Found fake fallback generation, broken staging promotion, and serving filter gaps. |
| FSRS/scheduling | Complete | 61 | Found identity mismatch, divergent SRS writer, missing urgency threading, plan-task condition loss. |
| Frontend architecture | Complete | 68 | Found SPA fallback, legacy launch path, mode leaks, query-cache account-switch risk. |
| Design/UI/UX | Complete | 72 | Found session contrast, nested controls, invalid mode card markup, duplicated mode library. |
| Testing/QA | Complete | 68 | Found no production-grade canonical learning-pipeline proof. |
| Security/privacy | Complete | 62 | Found dependency advisories, Todoist browser secret/token storage, health/RLS/logging risks. |
| Performance/scalability | Complete | 61 | Reservoir refill worker absent, AI rate limiting fail-open, high analytics fanout, hot-index gaps. |
| DevOps/deployment | Complete | 58 | Duplicate schedulers, manual/high-risk cron jobs, migration drift, deploy gate accepting 503. |
| Deprecated/conflicts | Complete | N/A | Legacy dashboard safe to remove after import census; SRS/Express/generation duplicates need adapters or human review. |
| Red-team reviewer | Complete | N/A | Tightened launch-gate rule, moved security fail-closed work earlier, required migration/backfill design before canonical identity edits, and required production-like pipeline tests. |

## Second-Pass Red-Team Updates

| Status | Severity | Area | Finding | Plan Update |
|---|---|---|---|---|
| Confirmed | P0 | Launch governance | Weighted grade can mask unresolved P0s. | Added the explicit D/no-launch rule above. |
| Revised | P1 | Security/privacy | Dependency advisories, Todoist client secret/token storage, public health split, and AI limiter fail-closed behavior were addressed in this pass; RLS/cross-user SRS/runtime smoke remain. | Keep audit and runtime smoke as release gates. |
| Confirmed | P0 | Data integrity | Canonical identity needs schema decision, orphan probes, backfill, compatibility reads, dual-write/dual-read strategy, and rollback before broad implementation. | Added a pre-implementation identity migration slice. |
| Revised | P1 | AI generation | Fail-closed question generation can break learner flows if clients are not updated in the same slice. | Backend error changes must ship with recoverable session/UI empty states and tests. |
| Revised | P1 | Study modes | `core_adaptive` and bounded `system_drill` are the current candidate launch modes, not yet production-safe without runtime smoke and identity migration. | Study modes audit updated; other modes remain blocked by identity, condition FK, launch linkage, and submit proof. |
| Confirmed | P1 | Verification | Vitest/build alone can pass without proving production behavior. | Release gate now requires a production-like Cloudflare/API pipeline smoke with real FK constraints and authenticated contexts. |
| Revised | P1 | DevOps | Scheduler ownership requires operator decision before deleting workflows. | First step is inventory/disable high-risk scheduled jobs; deletion waits for ownership confirmation. |
| Confirmed | P2 | Deprecated cleanup | SRS deletion must wait for a caller migration map and compatibility adapter. | Adapter inventory moves earlier; physical removal stays later. |
