# PANaCEa Production Readiness Implementation Log

## 2026-05-01 01:11 EDT - Repository Orientation And Specialist Audits

Files changed:
- Added root audit/planning documents:
  - `PRODUCTION_READINESS_AUDIT.md`
  - `PRODUCTION_IMPLEMENTATION_PLAN.md`
  - `STUDY_MODES_FUNCTIONALITY_AUDIT.md`
  - `DATA_PIPELINE_AND_SCHEDULING_AUDIT.md`
  - `DEPRECATED_CODE_AND_CONFLICTS_AUDIT.md`
  - `IMPLEMENTATION_LOG.md`

Why:
- User requested a full production readiness audit, grade, deep plan, second pass, deprecated-code audit, incremental implementation, and persistent execution log.

What was inspected:
- Skills/instructions: PANaCEa navigator, PANaCEa dev, session orchestration, clinical content generation, FSRS guardrails, dashboard trust, repo hygiene, security, verification, async state.
- Repo docs and configs: `README.md`, `package.json`, `wrangler.toml`, `public/_redirects`, `public/_headers`, `.github/workflows/*`, existing production readiness ledgers/docs.
- App architecture: `App.tsx`, `config/AppRoutes.tsx`, `config/routeRegistry.ts`, `config/lazyComponents.tsx`, `pages/PracticePage.tsx`.
- Dashboard architecture: `components/navigation/command-center/CommandCenterWorkspace.tsx`, `components/dashboard/adaptive/**`.
- Study session pipeline: `components/session/CoreAdaptiveSession.tsx`, `components/session/QuizView.tsx`, `lib/sessionGeneration.ts`, `functions/api/study/session/generate.ts`, `functions/api/study/session/[sessionId]/questions.ts`.
- Review/FSRS: `functions/api/drills/submit-review.ts`, `functions/api/drills/submit-reviews.ts`, `lib/services/drillReviewService.ts`, `functions/api/srs/submit.ts`, `lib/services/srsService.ts`.
- Study plans: `functions/api/_shared/studyPlanService.ts`, `lib/services/studyPlanService.ts`, `hooks/useTodayPlan.ts`, `hooks/useStudyPlanLaunch.ts`.
- Question generation: `functions/api/questions/generate.ts`, `generate-rag.ts`, `pool.ts`, `_shared/question-schema.ts`, `_shared/question-validator.ts`, `_shared/staging-questions.ts`.
- Database: `prisma/schema.prisma`, migrations surfaced by agents.

Specialist agents completed:
- Repository cartographer.
- Product functionality.
- Study modes.
- Data pipeline.
- Backend/API.
- Database/Prisma.
- AI generation.
- FSRS/scheduling/study plan.
- Frontend architecture.
- Design/UI/UX.
- Testing/QA.
- Security/privacy.
- Performance/scalability.
- DevOps/deployment.
- Deprecated-code/conflict resolution.

Specialist agents still pending at the time this entry was updated:
- Red-team production reviewer.

Verification run:
- `date '+%Y-%m-%d %H:%M %Z'` returned `2026-05-01 01:11 EDT`.
- Static inspections only; no product-code changes yet.

Results:
- Current grade recorded as 62/100, D.
- No launch recommendation until P0/P1 items are fixed or explicitly accepted.

Remaining risks:
- Red-team review still needs to run after the first plan.
- Product-code implementation has not started yet in this workflow.

Follow-up tasks:
- Run red-team second pass.
- Start small fail-closed implementation slice.

## 2026-05-01 01:20 EDT - Late Specialist Findings Integrated

Files changed:
- `PRODUCTION_READINESS_AUDIT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `DEPRECATED_CODE_AND_CONFLICTS_AUDIT.md`
- `IMPLEMENTATION_LOG.md`

Why:
- Integrated performance, deployment, and deprecated-code specialist findings after they completed.

What was verified:
- Performance agent found reservoir refill jobs are not wired to a real production worker and AI rate limiting can fail open or miss expensive routes.
- DevOps agent found duplicate scheduler ownership between Cloudflare cron and GitHub schedules, manual/high-risk cron jobs, migration drift, deploy health accepting `503`, and manual deploy gate gaps.
- Deprecated-code agent found legacy dashboard deletion is likely safe after import census, but SRS, Express routes, FSRS scheduling, generation services, TrainingMenu/PracticePage, and old docs require adapter/human-review paths.

Tests/checks run:
- Static/document updates only; no test run for this doc-only slice.

Remaining risks:
- Red-team pass pending.
- Implementation pending.

## 2026-05-01 01:34 EDT - Red-Team Pass And First Stabilization Slice

Files changed:
- `PRODUCTION_READINESS_AUDIT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `STUDY_MODES_FUNCTIONALITY_AUDIT.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_LOG.md`
- `public/_redirects`
- `pages/PracticePage.tsx`
- `functions/api/study-plan/current.ts`
- `functions/api/drills/submit-review.ts`
- `functions/api/drills/submit-reviews.ts`
- `functions/api/_shared/staging-questions.ts`
- `tests/submitReviewIdempotency.test.ts`

Why:
- Reran the incomplete red-team reviewer and integrated its order/risk corrections.
- Started the smallest fail-closed foundation slice: SPA fallback, deferred mode recommendation filtering, first-login-safe study-plan lookup, unauthenticated drill preflight, and staging-to-live question identity/provenance.

What was verified:
- `public/_redirects` now has a React Router fallback after static asset pass-through.
- `PracticePage` recommendation filtering now uses `isPrivateBetaModeVisible`.
- `/api/study-plan/current` now uses `resolveOrCreateUserRecord` instead of throwing when Clerk auth arrives before webhook user sync.
- Both singular and batch drill review endpoints expose unauthenticated OPTIONS preflight through the shared CORS helper.
- Staging question promotion now writes a durable `PreGeneratedQuestion.id`, approved validation metadata, and provenance inside `questionData`.
- Legacy dashboard conflict search still finds no live old dashboard routes/components; remaining hits are docs, tests, and the active adaptive page.

Tests/checks run:
- `npx vitest run tests/privateBetaVisibility.test.ts tests/submitReviewIdempotency.test.ts` passed: 2 files, 13 tests.
- After adding CORS regression coverage, `npx vitest run tests/submitReviewIdempotency.test.ts tests/privateBetaVisibility.test.ts` passed: 2 files, 15 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck` passed.
- `npm run lint` passed with 437 existing warnings, all raw-color/design-token warnings.
- `npm run build` passed; Sentry source-map upload warned because project/org config was not accepted, and Vite reported large chunk warnings.
- `npm test` passed: 453 files, 9,383 tests passed, 1 skipped.
- `npm audit --omit=dev` failed with 22 production vulnerabilities: 2 critical, 6 high, 14 moderate. Critical advisories include Clerk shared SDK route-protection bypass and protobufjs arbitrary code execution.
- `rg "DashboardPage|UnifiedDashboard|Daily Pilot|Data Scientist|Study Impact Map|review pressure" components pages lib functions docs *.md` found active adaptive dashboard references and stale docs only.

Remaining risks:
- `git diff` includes pre-existing changes in the same files, notably reservoir consumption in `functions/api/drills/submit-review.ts` and existing CTA gating in `pages/PracticePage.tsx`; these were preserved.
- Full typecheck/lint/build still need to run after additional slices.
- Production dependency advisories remain a P0 launch blocker.
- Question generation fail-closed changes are intentionally deferred until paired with recoverable UI empty/error handling.

Follow-up tasks:
- Move dependency audit/Todoist/health/AI limiter work earlier before further UI polish.
- Create canonical identity migration/backfill decision record before broad data-contract edits.

## 2026-05-01 06:40 EDT - Security, Generation, Scoring, And Identity Hardening Slice

Files changed:
- `package.json`
- `package-lock.json`
- `components/integrations/TodoistCallback.tsx`
- `components/integrations/TodoistExportModal.tsx`
- `lib/services/todoistService.ts`
- `functions/api/health.ts`
- `functions/api/admin/readiness.ts`
- `functions/api/_middleware.ts`
- `functions/api/_middleware.test.ts`
- `functions/api/_shared/middleware.ts`
- `functions/api/_shared/__tests__/backend-hardening.test.ts`
- `functions/api/questions/generate.ts`
- `functions/api/questions/generate.test.ts`
- `functions/api/questions/attempt.ts`
- `functions/api/questions/attempt.test.ts`
- `functions/api/questions/pool.ts`
- `functions/api/questions/system-drill.ts`
- `functions/api/questions/condition-drill.ts`
- `functions/api/questions/pharmacology-drill.ts`
- `functions/api/targeted-daily/submit.ts`
- `lib/study/questionIdentity.ts`
- `lib/study/questionIdentity.test.ts`
- Root audit/report/plan markdown files.

Why:
- User asked to continue fixing remaining blockers and explicitly allowed removing Todoist linking.
- Addressed the highest-impact security and data-truth blockers that could be fixed without a broad schema migration.

What was verified:
- Production dependency audit is clean after targeted package updates/overrides.
- Client-side Todoist OAuth linking, client secret usage, direct Todoist API export, and localStorage token storage were removed; CSV export remains.
- Public `/api/health` no longer exposes env, DB, auth, content, or user-count diagnostics; admin diagnostics live at `/api/admin/readiness`.
- Gateway and `aiEndpoint` rate limiting now fail closed for AI-route KV faults and cover additional expensive AI prefixes.
- `/api/questions/generate` returns typed errors for missing source content or generation failure and does not cache/return placeholder questions.
- Reviewed question-serving paths no longer silently default unresolvable correct answers to A/0.
- `/api/questions/attempt` creates a pre-generated Question identity mirror before writing FK-backed `QuestionAttempt`.

Tests/checks run:
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `npx vitest run functions/api/_shared/__tests__/backend-hardening.test.ts functions/api/_middleware.test.ts`: passed, 10 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/__tests__/backend-hardening.test.ts functions/api/_middleware.test.ts`: passed, 13 tests.
- `npx vitest run lib/study/questionIdentity.test.ts functions/api/questions/generate.test.ts functions/api/_shared/__tests__/backend-hardening.test.ts functions/api/_middleware.test.ts`: passed, 19 tests.
- `npx vitest run functions/api/questions/attempt.test.ts lib/study/questionIdentity.test.ts functions/api/questions/generate.test.ts`: passed, 40 tests.
- After tightening PGQ mirror creation to require a resolvable correct answer, `npx vitest run functions/api/questions/attempt.test.ts && NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `npm run build`: passed; Sentry source-map upload still warns about project/org config, and Vite chunk-size warnings remain.
- `npm test`: passed, 455 files, 9,393 tests passed, 1 skipped.

Remaining risks:
- Full canonical question/source identity across sessions, attempts, ReviewLog, Card, UserProgress, and dashboard signals still needs migration design and backfill.
- `UserProgress.conditionId` domain mismatch remains unresolved.
- Legacy `/api/srs/submit` remains a divergent writer until compatibility adapter/caller migration is complete.
- Reservoir refill worker and scheduler ownership are still production blockers.
- Cloudflare Pages Functions runtime smoke was not run in this slice.

Follow-up tasks:
- Run orphan probes against a disposable migrated database.
- Design and implement canonical persisted source identity before further broad data-pipeline edits.
- Build a production-like learning-pipeline smoke: session generation -> submit -> FSRS/progress/card -> study-plan completion -> dashboard signal.

## 2026-05-01 07:30 EDT - Functionality, Route Cohesion, And Session Linkage Slice

Files changed:
- `App.tsx`
- `config/AppRoutes.tsx`
- `config/lazyComponents.tsx`
- `lib/modes/privateBetaVisibility.ts`
- `components/session/QuizView.tsx`
- `components/session/CoreAdaptiveSession.tsx`
- `lib/services/drillReviewService.ts`
- `hooks/useStudyPlanLaunch.ts`
- `hooks/useTodayPlan.ts`
- `components/navigation/command-center/CommandCenterWorkspace.tsx`
- `components/navigation/command-center/CommandCenterWorkspace.test.tsx`
- `components/navigation/CommandPalette.tsx`
- `components/dashboard/TrainingMenu.tsx`
- `pages/PracticePage.tsx`
- `pages/ProgressPage.tsx`
- `hooks/useUserProfile.ts`
- `hooks/useRolling360Stats.ts`
- `hooks/useUserStats.ts`
- `utils/preferencesSync.ts`
- `functions/api/_shared/studyPlanService.ts`
- `lib/services/studyPlanService.ts`
- `components/ui/system.ts`
- `services/domain/audit/mappingAuditLogger.ts`
- `services/domain/blueprintComplianceService.ts`
- `services/domain/mappingEnrichment/previewService.ts`
- `types/api.ts`
- `components/command/CommandPalette.tsx` deleted.

Why:
- Continue production-readiness work into actual site functionality and feature cohesion.
- Close visible/deferred route conflicts, stale command-palette duplication, profile/sync envelope parsing, study-plan launch truth, and session-summary linkage gaps found by the functionality agents.

What was verified:
- `/study` still routes through command center -> adaptive dashboard, while Today launches the first actionable plan task through the canonical `/study/main-session` URL.
- Study-plan launch no longer navigates or writes session intent when the start-progress call fails.
- `QuizView` forwards `sessionId` through review telemetry, and `drillReviewService` persists it to `ReviewLog.sessionId`, allowing session summaries and linked plan completion to use the actual session.
- `CoreAdaptiveSession` now waits for plan completion writes before showing the summary and scopes QuizView settings from the selected/study-plan scope.
- Practice, TrainingMenu, Daily Challenges, and command-palette results fail closed around private-beta/mode-readiness gates.
- Real protected admin, clinical profile, evidence search, simulation, and utility pages are mounted where backing components exist; deferred modes remain hidden.
- Mounting those real admin slices exposed and fixed stale admin domain type drift: `MappingAuditAction`, unsupported audit metadata, `SystemMapping.canonicalName`, `Question.lifecycleStatus`/`qaStatus`, and the missing table row token.
- Unused OAuth-style Todoist API types and the deprecated command-palette shim were removed; CSV Todoist export remains.

Tests/checks run:
- `npx vitest run functions/api/drills/submit-review.test.ts functions/api/study/session-summary.test.ts hooks/useStudyPlanLaunch.test.tsx components/navigation/command-center/CommandCenterWorkspace.test.tsx tests/syncResponseShape.test.ts`: passed, 42 tests.
- `npx vitest run tests/privateBetaVisibility.test.ts tests/routeRegistry.test.ts lib/modes/modeReadiness.test.ts hooks/useStudyPlanLaunch.test.tsx components/navigation/command-center/CommandCenterWorkspace.test.tsx tests/syncResponseShape.test.ts functions/api/drills/submit-review.test.ts functions/api/study/session-summary.test.ts`: passed, 78 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `npm run build`: passed; Sentry source-map upload still warns about project/org config, and Vite chunk-size warnings remain.
- `npm test`: passed, 456 files, 9,395 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, zero vulnerabilities.

Remaining risks:
- Canonical source identity across session question IDs, attempts, ReviewLog, Card, UserProgress, and dashboard signals still needs migration/backfill design.
- Legacy `/api/srs/submit` remains a divergent writer.
- Reservoir refill worker/scheduler ownership still block launch.
- Daily Challenges route is now gated because its underlying modes are not production-ready.
- Production Cloudflare/Clerk/DB runtime smoke was not run in this slice.

Follow-up tasks:
- Build the production-like learning-pipeline smoke from session generation through dashboard signal.
- Migrate or wrap `/api/srs/submit` behind the drillReviewService compatibility adapter.
- Resolve canonical source identity and UserProgress concept identity before re-enabling deferred study modes.

## 2026-05-01 10:39 EDT - Post-Implementation Hardening Slice

Files changed:
- `components/session/CoreAdaptiveSession.tsx`
- `components/session/CoreAdaptiveSession.test.ts`
- `config/AppRoutes.tsx`
- `hooks/useStudyPlanLaunch.ts`
- `hooks/useStudyPlanLaunch.test.tsx`
- `functions/api/users/me/daily-plan.ts`
- `functions/api/users/me/daily-plan.test.ts`
- `functions/api/_shared/studyPlanService.ts`
- `functions/api/_shared/zodSchemas.ts`
- `functions/api/user/profile.test.ts`
- `lib/services/studyPlanService.ts`
- `lib/services/studyPlanService.test.ts`
- `lib/modes/privateBetaVisibility.ts`
- `tests/privateBetaVisibility.test.ts`
- `tests/routeRegistry.test.ts`
- `services/domain/blueprintComplianceService.ts`
- `services/domain/mappingEnrichment/previewService.ts`
- `tests/domain/mappingEnrichment/previewService.test.ts`
- `services/domain/audit/mappingAuditLogger.ts`
- `functions/api/mapping-enrichment/preview.ts`
- `components/admin/mapping-enrichment/ChangePreviewModal.tsx`
- `components/settings/EnhancedSettingsTab.tsx`
- `hooks/useUserProfile.ts`
- `tests/drillReviewService.test.ts`
- `e2e/production-smoke/core-launch.spec.ts`
- `src/types.ts`
- `src/types/index.ts`
- `App.tsx`

Why:
- Implemented the post-review hardening plan for study-plan launch truth, condition session metadata, profile sync fail-closed behavior, private-beta naming clarity, Edge-domain service correctness, and review/session linkage coverage.

What was verified:
- Condition-targeted study-plan sessions now keep `conditionId` and learner-facing `conditionName` separate.
- Study-plan launch intent now uses `targeted/topic` for condition-targeted work and preserves `review/review` only for true review tasks without condition targets.
- Main-session launch parsing accepts `conditionName` from the URL.
- `/api/users/me/daily-plan` compatibility completion now honors `planDate` and `linkedSessionId`.
- Session completion shows a non-blocking warning if both canonical and compatibility plan completion writes fail.
- Onboarding sync no longer sends unsupported `specialty`; profile update validation is strict.
- The server-backed Settings profile form no longer exposes unsupported specialty persistence.
- Private-beta candidates were renamed from “visible” to “candidate” and still fail closed through `modeReadiness`.
- Mapping preview derives current systems from valid blueprint tags before canonical names.
- Blueprint question-pool compliance now uses DB-side aggregation and no Edge `process.env` fallback.
- Mapping audit logging no longer accepts metadata that the schema does not persist.
- Production smoke spec now covers `/daily-challenges` gating plus real `/medical-database`, `/clinical-profile`, and `/admin` route behavior in the authenticated smoke.

Tests/checks run:
- `npx vitest run components/session/CoreAdaptiveSession.test.ts hooks/useStudyPlanLaunch.test.tsx functions/api/users/me/daily-plan.test.ts functions/api/user/profile.test.ts tests/privateBetaVisibility.test.ts tests/routeRegistry.test.ts tests/domain/mappingEnrichment/previewService.test.ts tests/drillReviewService.test.ts`: passed, 94 tests.
- `npx vitest run components/dashboard/adaptive/engine/resolveDashboardWidgets.test.tsx components/navigation/command-center/CommandCenterWorkspace.test.tsx`: passed, 20 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `npm run build`: passed; Sentry source-map upload still warns about project/org config, and Vite chunk-size warnings remain.
- `npm test`: passed, 457 files, 9,403 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `npx playwright test --config=playwright.production-smoke.config.ts --list`: passed and listed 4 production smoke tests.

Remaining risks:
- Production Cloudflare/Clerk/DB runtime smoke was not executed in this environment because it requires a live `BASE_URL` and Clerk test credentials.
- The broader canonical source identity and scheduler ownership remained open; the legacy `/api/srs/submit` migration was completed in the later 12:12 EDT slice.
- Existing raw-color lint warnings and build chunk-size warnings remain outside this slice.

## 2026-05-01 12:12 EDT - Remaining Risk Hardening Slice

Files changed:
- `functions/api/srs/submit.ts`
- `functions/api/srs/submit.test.ts`
- `functions/api/drills/_shared/reviewQuestionResolver.ts`
- `functions/api/drills/_shared/reviewQuestionResolver.test.ts`
- `lib/services/drillReviewService.ts`
- `tests/drillReviewService.test.ts`
- `components/session/SrsFlashcardView.tsx`
- `lib/services/reservoir/refillOrchestrator.ts`
- `tests/refillOrchestrator.test.ts`
- `scripts/backgroundWorker.ts`
- `vite.config.ts`

Why:
- Continued the known-risk cleanup by removing the divergent `/api/srs/submit` FSRS writer, carrying typed question-source identity into review submissions, making reservoir refill jobs executable by the background worker, and resolving the production vendor chunk-size warning through real bundle splitting.

What was verified:
- `/api/srs/submit` is now a compatibility adapter over `drillReviewService`; it preserves the legacy payload/response shape but no longer writes UserTopicProgress/UserProgress/SRSItem through a separate scheduler path.
- Legacy SRS review UI now sends the selected answer, so correctness is resolved through question content instead of trusting only a client boolean.
- `resolveReviewQuestion` now attaches `{ canonicalQuestionId, sourceQuestionId, questionSource }` for canonical Question rows, PreGeneratedQuestion rows, and generated/attempt fallback rows.
- `drillReviewService` writes the typed learning-event identity into `QuestionAttempt.telemetryJson.server_computed.learning_event` and `ReviewLog.telemetry.server_computed.learning_event`; ReviewLog also writes `questionFkId` when a canonical/mirrored FK target exists.
- Reservoir refill jobs with `isReservoirRefill: true` are executed by `scripts/backgroundWorker.ts` via `executeRefill`.
- Refill job cooldown now deduplicates by user and scope, not only user.
- Reservoir maintenance now includes active onboarded users with zero reservoir rows, so brand-new users are not invisible to low-water refill scans.
- Vendor chunk splitting moved TanStack, motion, core-js, lodash/es-toolkit, D3 helpers, Workbox, Google AI, and related utility packages out of the catch-all vendor chunk; the largest vendor chunk is now below the configured 700 kB warning limit.

Tests/checks run:
- `npx vitest run functions/api/srs/submit.test.ts tests/refillOrchestrator.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts`: passed, 46 tests.
- `npx vitest run functions/api/drills/_shared/reviewQuestionResolver.test.ts functions/api/srs/submit.test.ts tests/refillOrchestrator.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts`: passed, 49 tests.
- `npx vitest run tests/refillWorker.test.ts tests/reservoir-service.test.ts tests/reservoir-policy.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts tests/submitReviewIdempotency.test.ts`: passed, 84 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `SENTRY_UPLOAD=false npx vite build --mode production`: passed with no chunk-size warning.
- `npm run build`: passed with no chunk-size warning; Sentry source-map upload still warns because the configured project/org is unavailable in this environment.
- `npm test`: passed, 460 files, 9,412 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `git diff --check`: passed.

Remaining risks:
- Production Cloudflare/Clerk/DB browser smoke still requires live `BASE_URL` and Clerk test credentials.
- Superseded by the 12:30 EDT SRSItem compatibility retirement slice: `/api/srs/sync`, `/api/srs/due`, global sync, retention stats, and smart review no longer perform active SRSItem DB scheduling reads/writes.
- Raw-color/design-token warnings remain broad and should be addressed as a separate UI-token migration, not piecemeal in scheduler work.

## 2026-05-01 12:30 EDT - SRSItem Compatibility Retirement Slice

Files changed:
- `functions/api/srs/due.ts`
- `functions/api/srs/due.test.ts`
- `functions/api/srs/sync.ts`
- `functions/api/srs/sync.test.ts`
- `functions/api/sync.ts`
- `functions/api/sync.test.ts`
- `functions/api/sync.integration.test.ts`
- `hooks/useSRSItems.ts`
- `hooks/useUserStats.ts`
- `functions/api/stats/retention.ts`
- `tests/api/analytics/retentionStats.test.ts`
- `functions/api/user/analytics.ts`
- `functions/api/drills/smart-review.ts`
- `functions/api/drills/smart-review.test.ts`
- `components/modes/SmartReviewMode.tsx`
- `lib/services/drillReviewService.ts`
- `tests/drillReviewService.test.ts`
- `lib/services/srsService.ts`
- `tests/syncResponseShape.test.ts`
- `vite.config.ts`

Why:
- Continued the remaining-risk cleanup by retiring active SRSItem read/write paths behind compatibility route shapes, keeping legacy endpoints stable while making canonical FSRS progress the source of truth.

What was verified:
- `/api/srs/due` now reads `UserTopicProgress` and `UserProgress` due rows instead of `SRSItem`, while preserving the route-level due queue/count contract.
- `/api/srs/sync` accepts old payloads but no longer writes scheduler rows; it returns a successful deprecated/no-op response so old clients do not hard-fail.
- `/api/sync` no longer reads, writes, deletes, or returns real SRSItem rows; `srsItems` remains an empty compatibility array.
- Current frontend sync hooks no longer upload legacy SRS localStorage rows or hydrate them from cloud sync.
- Retention stats and user analytics now derive review counts and retention curve inputs from canonical `UserProgress` rows.
- Smart review now builds its due queue from canonical progress rows and resolves question payloads from `PreGeneratedQuestion`/`Question`.
- The duplicate `updateReviewOutcome` side-effect call was removed from `drillReviewService`; the canonical service owns the FSRS write path.
- Sentry source-map uploads are now gated behind usable, non-placeholder upload configuration.

Tests/checks run:
- `npx vitest run functions/api/srs/due.test.ts functions/api/srs/sync.test.ts functions/api/sync.test.ts functions/api/sync.integration.test.ts tests/syncResponseShape.test.ts tests/api/analytics/retentionStats.test.ts functions/api/drills/smart-review.test.ts`: passed, 33 tests.
- `npx vitest run functions/api/srs/due.test.ts functions/api/srs/sync.test.ts functions/api/sync.test.ts functions/api/sync.integration.test.ts tests/syncResponseShape.test.ts tests/api/analytics/retentionStats.test.ts functions/api/drills/smart-review.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`: passed, 77 tests.
- `npx vitest run functions/api/drills/smart-review.test.ts`: passed, 3 tests after indexed-answer/incomplete-card normalization hardening.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `npm run build`: passed with no Sentry upload warning and no chunk-size warning.
- `npm test`: passed, 462 files, 9,401 tests passed, 1 skipped. Vite still emits the pre-existing duplicate `activityDates` key warning in `lib/streakCalc.test.ts`.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `git diff --check`: passed.

Remaining risks:
- Production Cloudflare/Clerk/DB browser smoke still requires live `BASE_URL` and Clerk test credentials.
- `lib/services/srsService.ts` still contains localStorage SRS helpers for the legacy flashcard UI and pure tests, but active production API/database paths no longer write or read `SRSItem`.
- The canonical source-identity migration/backfill remains a database design task and was not attempted in this no-migration slice.
- Raw-color/design-token warnings remain broad and should be addressed separately.

## 2026-05-01 18:46 EDT - Remaining Risk Closure Slice

Files changed:
- `scripts/db/audit-learning-identity.ts`
- `tests/learningIdentityAudit.test.ts`
- `package.json`
- `functions/api/questions/attempt.ts`
- `functions/api/questions/attempt.test.ts`
- `functions/api/ai/learning/profile-crud.ts`
- `lib/services/userProgressService.ts`
- `lib/services/userProgressService.test.ts`
- `lib/api/types/studyPlan.ts`
- `functions/api/_shared/studyPlanService.ts`
- `lib/services/studyPlanService.ts`
- `lib/dashboard/realStudyAnalytics.ts`
- `components/dashboard/adaptive/engine/normalizeSignals.ts`
- `components/dashboard/adaptive/widgets/registry.tsx`
- `components/dashboard/adaptive/fixtures/dashboardFixtures.ts`
- `components/dashboard/adaptive/engine/resolveDashboardWidgets.test.tsx`
- `lib/api/types/review.ts`
- `lib/services/srsService.ts`
- `components/session/QuizView.tsx`
- `components/quiz/SRSFeedbackBadge.tsx`
- `tests/drillReviewService.test.ts`
- `lib/streakCalc.test.ts`
- `components/navigation/command-center/CommandCenterWorkspace.test.tsx`

Why:
- Closed the remaining no-migration learning pipeline risks by proving identity integrity can be audited safely, removing duplicate scheduler side effects, guarding `UserProgress.conditionId` writes against the wrong domain, and making dashboard review coverage claims identity-based.

What was verified:
- Added a read-only `db:audit-learning-identity` script that probes `QuestionAttempt`, `ReviewLog`, `Card`, `UserProgress`, and `StudySession.questionIds` identity mismatches without writes or schema changes.
- `/api/questions/attempt` no longer calls `scheduleConceptReview`; the legacy function is marked deprecated and reserved away from real review scheduling.
- `UserProgress` creation now verifies that a new `conditionId` can satisfy the `MedicalContent.id` FK and raises explicit diagnostics for Condition-only or missing IDs.
- Study-plan task compatibility now preserves `reviewCardIds`, and adaptive dashboard review coverage only claims protection when today’s task condition IDs or review card IDs match due/overdue review identities.
- SRS schedule result typing moved to `lib/api/types/review.ts`, reducing localStorage-era coupling to `lib/services/srsService.ts` while keeping compatibility helpers in place.
- A production-like learning pipeline test now covers review submission, `QuestionAttempt`, `ReviewLog`, `UserProgress`/`Card`, linked study-plan completion metadata, and dashboard review coverage signal input.
- The duplicate `activityDates` fixture key was removed, and command-center assertions were updated to reflect truthful review-coverage identity copy.

Tests/checks run:
- `npx vitest run tests/learningIdentityAudit.test.ts lib/services/userProgressService.test.ts functions/api/questions/attempt.test.ts components/dashboard/adaptive/engine/resolveDashboardWidgets.test.tsx`: passed, 50 tests.
- `npx vitest run tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts`: passed, 41 tests.
- `npx vitest run tests/learningIdentityAudit.test.ts lib/services/userProgressService.test.ts functions/api/questions/attempt.test.ts components/dashboard/adaptive/engine/resolveDashboardWidgets.test.tsx tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts`: passed, 91 tests.
- `npx vitest run components/navigation/command-center/CommandCenterWorkspace.test.tsx`: passed, 9 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `npm run build`: passed.
- `npm test`: passed, 463 files, 9,408 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- Environment probe: `DATABASE_URL`/`DIRECT_DATABASE_URL` missing, so live/disposable identity audit execution was not possible in this shell.
- Environment probe: `BASE_URL` and Clerk test-user env vars missing, so browser smoke remains documented rather than executed.
- `git diff --check`: passed after the final log/report updates.

Remaining risks:
- The identity audit script has not been run against a live or disposable production-like database because this slice intentionally avoids live DB mutation and requires an operator-provided `DATABASE_URL`.
- No Prisma migration or backfill was applied; canonical identity schema/backfill remains a planned follow-up based on audit output.
- Browser smoke for Cloudflare/Clerk/DB-backed flows still requires live `BASE_URL` and Clerk test credentials.
- Broad raw-color/design-token lint warnings remain and should be handled as a separate UI-token migration.

## 2026-05-01 18:59 EDT - Functionality Slice: Real System Drill Launch

Files changed:
- `App.tsx`
- `components/drill/SystemDrillSession.tsx`
- `components/session/CoreAdaptiveSession.tsx`
- `components/session/SessionScopeSelector.tsx`
- `components/session/StudyModeAdaptiveSession.tsx`
- `config/lazyComponents.tsx`
- `lib/modes/modeReadiness.ts`
- `components/session/CoreAdaptiveSession.test.ts`
- `lib/modes/modeReadiness.test.ts`
- `tests/privateBetaVisibility.test.ts`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `PRODUCTION_READINESS_AUDIT.md`
- `STUDY_MODES_FUNCTIONALITY_AUDIT.md`
- `DEPRECATED_CODE_AND_CONFLICTS_AUDIT.md`

Why:
- Continued functionality hardening by moving one bounded study mode, `system_drill`, from placeholder/deferred status to a real mounted session path backed by the existing CoreAdaptiveSession runner.

What was verified:
- `system_drill` now lazy-loads `StudyModeAdaptiveSession` instead of a private-beta placeholder.
- Dedicated system-drill launches use the same `/api/study/session/generate` and QuizView submit path as the core adaptive session, but their session settings are marked as `mode: "targeted"` and `focus: "topic"` so downstream review/progress context is explicit.
- Practice and route visibility can now expose `system_drill` because `modeReadiness` marks it real-mounted and discoverable.
- Practice system-target CTAs now navigate to `/modes/system-drill` after storing the requested system, instead of staying on `/practice` with only local view state changed.
- Condition drill remains hidden/deferred until canonical condition identity migration is resolved.
- The old `components/drill/SystemDrillSession.tsx` implementation was deleted after import census confirmed the active lazy export now points to the CoreAdaptiveSession-backed wrapper.
- The locked system selector starts directly at system choice and uses a one-shot load guard so empty system API responses do not cause repeated fetch loops.

Tests/checks run:
- `npx vitest run components/session/CoreAdaptiveSession.test.ts lib/modes/modeReadiness.test.ts tests/privateBetaVisibility.test.ts tests/routeRegistry.test.ts`: passed, 41 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 437 existing raw-color/design-token warnings.
- `npm run build`: passed.
- `npm test`: passed, 463 files, 9,409 tests passed, 1 skipped.
- `git diff --check`: passed after the log/report updates.

Remaining risks:
- Browser smoke for `/practice -> Target <system> -> system drill session` still requires live auth/runtime credentials.
- `condition_drill`, `pharmacology`, `rapid_recall`, `mini_lab`, and other mode candidates remain hidden until their identity, persistence, and submit contracts are proven.
- System drill still depends on the same unresolved canonical question/condition identity migration as the core adaptive session.

## 2026-05-01 23:59 EDT - Backend Study-Mode Route Optimization

Files changed:
- `lib/services/questionServingSafety.ts`
- `lib/services/conceptQuestionSelector.ts`
- `lib/services/reservoir/reservoirPolicy.ts`
- `lib/services/reservoir/reservoirService.ts`
- `lib/services/reservoir/refillWorker.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study/session/[sessionId]/questions.ts`
- `functions/api/questions.ts`
- `functions/api/questions/fetch.ts`
- `functions/api/questions/pool.ts`
- `functions/api/questions/pool-status.ts`
- `functions/api/questions/system-drill.ts`
- `functions/api/questions/condition-drill.ts`
- `functions/api/questions/pharmacology-drill.ts`
- `tests/questionServingSafety.test.ts`
- `tests/conceptQuestionSelector.test.ts`
- `tests/reservoir-policy.test.ts`
- `tests/refillWorker.test.ts`
- `functions/api/study/session-generate.test.ts`
- `functions/api/questions-root.test.ts`
- `functions/api/questions/pool-security.test.ts`
- `functions/api/questions/study-mode-compat-routes.test.ts`
- `lib/study/studyModeScaffolding.ts`

Why:
- Reworked backend study-mode serving paths so visible/canonical sessions and compatibility endpoints share production-safe content gates instead of preserving older direct-random question APIs by default.

What was verified:
- Canonical session generation, session replay, pool fetch, root question fetch, and legacy system/condition/pharmacology compatibility routes now filter learner-facing content to approved/active production-safe questions.
- Full reservoir reservations that hydrate to too few usable safe questions are released and fall back to on-demand/pregenerated selection instead of returning a short unsafe session.
- Reservoir scope derivation now supports `subcategory`, and refill workers parse `system`, `condition`, and `subcategory` scopes instead of filling scoped queues from the global blueprint pool.
- Due-review reservoir refill now falls back to active/approved `Question` rows when no approved pregenerated variant exists for the due condition.
- Legacy system/condition/pharmacology endpoints now return compatibility metadata pointing to `/api/study/session/generate` and avoid count/skip random selection.
- `/api/questions` now validates query params for GET requests and applies production serving filters.
- `/api/questions/pool` learner hot-path generation is suppressed, pool seeding is admin-only with body validation instead of query validation, and stale cached pool rows without approval metadata are not trusted.
- A narrow pre-existing typecheck blocker in `lib/study/studyModeScaffolding.ts` was fixed with an explicit `unknown` cast.

Tests/checks run:
- `npx vitest run tests/questionServingSafety.test.ts tests/conceptQuestionSelector.test.ts tests/reservoir-policy.test.ts tests/refillWorker.test.ts functions/api/study/session-generate.test.ts functions/api/questions/study-mode-compat-routes.test.ts functions/api/questions-root.test.ts functions/api/questions/pool-security.test.ts`: passed, 78 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 438 existing raw-color/design-token warnings.
- `npm run build`: passed.
- `git diff --check`: passed.

Remaining risks:
- `/api/questions/session`, `/api/srs/next`, and direct legacy drill/client consumers still need a later compatibility cleanup and response DTO normalization pass.
- The reservoir schema still has scope-unaware uniqueness; approximate insert counts were superseded by the 2026-05-02 15:45 EDT slice, which now counts actual inserted rows from raw SQL.
- Browser smoke for auth-backed study-mode routes still needs live `BASE_URL` and Clerk test credentials.

## 2026-05-02 00:35 EDT - Backend Study-Mode Compatibility Hardening

Files changed:
- `lib/services/session/sessionService.ts`
- `services/core/mainSessionService.ts`
- `functions/api/srs/next.ts`
- `functions/api/srs/due.ts`
- `functions/api/srs/submit.ts`
- `functions/api/srs/elo-update.ts`
- `functions/api/srs/session-order.ts`
- `functions/api/drills/_shared/reviewQuestionResolver.ts`
- `functions/api/drills/submit-review.ts`
- `functions/api/drills/submit-reviews.ts`
- `lib/services/reservoir/refillWorker.ts`
- `lib/services/session/sessionService.test.ts`
- `services/core/mainSessionService.test.ts`
- `functions/api/srs/next.test.ts`
- `functions/api/srs/submit-compat.test.ts`
- `functions/api/srs/due.test.ts`
- `functions/api/drills/_shared/reviewQuestionResolver.test.ts`
- `tests/reviewQuestionResolver.test.ts`
- `functions/api/drills/submit-review.test.ts`
- `tests/refillWorker.test.ts`
- `IMPLEMENTATION_LOG.md`

Why:
- Closed the next set of study-mode backend seams after the route optimization slice: legacy session fetch, SRS compatibility, review resolution, and reservoir refill now fail closed to submit-safe, production-approved content instead of preserving older random/generated paths.

What was verified:
- `/api/questions/session` now serves only approved persisted pre-generated questions and active/approved `Question` rows; seed-expanded and learner hot-path Gemini-generated questions are no longer used to fill learner sessions when canonical submission identity is uncertain.
- The client main-session orchestrator unwraps the standard API envelope from `/api/questions/session`, fixing compatibility between production middleware responses and the existing `fetchSessionQuestions` contract.
- `/api/srs/next` now returns a normalized question DTO for both `PreGeneratedQuestion` and `Question` sources, applies production serving filters to both paths, and only increments `timesServed` for actual pre-generated rows.
- `/api/srs/due` now validates GET query params as a flat query object under the production middleware shape and clamps `limit` to a bounded range.
- `submit-review`, `submit-reviews`, and legacy `/api/srs/submit` no longer call `scheduleConceptReview`; canonical review scheduling remains owned by `drillReviewService`.
- `reviewQuestionResolver` now resolves only production-safe persisted question rows before falling back to a recent attempt.
- Reservoir refill no longer inserts standard `Question.id` values into the `StudentReservoirItem.questionId` foreign key, which points at `PreGeneratedQuestion`.
- SRS ELO/session-order routes now resolve Clerk IDs to internal user IDs before writing `StudentAbility`.
- A conflict scan confirmed the remaining production `scheduleConceptReview` call is isolated to OSCE grading and should be handled in a separate OSCE review-scheduling slice.

Tests/checks run:
- `npx vitest run lib/services/session/sessionService.test.ts services/core/mainSessionService.test.ts functions/api/srs/next.test.ts functions/api/srs/due.test.ts functions/api/srs/submit-compat.test.ts functions/api/srs/submit.test.ts functions/api/drills/_shared/reviewQuestionResolver.test.ts tests/reviewQuestionResolver.test.ts functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts tests/refillWorker.test.ts tests/reservoir-policy.test.ts functions/api/questions/pool-security.test.ts functions/api/questions/study-mode-compat-routes.test.ts functions/api/questions-root.test.ts`: passed, 128 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 422 existing raw-color/design-token warnings and no errors.
- `npm run build`: passed.
- `npm test`: passed, 477 files, 9,465 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `git diff --check`: passed.

Remaining risks:
- Superseded by the 2026-05-02 15:45 EDT OSCE/SRS/reservoir slice: `functions/api/osce/analysis/grade.ts` no longer calls `scheduleConceptReview`.
- `lib/services/srsService.ts` still contains localStorage-era compatibility helpers used by SRS flashcard consumers and SDK types; delete only after consumers are fully migrated.
- Superseded in part by the 2026-05-02 15:45 EDT OSCE/SRS/reservoir slice: `/api/srs/due` now has context filtering and duplicate suppression, but launchability/safety reconciliation with `/api/srs/next` remains.
- Reservoir partial-reservation handling remains future reliability work; approximate `bulkInsertReservoirItems` insert counts were fixed in the 2026-05-02 15:45 EDT slice.
- Browser smoke for auth-backed study-mode flows still requires live `BASE_URL` and Clerk test credentials.

## 2026-05-02 15:45 EDT - OSCE/SRS/Reservoir Read-Model Hardening

Files changed:
- `functions/api/osce/analysis/grade.ts`
- `functions/api/osce/analysis/grade.test.ts`
- `functions/api/srs/due.ts`
- `functions/api/srs/due.test.ts`
- `hooks/useSRSItems.ts`
- `lib/sdk/srsClient.ts`
- `lib/sdk/__tests__/srsClient.test.ts`
- `lib/services/reservoir/reservoirService.ts`
- `tests/reservoir-service.test.ts`
- `IMPLEMENTATION_LOG.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`

Why:
- Closed the next remaining backend risks identified by the subagent audits: OSCE grading was still writing a legacy recommendation schedule, `/api/srs/due` could inflate due counts by returning the same target from multiple progress stores, SDK due-item typing did not match JSON wire format, and reservoir bulk insert health reported attempted rows instead of actual inserted rows.

What was verified:
- OSCE grading still persists `OsceResult` and creates `ConceptGap` for failed clinical reasoning/red flags, but no longer calls the deprecated `scheduleConceptReview` recommendation scheduler.
- `rg "scheduleConceptReview" functions/api -n` now finds no production endpoint call sites, only the deprecated helper and regression-test mocks/assertions.
- `/api/srs/due` accepts optional `progressContext` or `context` query filters, applies them across Card, UserTopicProgress, and UserProgress, and reports the selected context in the response.
- `/api/srs/due` now suppresses broader condition-level due rows when a more specific Card or UserTopicProgress row already covers the same condition/context, reducing inflated review counts.
- SRS SDK due items now normalize `dueDate` strings back to `Date` objects to match the exported SDK type.
- `bulkInsertReservoirItems` now sums the actual row count returned by `$executeRawUnsafe`, so `ON CONFLICT DO NOTHING` no longer reports duplicate/conflicted rows as inserted.

Tests/checks run:
- `npx vitest run functions/api/osce/analysis/grade.test.ts functions/api/srs/due.test.ts`: passed, 19 tests.
- `npx vitest run functions/api/osce/analysis/grade.test.ts functions/api/srs/due.test.ts lib/sdk/__tests__/srsClient.test.ts`: passed, 20 tests.
- `npx vitest run tests/reservoir-service.test.ts tests/refillWorker.test.ts`: passed, 59 tests.
- `npx vitest run functions/api/osce/analysis/grade.test.ts functions/api/srs/due.test.ts lib/sdk/__tests__/srsClient.test.ts tests/reservoir-service.test.ts tests/refillWorker.test.ts functions/api/srs/next.test.ts functions/api/srs/submit-compat.test.ts functions/api/drills/submit-review.test.ts`: passed, 107 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 422 existing raw-color/design-token warnings and no errors.
- `npm run build`: passed.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `npm test`: passed, 478 files, 9,471 tests passed, 1 skipped.
- `git diff --check`: passed.

Remaining risks:
- `/api/srs/due` is still a compatibility read model over Card, UserTopicProgress, and UserProgress; launchability must be reconciled with `/api/srs/next`, and unsafe Card-linked Question rows still need serving-safety filtering or an explicit unlaunchable marker.
- Reservoir session generation still needs cleanup for full-reservation failures after reservation and unsafe hydrated items should be failed/expired instead of requeued.
- Reservoir capacity still counts queued rows only; counting active reserved rows needs a later policy decision.
- Browser smoke for auth-backed study-mode and OSCE flows still requires live `BASE_URL` and Clerk test credentials.

## 2026-05-02 16:33 EDT - Question Generation To Personalized Plan Loop Hardening

Files changed:
- `functions/api/_shared/staging-questions.ts`
- `functions/api/_shared/staging-questions.test.ts`
- `functions/api/admin/generate-question.ts`
- `functions/api/admin/staging/approve.ts`
- `functions/api/admin/refinery/action.ts`
- `pages/admin/QuestionGeneratorPage.tsx`
- `lib/services/conceptQuestionSelector.ts`
- `lib/services/drillReviewService.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `functions/api/study-path/recommendation.ts`
- `functions/api/study-path/regenerate.ts`
- `functions/api/study-path/studyPath.test.ts`
- `tests/conceptQuestionSelector.test.ts`
- `tests/drillReviewService.test.ts`
- `IMPLEMENTATION_LOG.md`

Why:
- Closed the functional loop blockers for the user's stated goal: admins can now persist generated questions into staging, approved staged questions preserve identity/provenance into the live pre-generated pool, condition-targeted study plans can launch sessions across `MedicalContent.id` and `Condition.id` domains, review submission writes UserProgress against the schema-correct MedicalContent key, and the legacy `/study/path` optimizer route no longer calls the planner with the wrong signature.

What was verified:
- The admin question generator `Save as Draft` action now posts to `/api/questions/staging` instead of showing a TODO-only toast.
- Generated questions now carry taxonomy, subcategory, `Condition.id`, `MedicalContent.id`, condition name, generator, and source metadata where available.
- Staging save normalizes numeric generator difficulty into a staging-safe string and preserves provenance through structured tags without a Prisma migration.
- Staging and refinery approval now use one `promoteToLive` path, which writes `validationStatus: "approved"`, `validatedAt`, `conditionId`, `medicalContentId`, `questionOrder`, `taskCategory`, and provenance into `PreGeneratedQuestion`.
- Adequacy checking no longer treats any non-empty `correctAnswer` as valid; the answer must resolve to an option value or letter.
- Condition-mode session selection now resolves both ID domains: `UserProgress.conditionId`/plan tasks can use `MedicalContent.id`, while `Question.conditionId` and `PreGeneratedQuestion.conditionId` can use `Condition.id`.
- `drillReviewService` now writes ReviewLog condition identity as before while writing UserProgress against `question.medicalContentId` or a resolved MedicalContent row for the condition.
- `/api/study-path/recommendation` and `/api/study-path/regenerate` now resolve Clerk IDs to internal `User.id` before optimizer calls and call `generateStudyPlan(prisma, input)`.

Tests/checks run:
- `npx vitest run functions/api/_shared/staging-questions.test.ts functions/api/study/session-generate.test.ts tests/conceptQuestionSelector.test.ts functions/api/study-path/studyPath.test.ts tests/drillReviewService.test.ts`: passed, 38 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/drills/submit-review.test.ts functions/api/users/me/daily-plan.test.ts functions/api/study-plan/today.test.ts hooks/useStudyPlanLaunch.test.tsx`: passed, 37 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 422 existing raw-color/design-token warnings and no errors.
- `npm run build`: passed.
- `npm test`: passed, 479 files, 9,476 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, zero vulnerabilities.
- `git diff --check`: passed.

Remaining risks:
- This pass did not add a Prisma migration; provenance is carried through staging `tags` until a first-class staging provenance schema is approved.
- Learner-facing sessions still fail closed when approved pools are thin; dynamic generated questions are not served directly until they can be persisted, approved, and submitted through canonical identity.
- `/study/path` is now unblocked at the route contract level, but it remains an older planner surface compared with the canonical daily study plan.
- Browser smoke for admin generation and authenticated study-plan launch still requires live auth/test credentials.

## 2026-05-02 16:44 EDT - Staging Contract And Study-Plan Launchability Guard

Files changed:
- `functions/api/_shared/staging-questions.ts`
- `functions/api/_shared/staging-questions.test.ts`
- `functions/api/questions/staging/index.ts`
- `lib/services/studyPlanService.ts`
- `lib/services/studyPlanService.test.ts`
- `IMPLEMENTATION_LOG.md`

Why:
- Continued the question-generation-to-personalized-plan functionality pass by preventing malformed generated questions from entering staging and preventing targeted study-plan tasks from launching into condition sessions with no approved question pool.

What was verified:
- `saveToStaging` now validates question text, option count, answer resolvability, and explanation/rationale before writing `StagingQuestion`.
- `/api/questions/staging` now returns a 400 response for invalid generated-question payloads instead of surfacing a generic storage/runtime failure.
- Staging storage now normalizes `options`, `question`, and explanation/rationale consistently before persistence.
- Daily study-plan tasks now run a launchability pass when question pool models are available.
- Targeted/review tasks keep their condition route only when an approved `Question` or approved `PreGeneratedQuestion` exists for the task's `MedicalContent.id` or `Condition.id`.
- If no approved pool exists, the task degrades to a `main` adaptive fallback with the same count/time budget, avoiding an empty condition session.

Tests/checks run:
- `npx vitest run functions/api/_shared/staging-questions.test.ts lib/services/studyPlanService.test.ts functions/api/study/session-generate.test.ts tests/conceptQuestionSelector.test.ts tests/drillReviewService.test.ts`: passed, 44 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint`: passed with 422 existing raw-color/design-token warnings and no errors.
- `npm run build`: passed.

Remaining risks:
- The launchability pass only runs where `question`, `preGeneratedQuestion`, and `medicalContent` model access is available on the Prisma adapter; older mocked or narrowed adapters fail open to preserve compatibility.
- The fallback keeps learners working but does not automatically generate the missing targeted pool; pool refill/seeding remains a separate content-production task.
- Browser smoke for authenticated plan launch still requires live auth/test credentials.

## 2026-05-02 16:51 EDT - Learner Generation Preview Persistence Guard

Files changed:
- `functions/api/questions/generate.ts`
- `functions/api/questions/generate.test.ts`
- `functions/api/_shared/condition-loader.ts`
- `functions/api/_shared/condition-loader.test.ts`
- `functions/api/_shared/staging-questions.ts`
- `functions/api/_shared/staging-questions.test.ts`
- `lib/services/studyPlanService.ts`
- `lib/services/studyPlanService.test.ts`
- `IMPLEMENTATION_LOG.md`

Why:
- Continued the site-functionality pass for the user's goal to generate questions and create a personalized study plan. Learner-facing generated questions now have a persistence path into staging while remaining preview-only until approval, and cached legacy generated questions can no longer appear submit-ready by omission.

What was verified:
- `/api/questions/generate` fails closed when no approved clinical source can be resolved.
- The shared condition loader now filters exact, partial, buzzword, system, and random selection queries to `MedicalContent.status in ["published", "approved"]` before question generation can use them.
- Newly generated learner questions are saved to `StagingQuestion` with `MedicalContent.id`, optional legacy `Condition.id`, condition name, taxonomy, subcategory, generator, and source provenance.
- Generated and staging-sourced learner questions are explicitly marked `submissionReady: false` and `requiresApproval: true`.
- Cached generated questions are also normalized to preview-only before response, protecting users from older cache entries created before this hardening pass.
- Study-plan task launchability continues to degrade condition-targeted tasks to adaptive main sessions when no approved question pool exists for the task condition identity.
- Stored active daily plans now get a narrow launchability repair on read, so older condition-targeted tasks with no approved pool are rerouted to adaptive main work without regenerating the whole personalized plan.
- Completed task history is left unchanged during launchability repair.

Tests/checks run:
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/staging-questions.test.ts lib/services/studyPlanService.test.ts`: passed, 15 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/staging-questions.test.ts lib/services/studyPlanService.test.ts functions/api/study/session-generate.test.ts tests/conceptQuestionSelector.test.ts tests/drillReviewService.test.ts functions/api/study-path/studyPath.test.ts`: passed, 50 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/staging-questions.test.ts`: passed, 8 tests.
- `npx vitest run functions/api/_shared/condition-loader.test.ts functions/api/questions/generate.test.ts functions/api/_shared/staging-questions.test.ts`: passed, 11 tests.
- `npx vitest run lib/services/studyPlanService.test.ts`: passed, 10 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/condition-loader.test.ts functions/api/_shared/staging-questions.test.ts lib/services/studyPlanService.test.ts functions/api/study/session-generate.test.ts tests/conceptQuestionSelector.test.ts tests/drillReviewService.test.ts functions/api/study-path/studyPath.test.ts`: passed, 56 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint && npm run build`: passed; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `npm test`: passed, 479 files, 9,483 tests passed, 1 skipped.
- `git diff --check`: passed for the touched generation/staging/plan files.

Remaining risks:
- Learner-generated questions are intentionally not session-submit-ready until curation promotes them into the approved pool.
- This pass did not add a Prisma migration; staging provenance remains encoded in existing JSON/tag fields.
- The launchability guard fails open for older/narrowed Prisma adapters that do not expose question-pool models.
- Full browser smoke for generation, approval, plan creation, and launch still requires authenticated test credentials.

## 2026-05-02 17:29 EDT - Pre-Generated Session Identity And Submission Contract

Files changed:
- `lib/sessionGeneration.ts`
- `lib/sessionGeneration.test.ts`
- `lib/study/questionIdentity.ts`
- `lib/study/questionIdentity.test.ts`
- `lib/api/schemas/drills.ts`
- `lib/api/schemas/drills.test.ts`
- `lib/api/types/questions.ts`
- `lib/services/sync/syncManager.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `functions/api/study/session/[sessionId]/questions.ts`
- `functions/api/study/session/[sessionId]/questions.test.ts`
- `functions/api/drills/_shared/reviewQuestionResolver.ts`
- `functions/api/drills/_shared/reviewQuestionResolver.test.ts`
- `functions/api/drills/submit-review.ts`
- `functions/api/drills/submit-reviews.ts`
- `lib/services/drillReviewService.ts`
- `components/session/QuizView.tsx`
- `components/session/hooks/useQuizSubmit.ts`
- `src/types.ts`
- `src/types/index.ts`

Why:
- Closed the next launch-to-submit functionality gap: a personalized plan task can be considered launchable because approved `PreGeneratedQuestion` content exists, but the session and submission path was dropping source identity and `MedicalContent.id`. This made pre-generated IDs look like canonical `Question.id` on the client and forced the backend to rediscover source identity from a bare ID.

What was verified:
- Session generation now emits `questionSource`, `sourceQuestionId`, `canonicalQuestionId`, and `medicalContentId` for pre-generated fallback and reservoir-hydrated questions.
- Session resume now selects `PreGeneratedQuestion.medicalContentId` and returns the same identity fields instead of losing them after `StudySession.questionIds` lookup.
- `normalizeSessionQuestion` and `normalizeStudyQuestion` preserve pre-generated source identity separately from canonical `Question.id`.
- `getServerQuestionId` no longer treats a pre-generated/staging/generated runtime ID as a canonical `Question.id` unless an explicit `canonicalQuestionId` exists.
- Queued review submissions now carry `canonicalQuestionId`, `sourceQuestionId`, `questionSource`, and `medicalContentId` through sync storage and the `/api/drills/submit-review(s)` schemas.
- Review resolution honors explicit `questionSource: "pre_generated"` and looks up `sourceQuestionId` in `PreGeneratedQuestion` without first treating it as a canonical `Question`.
- The strict drill telemetry schema now accepts known frontend telemetry keys: `question_number`, `input_method`, option interaction chronometry, and guided-study scaffold metadata.

Tests/checks run:
- `npx vitest run lib/sessionGeneration.test.ts lib/study/questionIdentity.test.ts functions/api/study/session-generate.test.ts functions/api/study/session/[sessionId]/questions.test.ts functions/api/drills/_shared/reviewQuestionResolver.test.ts`: passed, 56 tests.
- `npx vitest run functions/api/drills/submit-review.test.ts functions/api/drills/_shared/reviewQuestionResolver.test.ts tests/drillReviewService.test.ts`: passed, 46 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/condition-loader.test.ts functions/api/_shared/staging-questions.test.ts lib/services/studyPlanService.test.ts functions/api/study/session-generate.test.ts functions/api/study/session/[sessionId]/questions.test.ts lib/sessionGeneration.test.ts lib/study/questionIdentity.test.ts functions/api/drills/_shared/reviewQuestionResolver.test.ts tests/conceptQuestionSelector.test.ts tests/drillReviewService.test.ts functions/api/study-path/studyPath.test.ts`: passed, 104 tests.
- `npx vitest run lib/api/schemas/drills.test.ts functions/api/drills/_shared/reviewQuestionResolver.test.ts functions/api/drills/submit-review.test.ts tests/drillReviewService.test.ts lib/sessionGeneration.test.ts lib/study/questionIdentity.test.ts functions/api/study/session-generate.test.ts functions/api/study/session/[sessionId]/questions.test.ts`: passed, 98 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint && npm run build`: passed; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `npm test`: passed, 481 files, 9,488 tests passed, 1 skipped.
- `git diff --check`: passed for the touched identity/session/submission files.

Remaining risks:
- `StudySessionQuestion` join rows still are not written during session generation; resume still infers source by querying `PreGeneratedQuestion` first, though identity fields are now restored in the response.
- Pre-generated submissions still rely on creating a `Question` identity mirror for `QuestionAttempt` and `Card` FK compatibility until a schema migration supports source-typed attempts/cards directly.
- Study-plan `taskId` and `planDate` are still completed through the session-end plan progress path rather than every individual review submission.

## 2026-05-02 17:42 EDT - Session Question Link Persistence

Files changed:
- `lib/sessionGeneration.ts`
- `lib/sessionGeneration.test.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `functions/api/study/session/[sessionId]/questions.ts`
- `functions/api/study/session/[sessionId]/questions.test.ts`
- `lib/services/drillReviewService.ts`
- `tests/drillReviewService.test.ts`
- `IMPLEMENTATION_LOG.md`

Why:
- Continued the functionality hardening pass for generated/pre-generated sessions. The previous slice preserved source identity in API payloads, but the persisted `StudySession` still only had a bare `questionIds` array. This pass adds guarded ordered link persistence so the backend can trace served question identity through resume and answer attempts.

What was verified:
- `buildStudySessionQuestionRecords` derives ordered `StudySessionQuestion` rows from normalized session questions.
- Canonical `Question` rows write `questionId`; pre-generated rows write `preGeneratedQuestionId`; ephemeral generated/staging rows without a valid FK target are omitted rather than violating the join-table constraints.
- `/api/study/session/generate` now best-effort dual-writes `StudySessionQuestion` rows after the existing `StudySession.questionIds` upsert. If the delegate/table is unavailable in an unmigrated environment, generation still succeeds and logs that `questionIds` remain the fallback source.
- `/api/study/session/:sessionId/questions` now prefers ordered `StudySessionQuestion` rows when present and falls back to legacy `StudySession.questionIds` for old sessions.
- `submitDrillReview` now links a persisted `QuestionAttempt` back to the matching `StudySessionQuestion` row when review telemetry includes `session_id` and source identity.
- Existing session resume, pre-generated generation, and the production-like review-to-plan pipeline tests cover the new link writes.

Tests/checks run:
- `npx vitest run lib/sessionGeneration.test.ts functions/api/study/session-generate.test.ts functions/api/study/session/[sessionId]/questions.test.ts`: passed, 49 tests.
- `npx vitest run tests/drillReviewService.test.ts lib/sessionGeneration.test.ts functions/api/study/session-generate.test.ts functions/api/study/session/[sessionId]/questions.test.ts`: passed, 65 tests.
- `npx vitest run functions/api/questions/generate.test.ts functions/api/_shared/condition-loader.test.ts functions/api/_shared/staging-questions.test.ts lib/services/studyPlanService.test.ts functions/api/study/session-generate.test.ts functions/api/study/session/[sessionId]/questions.test.ts lib/sessionGeneration.test.ts lib/study/questionIdentity.test.ts functions/api/drills/_shared/reviewQuestionResolver.test.ts functions/api/drills/submit-review.test.ts tests/conceptQuestionSelector.test.ts tests/drillReviewService.test.ts functions/api/study-path/studyPath.test.ts`: passed, 133 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint && npm run build`: passed; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `npm test`: passed, 481 files, 9,492 tests passed, 1 skipped.
- `git diff --check`: passed for the touched session-link files.

Remaining risks:
- The link-table write is intentionally guarded and non-fatal until the normalized study schema is confirmed migrated in each deployment environment.
- Pre-generated submissions still rely on a canonical `Question` identity mirror for `QuestionAttempt`, `ReviewLog.questionFkId`, and `Card` FK compatibility.
- Study-plan `taskId` and `planDate` are still completed through the session-end plan progress path rather than every individual review submission.

## 2026-05-02 17:50 EDT - Study-Plan Launch Attribution In Review Telemetry

Files changed:
- `components/session/CoreAdaptiveSession.tsx`
- `components/session/CoreAdaptiveSession.test.ts`
- `components/session/QuizView.tsx`
- `lib/api/schemas/drills.ts`
- `lib/api/schemas/drills.test.ts`
- `lib/services/drillReviewService.ts`
- `tests/drillReviewService.test.ts`
- `src/types.ts`
- `src/types/index.ts`
- `IMPLEMENTATION_LOG.md`

Why:
- Continued the personalized-study-plan functionality pass. The route and session-end sync already carried `taskId` and `planDate`, but individual review writes did not preserve study-plan attribution. That made it harder to prove which plan task produced an attempt, review log, and dashboard signal.

What was verified:
- `SessionSettings` now carries optional `studyPlanTaskId`, `studyPlanDate`, and `studyPlanSource`.
- `CoreAdaptiveSession` attaches those fields only for `source=study-plan` launches and avoids leaking them into manual launches.
- `QuizView` includes study-plan task/date/source fields in queued review telemetry.
- The strict drill review telemetry schema now accepts `study_plan_task_id`, `study_plan_date`, and `study_plan_source`.
- `submitDrillReview` copies study-plan attribution into the server-computed `learning_event` metadata stored with `QuestionAttempt` and `ReviewLog` telemetry.
- The production-like review-to-plan pipeline test now asserts task/date/source attribution through the review writer.

Tests/checks run:
- `npx vitest run components/session/CoreAdaptiveSession.test.ts lib/api/schemas/drills.test.ts tests/drillReviewService.test.ts`: passed, 23 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint && npm run build`: passed; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `npm test`: passed, 481 files, 9,493 tests passed, 1 skipped.
- `git diff --check`: passed for the touched session-link files before this slice; no whitespace issues observed in the new attribution edits during subsequent checks.

Remaining risks:
- Individual answer submission now carries plan attribution, but authoritative task completion still happens at session end through `/api/study-plan/progress` with `/api/users/me/daily-plan` as compatibility fallback.
- Study-plan attribution is telemetry-backed, not a new DB column, to avoid adding a Prisma migration in this pass.
- Browser smoke for authenticated study-plan launch still requires live Clerk/test credentials.

## 2026-05-02 18:04 EDT - Study-Plan Attempt Progress And Pre-Generated Canonicalization

Files changed:
- `lib/services/drillReviewService.ts`
- `tests/drillReviewService.test.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `lib/sessionGeneration.ts`
- `scripts/db/audit-learning-identity.ts`
- `tests/learningIdentityAudit.test.ts`
- `IMPLEMENTATION_LOG.md`

Why:
- Continued the remaining-risk closure loop for personalized study-plan functionality. The prior slice preserved study-plan attribution in review telemetry; this slice makes in-session progress visible after each persisted attempt, reduces submit-time reliance on pre-generated question identity mirrors, and adds an explicit schema-readiness probe for the normalized session-question link table.

What was verified:
- `submitDrillReview` now calls an idempotent per-attempt progress updater when review telemetry includes `study_plan_source=study-plan`, `study_plan_date`, `study_plan_task_id`, a session ID, and a persisted attempt ID.
- Daily plan task progress is marked `in_progress`, keeps `linkedSessionId`, increments `actualQuestionsAnswered`, updates rolling `actualAccuracy`, and records `linkedAttemptIds` so duplicate submissions do not double-count.
- `/api/study/session/generate` now best-effort creates canonical `Question` rows for approved pre-generated questions before returning the session. Returned session questions keep their source identity and receive canonical IDs when the mirror write succeeds.
- `StudySessionQuestion` link rows can now carry both canonical `questionId` and `preGeneratedQuestionId` for pre-generated questions when the normalized schema is available.
- The read-only learning identity audit now reports whether `public.study_session_questions` is missing and recommends deploying the normalized study schema when it is absent.

Tests/checks run:
- `npx vitest run tests/drillReviewService.test.ts`: passed, 16 tests.
- `npx vitest run functions/api/study/session-generate.test.ts lib/sessionGeneration.test.ts tests/drillReviewService.test.ts`: passed, 63 tests.
- `npx vitest run tests/learningIdentityAudit.test.ts tests/drillReviewService.test.ts functions/api/study/session-generate.test.ts`: passed, 27 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npm run lint && npm run build`: passed; production build completed successfully.
- `npm test`: passed, 481 files, 9,493 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, found 0 vulnerabilities.
- `git diff --check`: passed.

Remaining risks:
- Browser smoke for authenticated study-plan launch still requires live Clerk/test credentials.
- Pre-generated canonicalization is intentionally best-effort; if the createMany mirror write fails, answer submission keeps the existing guarded fallback.
- Full removal of canonical mirror compatibility still requires a source-typed `QuestionAttempt`/`Card` migration and backfill, which was explicitly out of scope for this no-migration pass.

## 2026-05-02 18:17 EDT - Exam Urgency, Session-End Flush, And Pool Safety

Files changed:
- `components/session/CoreAdaptiveSession.tsx`
- `components/session/CoreAdaptiveSession.test.ts`
- `components/session/QuizView.tsx`
- `functions/api/drills/submit-review.ts`
- `functions/api/drills/submit-review.test.ts`
- `functions/api/drills/submit-reviews.ts`
- `lib/api/schemas/drills.ts`
- `lib/api/schemas/drills.test.ts`
- `scripts/regenerate-pool-v2.ts`
- `scripts/regenerate-pool-v2-safety.ts`
- `tests/regeneratePoolV2Safety.test.ts`
- `tests/submitReviewIdempotency.test.ts`
- `types/telemetry.ts`
- `src/types.ts`
- `src/types/index.ts`
- `DATA_PIPELINE_AND_SCHEDULING_AUDIT.md`
- `STUDY_MODES_FUNCTIONALITY_AUDIT.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_LOG.md`

Why:
- Closed additional no-migration functionality risks from the known-risk list: EOR/exam urgency was computed and shown in the UI but not reaching FSRS review writes; session summaries could run before queued review submissions flushed; and the pool regeneration script could delete the entire pre-generated question pool by default.

What was verified:
- `SessionSettings` now carries `urgencyMultiplier`; `CoreAdaptiveSession` derives it from the resolved blueprint, and `QuizView` adds a clamped `urgency_multiplier` to queued review telemetry.
- Shared drill review schemas accept `urgency_multiplier`; both single and batch submit endpoints pass the sanitized multiplier into `drillReviewService`, so EOR/deadline urgency can tighten FSRS intervals as intended.
- `CoreAdaptiveSession` now attempts `syncManager.syncAll(token)` before fetching the session summary and completing a study-plan task. Failure is non-blocking and produces the existing calm session-summary warning path.
- `scripts/regenerate-pool-v2.ts` no longer clears the pre-generated question pool by default. Destructive clearing now requires both `--clear` and `ALLOW_DESTRUCTIVE_POOL_REGENERATION=true`.
- Audit/report docs were updated so fixed no-migration items are not treated as still-open blockers.

Tests/checks run:
- `npx vitest run lib/api/schemas/drills.test.ts components/session/CoreAdaptiveSession.test.ts functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts tests/drillReviewService.test.ts`: passed, 62 tests.
- `npx vitest run components/session/CoreAdaptiveSession.test.ts`: passed, 8 tests.
- `npx vitest run tests/regeneratePoolV2Safety.test.ts`: passed, 4 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after both sub-slices.
- `npm run lint && npm run build`: passed; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `git diff --check`: passed during the urgency slice.
- Final `git diff --check`: passed.
- Final `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- Final `npm run lint && npm run build`: passed; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- Final `npm test`: passed, 482 files, 9,502 tests passed, 1 skipped.
- Final `npm audit --omit=dev`: passed, found 0 vulnerabilities.

Remaining risks:
- Live browser smoke for authenticated `/study` and study-plan launches still requires Clerk/test credentials and a running production-like backend.
- Canonical identity migration/backfill for source-typed attempts/cards remains out of scope for this no-migration loop.
- The pool regeneration script now prevents accidental destructive clears, but a non-destructive archive/supersede workflow for old generated rows is still a future tooling improvement.

## 2026-05-02 19:03 EDT - SRS Due Launchability And Context Reconciliation

Files changed:
- `functions/api/srs/next.ts`
- `functions/api/srs/next.test.ts`
- `functions/api/srs/submit.ts`
- `functions/api/srs/submit-compat.test.ts`
- `components/session/SrsFlashcardView.tsx`
- `lib/services/srsService.ts`
- `DATA_PIPELINE_AND_SCHEDULING_AUDIT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_LOG.md`

Why:
- Continued the remaining-risk loop for SRS compatibility. `/api/srs/due` had become a canonical progress read model, but `/api/srs/next` did not yet launch due `Card` rows first or prove that TARGETED due items would update the TARGETED FSRS partition when submitted from the legacy flashcard view.

What was verified:
- `/api/srs/next` now queries due `Card` rows before UserTopicProgress/UserProgress fallbacks, applies optional `progressContext`/`context` filtering across all reads, and skips Card-linked `Question` rows that are not `ACTIVE` and `APPROVED`.
- `/api/srs/next` returns a normalized question DTO plus `cardId`/`progressContext` for Card-backed items and propagates `progressContext` for topic/progress fallbacks.
- `SrsFlashcardView` preserves the returned `progressContext` in the legacy submit payload.
- `/api/srs/submit` accepts `progressContext` and maps TARGETED submissions to `sessionType: "targeted"` before delegating to `drillReviewService`, so the canonical writer updates the matching progress partition instead of defaulting to READINESS.
- Audit/report docs were updated so SRS due launchability and unsafe Card-linked serving are no longer listed as open blockers.

Tests/checks run:
- `npx vitest run functions/api/srs/next.test.ts functions/api/srs/due.test.ts`: passed, 20 tests.
- `npx vitest run functions/api/srs/next.test.ts functions/api/srs/due.test.ts functions/api/srs/submit-compat.test.ts functions/api/srs/submit.test.ts`: passed, 26 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm run lint && npm run build`: passed; lint still reports 422 pre-existing raw-color/design-token warnings and no errors.
- `npm test`: failed in the default forks pool due Vitest worker startup/termination timeouts; the isolated failed file `tests/regeneratePoolV2Safety.test.ts` passed immediately afterward.
- `npx vitest run --pool=threads --maxWorkers=4`: passed, 482 files, 9,506 tests passed, 1 skipped.
- `npm audit --omit=dev`: passed, found 0 vulnerabilities.

Remaining risks:
- The SRS compatibility route family is now launchable and context-aware, but `lib/services/srsService.ts` still contains localStorage-era helpers and broad compatibility types until all consumers are migrated.
- Full removal of SRS compatibility shells still depends on the source-typed question identity migration/backfill.
- Default fork-pool full Vitest execution is flaky/resource-sensitive in this environment; the constrained threads-pool run passed and should be preferred for local broad verification until the worker-start issue is isolated.
- Browser smoke for the authenticated SRS flashcard UI was not run in this slice.

## 2026-05-02 19:50 EDT - Reservoir Condition-Domain Refill Reconciliation

Files changed:
- `lib/services/reservoir/refillWorker.ts`
- `tests/refillWorker.test.ts`
- `DATA_PIPELINE_AND_SCHEDULING_AUDIT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_LOG.md`

Why:
- Continued the backend functionality loop for personalized study-plan execution. Condition-targeted study-plan tasks can use `MedicalContent.id`, while pre-generated questions may still carry either `conditionId` or `medicalContentId`. The refill worker previously scoped condition queues mostly by raw `PreGeneratedQuestion.conditionId`, which could leave condition-scoped reservoirs empty even when matching approved pool content existed.

What was verified:
- Reservoir scopes are now parsed into typed `adaptive`, `system`, `subcategory`, `condition`, and `confusion-remediation` variants before refill logic runs.
- Condition-scoped refill resolves the requested key across `MedicalContent.id` and legacy `Condition.id` domains, then applies compatible filters to due `UserProgress` rows and new `PreGeneratedQuestion` pool candidates.
- System and subcategory scoped refill still preserve scope intent and no longer falls through to the global blueprint pool for targeted fills.
- The refill worker continues to avoid standard `Question.id` inserts into `StudentReservoirItem.questionId`; new condition-scoped pool fills still use pre-generated question IDs only.

Tests/checks run:
- `npx vitest run tests/refillWorker.test.ts`: passed, 40 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `npx vitest run tests/refillWorker.test.ts tests/reservoir-service.test.ts tests/reservoir-policy.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts`: passed, 87 tests.
- `git diff --check`: passed.

Remaining risks:
- Full/partial reservation failure cleanup is still under review; unsafe or unusable hydrated reserved items may need explicit fail/expire behavior rather than simple release.
- Reservoir capacity policy still counts queued rows only; whether active reserved rows should contribute to refill capacity remains an operator/product policy decision.
- Canonical source-typed question identity and condition/concept backfill still need a schema/migration design before launch.

## 2026-05-02 19:54 EDT - Reservoir Reservation Failure Cleanup

Files changed:
- `lib/services/reservoir/reservoirService.ts`
- `lib/services/reservoir/index.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `tests/reservoir-service.test.ts`
- `DATA_PIPELINE_AND_SCHEDULING_AUDIT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_LOG.md`

Why:
- Closed the remaining reservoir reliability risk where a full reservation that hydrated into missing, unsafe, or unscorable questions could fall back correctly but release those bad reserved rows back to `queued`, allowing the next session to reserve them again.

What was verified:
- Added `failReservation()` as the terminal path for reserved items that cannot hydrate into learner-safe questions.
- `/api/study/session/generate` now tracks which reserved question IDs failed hydration, marks those as `failed`, and releases only the remaining safe-but-unused reserved rows before falling back to on-demand/pregenerated selection.
- Partial reservations that were not hydrated still release normally, because those rows were not proven unsafe and were not served.

Tests/checks run:
- `npx vitest run functions/api/study/session-generate.test.ts tests/reservoir-service.test.ts`: passed, 31 tests.
- `npx vitest run tests/refillWorker.test.ts tests/reservoir-service.test.ts tests/reservoir-policy.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts`: passed, 88 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.

Remaining risks:
- Reservoir capacity still counts only queued rows; counting active reserved rows against the cap is a separate policy decision.
- Live Cloudflare/Clerk/DB smoke has not been run for reservoir-backed session launch.
- Canonical question/source identity and concept identity still require a migration/backfill plan before production launch.

## 2026-05-02 19:58 EDT - Reservoir Partial Reservation And Batch Consume Closure

Files changed:
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `functions/api/drills/submit-reviews.ts`
- `tests/submitReviewIdempotency.test.ts`
- `DATA_PIPELINE_AND_SCHEDULING_AUDIT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_LOG.md`

Why:
- A read-only subagent review confirmed two remaining lifecycle gaps after the full-reservation cleanup: partial reservations were released without first classifying unsafe rows, and batch review submission did not mark answered reservoir items consumed.

What was verified:
- Session generation now hydrates any non-empty reservation before fallback. If a partial reservation contains unsafe/missing/unscorable rows, those specific IDs are failed and only hydrated safe-but-unused rows are released.
- Batch `/api/drills/submit-reviews` now mirrors singular `/api/drills/submit-review` reservoir consumption: after a successful canonical review write, it calls `markConsumed(session_id, [questionId])` when telemetry carries a session ID.
- Reservoir consume failure remains non-fatal so a completed answer is not blocked by queue cleanup.

Tests/checks run:
- `npx vitest run functions/api/study/session-generate.test.ts tests/submitReviewIdempotency.test.ts tests/reservoir-service.test.ts`: passed, 45 tests.
- `npx vitest run tests/reservoir-service.test.ts tests/refillWorker.test.ts tests/refillOrchestrator.test.ts functions/api/study/session-generate.test.ts functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts functions/api/srs/submit-compat.test.ts`: passed, 116 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.

Remaining risks:
- Reservoir queue cap still counts queued rows only and ignores active reserved rows; this is a policy/capacity decision, not a correctness bug in the learner flow.
- Production-like browser/API smoke for reservoir-backed sessions still requires authenticated Clerk/test DB setup.
- Canonical source identity and concept identity remain the next no-shortcut launch blockers.

## 2026-05-02 20:05 EDT - Study Path Contract And Accepted-Plan Persistence

Files changed:
- `components/dashboard/StudyPathDashboard/index.tsx`
- `components/dashboard/StudyPathDashboard/ProgressProjectionChart.tsx`
- `functions/api/study-path/progress.ts`
- `functions/api/study-path/accept.ts`
- `functions/api/study-path/studyPath.test.ts`
- `functions/api/study-path/accept.test.ts`
- `DATA_PIPELINE_AND_SCHEDULING_AUDIT.md`
- `PRODUCTION_IMPLEMENTATION_PLAN.md`
- `FINAL_PRODUCTION_READINESS_REPORT.md`
- `IMPLEMENTATION_LOG.md`

Why:
- Closed the next user-facing functionality blocker for creating a personalized study plan. The study-path UI expected raw recommendation/progress JSON while production endpoints return unified envelopes, the progress endpoint used Clerk IDs and called `generateStudyPlan` with the wrong signature, and accepting a study path did not create launchable daily-plan tasks.

What was verified:
- Study-path dashboard and projection fetchers now unwrap the unified API envelope and surface safe envelope errors.
- `/api/study-path/progress` resolves the internal user row, uses the internal `User.id` for optimizer services, calls `generateStudyPlan(prisma, input)`, and normalizes serialized cached plan dates before projecting.
- `/api/study-path/accept` now looks up the cached recommendation the dashboard just displayed and persists the accepted primary or alternative plan into `DailyStudyPlan.recommendedSessions` using existing launchable `/study/main-session` task shape.
- Accepted study-path sessions are grouped by plan date so multiple sessions on the same day become one daily plan with multiple tasks instead of overwriting each other.
- Study-path accept now prefers the server-cached recommendation but can persist a submitted accepted-plan payload when KV is unavailable or expired; both the primary plan CTA and alternative-plan selector send the plan they are accepting.

Tests/checks run:
- `npx vitest run functions/api/study-path/studyPath.test.ts`: passed, 5 tests.
- `npx vitest run functions/api/study-path/studyPath.test.ts functions/api/study-path/accept.test.ts`: passed, 7 tests.
- `npx vitest run functions/api/study-path/accept.test.ts functions/api/study-path/studyPath.test.ts`: passed, 8 tests; after accepted-plan payload fallback, passed again with 9 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after each study-path sub-slice.
- Final combined targeted pass for this continuation, `npx vitest run functions/api/study-path/accept.test.ts functions/api/study-path/studyPath.test.ts functions/api/study/session-generate.test.ts tests/submitReviewIdempotency.test.ts tests/reservoir-service.test.ts tests/refillWorker.test.ts tests/refillOrchestrator.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit-compat.test.ts`: passed, 125 tests.
- Final `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- Final `git diff --check`: passed.
- Final `npm run lint`: passed with 422 existing raw-color/design-token warnings and no errors.
- Final `npm run build`: passed.
- Final `npm audit --omit=dev`: passed, found 0 vulnerabilities.

Remaining risks:
- Accepted study-path persistence can now use the submitted plan payload when KV is unavailable, but durable accepted-plan storage under the V2 plan contract is still the better long-term source of truth.
- The accepted-plan task mapper currently creates safe adaptive/system-scoped tasks; condition-specific launch can be added only when topic IDs are resolvable to approved question pools.
- Full consolidation between `/api/study-path/*`, `/api/study-plan/*`, and `/api/users/me/daily-plan` still remains a larger StudyPlanTask V2 migration.

## 2026-05-02 20:27 EDT - Study Plan, SRS Submit, And Staging Safety Closure

Files changed:
- `lib/services/studyPlanService.ts`
- `functions/api/_shared/studyPlanService.ts`
- `functions/api/study-path/accept.ts`
- `functions/api/study-plan/progress.ts`
- `hooks/useStudyPlanLaunch.ts`
- `lib/study/mainSessionLaunch.ts`
- `components/session/SrsFlashcardView.tsx`
- `lib/services/srsService.ts`
- `lib/sdk/srsClient.ts`
- `lib/sdk/types.ts`
- `functions/api/_shared/staging-questions.ts`
- `functions/api/admin/staging/approve.ts`
- `functions/api/admin/refinery/action.ts`
- `functions/api/questions/generate-rag.ts`
- Focused regression tests and audit/report docs.

Why:
- Continued the remaining-risk loop into functionality seams that directly affect the user goal: generating questions and turning recommendations into a durable personalized study plan. Subagent audits found that accepted pending study paths could be overwritten on read, targeted system tasks could launch as condition sessions without condition identity, failed SRS submits could show explanations as if FSRS had persisted, and pending staging questions could bypass adequacy review into the approved pool.

What was verified:
- Existing pending daily plans with non-empty tasks are preserved on read instead of regenerated unless explicitly stale/forced.
- Accepted study-path upserts preserve matching task progress and do not downgrade active/completed day status to pending.
- `/api/study-plan/progress` now resolves or creates the internal user consistently with other plan endpoints.
- System-only targeted tasks route as system/adaptive work, not under-specified condition sessions.
- SRS flashcard review only reveals feedback after a confirmed saved response; failed/offline legacy submits stay on the question and show a retryable error.
- SDK SRS submit payload typing now matches `/api/srs/submit`.
- Ungraded staging rows can no longer be promoted by admin approval or refinery approval paths.
- Adequacy checks cannot mark a question `graded` when the medical critic is unavailable, blocked, or failed.
- RAG-generated questions are marked preview-only and attempted through staging persistence; they are not learner-submit-ready until approval promotes them.

Tests/checks run:
- `npx vitest run lib/services/studyPlanService.test.ts functions/api/study-path/accept.test.ts hooks/useStudyPlanLaunch.test.tsx lib/study/mainSessionLaunch.test.ts functions/api/study-plan/progress.test.ts`: passed, 26 tests.
- `npx vitest run components/session/SrsFlashcardView.test.tsx lib/sdk/__tests__/srsClient.test.ts functions/api/srs/submit.test.ts functions/api/srs/submit-compat.test.ts`: passed, 10 tests.
- `npx vitest run functions/api/_shared/staging-questions.test.ts functions/api/questions/generate.test.ts functions/api/questions/pool-security.test.ts functions/api/study/session-generate.test.ts`: passed, 23 tests.
- Combined focused pass, `npx vitest run lib/services/studyPlanService.test.ts functions/api/study-path/accept.test.ts hooks/useStudyPlanLaunch.test.tsx lib/study/mainSessionLaunch.test.ts functions/api/study-plan/progress.test.ts components/session/SrsFlashcardView.test.tsx lib/sdk/__tests__/srsClient.test.ts functions/api/srs/submit.test.ts functions/api/srs/submit-compat.test.ts functions/api/_shared/staging-questions.test.ts functions/api/questions/generate.test.ts functions/api/questions/pool-security.test.ts functions/api/study/session-generate.test.ts`: passed, 59 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm run lint`: passed with 422 existing raw-color/design-token warnings and 0 errors.
- `npm run build`: passed.

Remaining risks:
- No Prisma migration/backfill was applied; canonical question/source identity and canonical concept identity remain P0 launch blockers.
- Accepted plans are now preserved, but full consolidation across study-path, study-plan, and daily-plan contracts remains a V2 contract migration.
- SRS flashcard submit is fail-closed, but localStorage-era helper exports in `lib/services/srsService.ts` remain until consumers are fully migrated.
- RAG questions now enter staging, but generation adapters are still not unified under one canonical persistence contract.
- Live Cloudflare/Clerk/DB browser smoke was not run in this slice.

## 2026-05-02 20:58 EDT - Generation, Staging, SRS Helper, And Plan-Route Hardening

Files changed:
- `lib/services/srsReviewClient.ts`
- `components/session/SrsFlashcardView.tsx`
- `components/session/SrsFlashcardView.test.tsx`
- `tests/drillPipeline.integration.test.ts`
- `lib/services/srsService.ts`
- `lib/services/srsService.pure.test.ts`
- `functions/api/questions/curate.ts`
- `functions/api/questions/curate.test.ts`
- `functions/api/_shared/staging-questions.ts`
- `functions/api/_shared/staging-questions.test.ts`
- `functions/api/admin/staging/approve.ts`
- `functions/api/admin/staging/run-critic.ts`
- `functions/api/admin/refinery/action.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study/session-generate.test.ts`
- `lib/services/session/sessionService.ts`
- `functions/api/questions/pool.ts`
- `functions/api/questions/pool-security.test.ts`
- `lib/services/studyPlanService.ts`
- `lib/services/studyPlanService.test.ts`
- `functions/api/_shared/studyPlanService.ts`
- Current audit/report docs.

Why:
- Continued the remaining-risk closure loop into the user-facing functionality seams for generating questions, preserving approved content identity, launching personalized plan work, and retiring stale SRS localStorage-era code.

What was verified:
- `SrsFlashcardView` now uses an API-backed `srsReviewClient`; the old `lib/services/srsService.ts` localStorage helper and its pure test were deleted after import census.
- Admin curation approval now upserts an ACTIVE/APPROVED canonical `Question` mirror for approved `PreGeneratedQuestion` rows, fails closed on unscorable content, and keeps edited rows pending until reapproved.
- Staging queue processing no longer rejects otherwise valid questions when the AI adequacy critic is unavailable; those rows stay pending.
- Staging promotion now preserves the staging id as the approved `PreGeneratedQuestion.id`, retains the staging row as approved provenance, and blocks structurally invalid high-scoring critic promotions.
- Admin staging/refinery approval no longer deletes staging provenance after promotion.
- Learner-facing session generation no longer carries unused hot-path dynamic Gemini generation code; the active session generator remains approved-pool-only.
- The legacy session service no longer contains unused mid-session Gemini generation methods that contradicted the approved-pool contract.
- Admin pool seeding now fails closed if `correctAnswer` does not resolve to an option and writes approved validation metadata when it does.
- Study-plan task sanitization now canonicalizes stale launch params so old `mode=rapid_recall` rows cannot leak into `/study/main-session`.

Tests/checks run:
- `npx vitest run functions/api/_shared/staging-questions.test.ts functions/api/questions/pool-security.test.ts functions/api/study/session-generate.test.ts lib/services/session/sessionService.test.ts lib/services/studyPlanService.test.ts components/session/SrsFlashcardView.test.tsx tests/drillPipeline.integration.test.ts functions/api/questions/curate.test.ts`: passed, 60 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm run lint`: passed with 422 existing raw-color/design-token warnings and 0 errors.
- `npm run build`: passed.
- `npm audit --omit=dev`: passed, 0 vulnerabilities.
- `npm test -- --pool=threads --maxWorkers=4`: passed, 485 files, 9,508 tests passed, 1 skipped.

Remaining risks:
- No Prisma migration/backfill was applied; canonical question/source identity and canonical concept identity remain P0 launch blockers.
- `/api/srs/*` route shells, SDK compatibility types, and the `SRSItem` schema remain until browser/runtime compatibility and migration-backed cleanup are verified.
- Study-plan route/task behavior is more canonical, but full consolidation across study-path, study-plan, and daily-plan contracts remains a V2 migration.
- Generation/staging paths are safer, but one canonical generated-question adapter across admin, RAG, batch, staging, and pool paths remains future work.
- Live Cloudflare/Clerk/DB browser smoke was not run in this slice.
## 2026-05-03 12:06 EDT - Study-Plan Compatibility And Generation Serving Contract Closure

Files changed:
- `functions/api/_shared/canonical-question-mirror.ts`
- `functions/api/_shared/canonical-question-mirror.test.ts`
- `functions/api/_shared/studyPlanService.ts`
- `functions/api/_shared/studyPlanService.test.ts`
- `functions/api/_shared/staging-questions.ts`
- `functions/api/_shared/staging-questions.test.ts`
- `functions/api/admin/question-review.ts`
- `functions/api/admin/question-review.test.ts`
- `functions/api/admin/refinery/action.ts`
- `functions/api/admin/staging/approve.ts`
- `functions/api/questions/attempt.ts`
- `functions/api/questions/attempt.test.ts`
- `functions/api/questions/curate.ts`
- `functions/api/questions/generate-enhanced.ts`
- `functions/api/questions/generate-enhanced.test.ts`
- `functions/api/questions/pool.ts`
- `functions/api/questions/pool-security.test.ts`
- `functions/api/study/session/generate.ts`
- `functions/api/study-path/progress.ts`
- `functions/api/study-path/studyPath.test.ts`
- `functions/api/users/me/daily-plan.ts`
- `functions/api/users/me/daily-plan.test.ts`
- `lib/services/questionReviewGate.ts`
- `lib/services/questionReviewGate.test.ts`
- `services/ai/enhancedQuestionService.ts`
- `services/ai/enhancedQuestionService.test.ts`

Why:
- Continued the remaining-risk closure loop into the functionality seams required for question generation and personalized study-plan creation. The main goal was to make approved/generated questions submit-safe through canonical `Question` identity, make accepted plans visible across compatibility endpoints, and remove approval paths that could mark content approved without a canonical serving/submission target.

What was verified:
- Added a shared pre-generated-to-canonical `Question` mirror helper and reused it from attempt fallback, session generation, admin curation, admin pool seed, staging promotion, and admin question review approval.
- Admin review and auto-approval now fail closed unless the canonical `Question` mirror can be created first.
- Staging/refinery approval now supports explicit human review for pending staging rows while preserving automated promotion as graded-only.
- Enhanced generation now marks CoVe-passed `Question` rows `ACTIVE`/`APPROVED` with verification metadata so production serving filters can use them.
- The enhanced-generation client adapter now sends `Authorization` when provided, includes required `difficulty: "same"`, and unwraps the unified API envelope.
- `/api/users/me/daily-plan` now uses request-scoped Edge Prisma instead of the module-level proxy.
- `/api/study-plan/current` surfaces persisted accepted daily plans even when the user has no active target metadata instead of returning `needs-target`.
- `/api/study-path/progress` now accepts `planId` and selects the matching cached primary/alternative plan for projections.

Tests/checks run:
- `npx vitest run functions/api/users/me/daily-plan.test.ts functions/api/_shared/studyPlanService.test.ts functions/api/study-path/studyPath.test.ts functions/api/study-path/accept.test.ts hooks/useStudyPlanLaunch.test.tsx`: passed, 21 tests.
- `npx vitest run functions/api/questions/generate-enhanced.test.ts services/ai/enhancedQuestionService.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts lib/services/questionReviewGate.test.ts`: passed, 47 tests.
- Combined targeted pass: `npx vitest run functions/api/users/me/daily-plan.test.ts functions/api/_shared/studyPlanService.test.ts functions/api/study-path/studyPath.test.ts functions/api/study-path/accept.test.ts hooks/useStudyPlanLaunch.test.tsx functions/api/questions/generate-enhanced.test.ts services/ai/enhancedQuestionService.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts lib/services/questionReviewGate.test.ts functions/api/_shared/canonical-question-mirror.test.ts functions/api/questions/attempt.test.ts functions/api/questions/pool-security.test.ts functions/api/questions/curate.test.ts functions/api/study/session-generate.test.ts`: passed, 118 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `git diff --check`: passed.

Remaining risks:
- No Prisma migration/backfill was applied; canonical source identity and concept identity still need a migration design and disposable database probe.
- `generate-batch` still creates pending `PreGeneratedQuestion` review-queue rows rather than immediately increasing learner-servable supply; this remains intentionally conservative until a clinical validation gate is added to that path.
- Full V2 study-plan contract consolidation remains open across study-path, study-plan, and daily-plan routes.
- Live Cloudflare/Clerk/DB browser smoke was not run.

## 2026-05-03 12:56 EDT - Backend Functionality Risk Closure: Generation, Review Identity, And Study Launch

Files changed:
- `App.tsx`
- `functions/api/drills/smart-review.ts`
- `functions/api/drills/smart-review.test.ts`
- `functions/api/questions/attempt.ts`
- `functions/api/questions/attempt.test.ts`
- `functions/api/questions/due-siblings.ts`
- `functions/api/questions/generate-deep.ts`
- `functions/api/questions/record.ts`
- `functions/api/questions/record.test.ts`
- `lib/services/drillReviewService.ts`
- `services/questionService.ts`

Why:
- Continued the site-functionality hardening loop for the user goals of generating questions and creating personalized study plans. This slice focused on the remaining backend seams where generated/pre-generated questions could be served or submitted without a truthful approved canonical identity, and where review launches still depended on localStorage-era due queues.

What changed:
- `/api/questions/attempt` now resolves a canonical `Question` target before writing `QuestionAttempt`; pre-generated IDs are mirrorable only when the source row is `validationStatus: "approved"`, and unresolved identities return a typed 400 instead of drifting into FK failure.
- `/api/questions/record` now uses the same approved-only pre-generated mirror rule and has regression coverage for approved vs non-approved source IDs.
- `drillReviewService` now uses the shared canonical question mirror helper for pre-generated review attempts, so the canonical FSRS writer creates `ACTIVE`/`APPROVED` mirrors consistently with admin/session paths.
- `/api/drills/smart-review` now reads canonical FSRS progress sources, uses placeholder-user resolution, applies production serving filters to both `PreGeneratedQuestion` and `Question`, and skips questions whose correct answer cannot be resolved against the served options.
- `/api/questions/due-siblings` now returns `questionSource: "pre_generated"` and `sourceQuestionId` so downstream review submission preserves source identity.
- Review launches in `App.tsx` now route to the API-backed SRS review surface instead of constructing a local missed-question due queue; flagged-question variant enrichment preserves source identity when due siblings are returned.
- `/api/questions/generate-deep` is now admin-only preview generation. It still marks responses non-submittable, but learners cannot hit it as an authenticated AI endpoint.
- Client fallback question generation in `services/questionService.ts` now calls the server enhanced-generation endpoint with auth, and only accepts persisted verified generation results.

What was verified:
- Focused review/session/generation tests: `npx vitest run components/session/CoreAdaptiveSession.test.ts functions/api/study/session-summary.test.ts functions/api/_shared/studyPlanService.test.ts lib/services/studyPlanService.test.ts lib/ensureDueVariant.test.ts functions/api/srs/due.test.ts functions/api/srs/next.test.ts components/session/SrsFlashcardView.test.tsx services/core/mainSessionService.test.ts functions/api/questions/generate-enhanced.test.ts services/ai/enhancedQuestionService.test.ts lib/verified-question-generator.test.ts hooks/useStudyPlanLaunch.test.tsx lib/study/mainSessionLaunch.test.ts functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts functions/api/drills/smart-review.test.ts tests/drillReviewService.test.ts functions/api/drills/submit-review.test.ts functions/api/srs/submit.test.ts`: passed, 20 files / 156 tests.
- `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm run lint`: passed with 422 existing raw-color/design-token warnings and 0 errors.
- `npm run build`: passed.
- `npm test -- --pool=threads --maxWorkers=4`: passed, 493 files / 9,540 tests passed / 1 skipped.
- `npm audit --omit=dev`: passed, 0 vulnerabilities.

Remaining risks:
- No Prisma migration/backfill was applied. Canonical source identity, canonical concept identity, and any historical orphan cleanup remain migration-backed launch blockers.
- `generate-batch` and background refill jobs still need one canonical generated-question adapter and clinical approval policy before they should increase learner-servable supply automatically.
- Study-plan V2 consolidation is improved at launch/completion boundaries, but the plan/daily-plan/study-path contracts are not yet fully unified.
- Live Cloudflare/Clerk/database browser smoke was not run in this local pass.
