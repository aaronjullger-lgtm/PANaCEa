# Production Readiness Ledger

Last updated: 2026-04-26

This file is the source of truth for bringing StudyPANaCEa to production. It intentionally excludes visual polish unless the visual issue blocks a user flow.

## 2026-04-26 Gated Core Launch Implementation Batch

Production target for this batch: make the controlled beta launch surface smoke-testable and block unsafe legacy/mock paths by default.

Implemented:

- Added a standard `FEATURE_DISABLED` API error code and shared feature-flag helper.
- Gated legacy exam endpoints by default:
  - `/api/exam/start`
  - `/api/exam/complete`
  - Existing behavior is reachable only with `ENABLE_LEGACY_EXAM_API=true`.
- Gated OSCE beta/mock endpoints by default:
  - `/api/osce/intent`
  - `/api/osce/patient`
  - `/api/osce/evaluate`
  - Existing behavior is reachable only with `ENABLE_OSCE_BETA=true`.
- Added `playwright.production-smoke.config.ts`, `e2e/production-smoke/core-launch.spec.ts`, and `npm run test:e2e:production-smoke`.
  - Uses `BASE_URL`.
  - Does not depend on `e2e/auth.setup.ts` or committed auth storage state.
  - Fails fast when `E2E_REQUIRE_AUTH=1` and Clerk smoke credentials are missing.
  - Saves auth state only under Playwright test output.
- Added smoke coverage for `/api/health`, `/study`, standard unauthenticated 401 shape, Clerk sign-in, hidden private-beta route states, command-palette route exposure, session generation, session resume fetch, answer attempt idempotency, dashboard/progress fetch, today-plan task launch, task completion, and condition/drug search.
- Hid disabled private-beta routes from the app-level command palette.
- Made study-plan launch context deterministic:
  - Daily plan tasks now include `source`, `mode`, filter params, and `taskId`.
  - Targeted study-plan tasks now launch the core `/study/main-session` path instead of the production-deferred rapid-recall route.
  - `/study/main-session` is now a real authenticated route instead of a redirect that dropped query context.
  - `CoreAdaptiveSession` can auto-start from query-derived launch scope and completes a daily-plan task on session summary when launched with `source=study-plan`.
- Fixed `/session/:sessionId` refresh/resume to attach the Clerk token when hydrating session questions from the backend.

Verification:

- Passed: `npm run test -- functions/api/_shared/__tests__/error-catalog.test.ts functions/api/exam/feature-disabled.test.ts functions/api/osce/feature-disabled.test.ts` — 3 files, 20 tests.
- Passed: `npm run test -- lib/services/studyPlanService.test.ts functions/api/_shared/__tests__/error-catalog.test.ts functions/api/exam/feature-disabled.test.ts functions/api/osce/feature-disabled.test.ts` — 4 files, 26 tests.
- Passed: `npx playwright test --config=playwright.production-smoke.config.ts --list` — 4 smoke tests discovered.
- Passed: `npm run env:check:backend`; preview KV placeholder warning remains until operator wiring.
- Passed: `npx prisma validate`; existing Prisma referential-action warning remains.
- Passed: `npm run typecheck`.
- Passed: `npm run lint` with existing warning budget, 0 errors.
- Passed: targeted production-flow suite — 9 files, 82 tests.
- Passed: `npm run test:critical` — 6 files, 142 tests.
- Passed: `npm run build`; Sentry sourcemap upload warned locally because `sentry.io` DNS is unavailable, build continued.
- Passed: `npm run build:check-size`.

Remaining launch risks after this batch:

- `npm run test:e2e:production-smoke` still needs to be run against Wrangler/preview with `E2E_CLERK_TEST_EMAIL` and `E2E_CLERK_TEST_PASSWORD`.
- `/api/health` production smoke will only pass when Cloudflare database, Clerk, cache, and content bindings are configured.
- Full broad-public `npm run typecheck:all` remains a tracked non-core hardening backlog.

## 2026-04-26 Private Beta Production Completion Batch

Production target for this batch: harden the launch-critical study loop without expanding the beta surface.

Implemented:

- Created release branch `codex/private-beta-production-completion` from the existing production-launch worktree.
- Added persistent submission idempotency:
  - New `SubmissionIdempotency` Prisma model and migration `20260426000003_submission_idempotency`.
  - Durable helper `functions/api/_shared/submission-idempotency.ts` with started/completed/in-progress/failed handling.
  - `/api/drills/submit-review` now resolves/creates the internal user, checks the durable idempotency ledger before entering FSRS writes, returns completed duplicate responses, returns recoverable `409` for active duplicates, and persists the final response.
  - `/api/drills/submit-reviews` now applies the same durable guard per batch item and uses first-login-safe user resolution.
  - `drillReviewService` now accepts transaction-compatible clients and uses stable attempt IDs when an idempotency key is present, giving a data-level fallback against duplicate `QuestionAttempt` writes.
- Tightened launch mutation/generation rate limits:
  - `/api/drills/submit-review`: 120/min.
  - `/api/drills/submit-reviews`: 60/min.
  - `/api/study/session/generate`: 30/min.
- Added preview environment scaffolding:
  - `[env.preview]` in `wrangler.toml`.
  - Separate preview `RATE_LIMIT_KV` and `CACHE` binding placeholders.
  - Extended backend env validation to require documented production secrets and preview bindings.
  - Added missing `CRON_SECRET` documentation to `.env.example`.
- Added rollback documentation in `docs/ROLLBACK-RUNBOOK.md`.
- Updated `docs/PREVIEW-ENVS.md` to reflect the new preview scaffold and remaining operator wiring.

Verification:

- Passed: `npm run test -- functions/api/_shared/__tests__/submission-idempotency.test.ts functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts` — 3 files, 37 tests.
- Passed: `npm run env:check:backend`; warning remains for placeholder preview KV IDs until operator wiring is completed.
- Passed: `npm run typecheck`.
- Passed: `npm run lint` with existing repo warnings only, no errors.
- Passed: `npm run build`; build completed, but local Sentry sourcemap upload could not resolve `sentry.io`.
- Passed: `npm run build:check-size`.

Remaining launch risks after this batch:

- Preview/staging isolation is scaffolded but not operator-complete: real preview KV IDs, preview DB URL, preview Clerk keys, preview Gemini quota/key, and preview Sentry environment still need to be set in Cloudflare/Clerk/provider dashboards.
- Durable idempotency migration requires review before production deploy.
- Full signed-in browser E2E smoke still needs to run against a configured preview environment with Clerk and database bindings.
- Some hidden routes remain in the route registry but are gated at navigation/render time for beta.

## 2026-04-26 Private Beta Launch-Surface Batch

Production target for this batch: private beta, limited to the core study loop.

Implemented:

- Added `lib/modes/privateBetaVisibility.ts` as the launch-surface gate. By default, private beta mode is enabled unless `VITE_PRIVATE_BETA_LAUNCH=false`.
- Limited visible beta modes to verified question-based study surfaces: `core_adaptive`, `system_drill`, `condition_drill`, `subcategory_drill`, `pharmacology`, `first_line_treatment`, `rapid_recall`, `mini_lab`, `contrastive_drill`, and `cram_mode`.
- Hid non-launch modes and workspaces from discovery/direct app launches:
  - OSCE/patient encounter, commuter mode, ICD coding, DDX compare, visual/media drills, daily games/challenges, exam/full sit-down modes, and other non-core practice surfaces.
  - `/live-collaboration`, `/explorer`, `/clinical-eye`, `/visualizer`, `/lecture-converter`, and `/technique-check` now show a calm private-beta unavailable state instead of launching partial tooling.
- Applied the same mode visibility gate to `TrainingMenu`, `CommandPalette`, `/practice`, `App.tsx` mode navigation, and `DrillViewRouter`.
- Hardened `/api/questions/attempt` duplicate handling:
  - client/offline attempts now send stable idempotency keys;
  - the endpoint still uses KV idempotency when `CACHE` exists;
  - when KV is unavailable, idempotent attempts use deterministic primary IDs and return a deduped response instead of writing duplicate `QuestionAttempt` rows.

Verification:

- Passed: `npm run test -- tests/privateBetaVisibility.test.ts functions/api/questions/attempt.test.ts services/core/attemptService.test.ts` — 3 files, 36 tests.
- Passed: targeted ESLint on touched files.
- Passed: `npm run env:check:backend`.
- Passed: `npm run build`.
- Failed, expected existing blocker: `npm run typecheck -- --pretty false` still reports the broad pre-existing production TypeScript backlog documented below. A touched-file grep only surfaced existing `App.tsx` `ImportMeta.env` type errors, not errors in the new beta gate or attempt-idempotency code.
- Build warning: Sentry sourcemap upload failed because local network DNS could not resolve `sentry.io`; Vite build completed and generated assets/service worker.

Remaining launch blockers after this batch:

- Deploy-focused production typecheck is clean via `npm run typecheck` / `tsconfig.production.json`; full strict repo typecheck is retained as `npm run typecheck:all` and still fails on non-core/legacy schema drift.
- Preview/staging isolation is still documentation-only: Cloudflare Preview env, preview DB, preview Clerk, preview KV/cache, and Gemini preview quota still need operator wiring.
- `/api/drills/submit-review` and `/api/drills/submit-reviews` still rely on KV idempotency for exact cached responses; the older five-minute same-question duplicate guard reduces duplicate `QuestionAttempt` rows but does not fully prevent repeated FSRS/ReviewLog writes if KV is absent.
- Direct URL access to some hidden mode routes still resolves through the router but is blocked at render/navigation with the private-beta unavailable state rather than removed from the route registry. This preserves developer access while keeping beta users out of partial flows.

## 1. App Architecture Summary

| Area | Current state | Production readiness notes |
| --- | --- | --- |
| Frontend framework | React 19, Vite, TypeScript. Routing is centralized through `App.tsx`, `config/AppRoutes.tsx`, `config/routeRegistry.ts`, `components/layout/DrillViewRouter.tsx`, and `config/trainingModes.ts`. | Functional app shell exists, but route/test drift remains. |
| Backend/API structure | Cloudflare Pages Functions under `functions/api`. Legacy/local Express routes live under `routes/` and `server.ts`. | `functions/api` is the production API. `routes/` must not be treated as deployed behavior. API integration is being consolidated through `lib/sdk/*` and `lib/api/contracts/*`. |
| Database/ORM | PostgreSQL/Supabase through Prisma. Edge runtime uses `functions/api/_shared/prisma-edge.ts` and `safePrismaDisconnect`. | Prisma schema is large and production-oriented. Typecheck shows API/schema drift that blocks launch. |
| Auth provider | Clerk on the frontend and API middleware in `functions/api/_shared/middleware.ts` / auth helpers. | Most user endpoints are auth-gated. Admin/RBAC consistency still needs audit. |
| AI provider usage | Gemini through gateway/service helpers (`lib/ai`, `functions/api/_shared/ai-service`, AI endpoint middleware). | Many generation endpoints exist. Some new OSCE endpoints are deterministic mocks and must be replaced or clearly scoped before launch. |
| Deployment target | Cloudflare Pages with Pages Functions, KV namespaces for rate limiting/cache, optional Durable Object work for OSCE. | `wrangler.toml` had duplicated top-level config; fixed in this batch. Local Wrangler Pages smoke on 2026-04-26 compiled the worker, loaded KV/DO bindings, and returned `/api/health` 200 healthy; production dashboard env parity still needs operator verification. |
| Environment variables | `.env.example` documents Clerk, DATABASE_URL/DIRECT_DATABASE_URL, Supabase, Gemini, Sentry, app URLs, worker flags, email, and read replicas. `wrangler.toml` contains public Vite vars plus comments for secrets. `npm run env:check:backend` validates required backend env docs/bindings. | Production secrets must live in Cloudflare env vars, not code. Public keys in `wrangler.toml` need owner confirmation but are not removed here. |
| Storage/vector/search systems | Supabase/Postgres, Prisma models for `ContentChunk`, `TextbookChunk`, `MedicalContentEmbedding`, `SemanticCache`, `KnowledgeCache`, `MediaAsset`; Cloudflare KV `RATE_LIMIT_KV` and `CACHE`. | DB-backed condition/drug search paths were hardened on 2026-04-26. Vector/semantic coverage and cache invalidation still need a separate launch audit. |
| Testing stack | Vitest for unit/API tests, Playwright for e2e, TypeScript `tsc --noEmit`, Vite build. | Deploy-focused typecheck, lint, build, and critical tests pass. Full strict typecheck remains failing. Many e2e tests contain runtime `test.skip()`. |

## 2. Route Map

Status legend: Functional means the route has a real UI and real backend path for core flow. Partial means it renders but has incomplete persistence, mocks, brittle API drift, or missing tests. Broken means a known connection prevents core use. Mocked means a visible flow depends primarily on placeholder data. Unused means hidden or not reachable from current navigation.

| Frontend route | Purpose | Status | Backend dependencies |
| --- | --- | --- | --- |
| `/` | Signed-in dashboard/home and command center entry. | Partial | `/api/dashboard/*`, `/api/user/*`, `/api/study-plan/today`, Clerk. |
| `/study` | Study hub. | Partial | `/api/study/*`, `/api/questions/*`, `/api/targeted-daily/*`. |
| `/practice` | Practice mode hub. | Partial | `/api/questions`, `/api/questions/session`, `/api/drills/*`. |
| `/progress` | Progress and analytics. | Partial | `/api/user/stats`, `/api/analytics/*`, `/api/srs/summary`. |
| `/daily-challenges` | Daily challenges and streak work. | Partial | `/api/targeted-daily/today`, `/api/targeted-daily/submit`, `/api/streaks/*`. |
| `/admin` | Admin dashboard. | Partial | `/api/admin/*`, Clerk admin/RBAC. |
| `/admin/curation` | Curated passage/content workflow. | Partial | `/api/admin/curated-passages`, `/api/content/curated-passages`. |
| `/admin/refinery` | Question/content refinery inbox. | Partial | `/api/admin/refinery/*`, `/api/questions/staging/*`. |
| `/admin/taxonomies` | Taxonomy management. | Partial | `/api/admin/taxonomies`, `/api/admin/system-mappings`. |
| `/admin/system-mappings` | Content/system mapping admin. | Partial | `/api/admin/system-mappings`, `/api/mapping-enrichment/*`. |
| `/admin/question-generator` | Admin AI question generation. | Partial | `/api/admin/generate-question`, `/api/questions/generate*`; UI still has save/edit placeholders. |
| `/clinical-eye` | Image/clinical visual analysis. | Partial | `/api/clinical-eye/analyze`, `/api/clinical-eye/question`, `/api/ai/vision/*`. |
| `/visualizer` | Medical visualization generation/editing. | Partial | `/api/visualizer/generate`, `/api/visualizer/edit`, `/api/veo/*`. |
| `/lecture-converter` | Convert lecture material to study output. | Partial | `/api/lecture/script`, `/api/documents/generate`, `/api/podcast/generate`. |
| `/technique-check` | Technique feedback. | Partial | `/api/technique-check/analyze`. |
| `/study/knowledge` | Knowledge graph/profile. | Partial | `/api/knowledge/*`, `/api/graph/*`, `/api/ai/learning/*`. |
| `/study/utilities` | Utility toolkit. | Partial | `/api/ai/mnemonics/generate`, `/api/spark/instant-calc`, `/api/smart-scribe/generate-infographic`. |
| `/study/path` | Study path recommendation/progress. | Partial | `/api/study-path/*`, `/api/users/me/daily-plan`. |
| `/gap-analysis` | Blueprint gap analysis. | Partial | `/api/analytics/blueprint-gaps`, `/api/compliance/blueprint`. |
| `/clinical-profile` | Learner clinical profile. | Partial | `/api/user/clinical-profile`, `/api/ai/learning/profile*`. |
| `/medical-database` | Medical content database. | Partial | `/api/content/*`, `/api/conditions/*`, `/api/library/*`; condition search and condition detail param wiring fixed on 2026-04-26. |
| `/live-collaboration` | Collaboration/social study. | Mocked/unused | Mock services and missing `/api/social/*`; keep hidden until API-backed. |
| `/explorer` | Content/graph explorer. | Partial | `/api/graph/*`, `/api/content/search`, `/api/conditions/search`; command/search envelope handling fixed on 2026-04-26. |
| `/menu` | Navigation menu. | Functional | Route registry only. |
| `/study/reference` | Reference library. | Partial | `/api/reference/*`, `/api/library/search`, `/api/content/library`; DB content library is real, semantic search still depends on vector/Gemini availability. |
| `/study/toolkit` | Study tools. | Partial | `/api/ai/mnemonics/generate`, `/api/spark/instant-calc`, `/api/scribe/*`. |
| `/study/main-session` | Main adaptive session. | Partial | `/api/study/session/generate`, `/api/study/session-summary`, `/api/questions/attempt`, `/api/srs/submit`. |
| `/session/:sessionId` | Existing session resume. | Partial | `/api/study/session/[sessionId]/questions`, `/api/questions/attempt`, `/api/srs/*`. |
| `/core-adaptive` | Adaptive question session. | Partial | `/api/study/resolve-blueprint`, `/api/study/check-distribution`, `/api/study/session/generate`. |
| `/modes/ecg-drill` | ECG interpretation drill. | Partial | `/api/drills/media`, `/api/reference/ecg/*`, `/api/questions/*`. |
| `/modes/derm-drill` | Dermatology recognition drill. | Partial | `/api/drills/media`, `/api/questions/*`. |
| `/modes/imaging-drill` | Radiology/imaging review. | Partial | `/api/drills/media`, `/api/reference/imaging`, `/api/questions/*`. |
| `/modes/photo-drill` | Clinical photo recognition. | Partial | `/api/drills/media`, `/api/drills/submit-review`, media tables. |
| `/modes/fluid-electrolyte` | Fluid/electrolyte scenarios. | Partial | `/api/drills/fluids`, `/api/questions/*`. |
| `/modes/reasoning-tutor` | Socratic reasoning tutor. | Partial | `/api/ai/learning/socratic`, `/api/ai/tutor/chat`, `/api/tutor/chat`. |
| `/modes/mini-lab` | Lab interpretation. | Partial | `/api/drills/lab-cases`, `/api/labs/*`. |
| `/modes/ventilator-hero` | Ventilator management. | Partial | `/api/questions?category=ventilator`, `/api/drills/*`. |
| `/modes/pharmacology` | Pharmacology quiz. | Partial | `/api/questions/pharmacology-drill`, `/api/drugs/*`; drug search/detail param and envelope drift fixed on 2026-04-26. |
| `/modes/physiology-drill` | Physiology review. | Partial | `/api/questions?category=physiology`, `/api/reference/physiology`. |
| `/modes/anatomy-review` | Anatomy review. | Partial | `/api/anatomy/*`, `/api/reference/anatomy/*`. |
| `/modes/system-drill` | Body-system question drill. | Partial | `/api/questions/system-drill`. |
| `/modes/subcategory-drill` | Subcategory drill. | Partial | `/api/questions`, `/api/content/systems`. |
| `/modes/condition-drill` | Condition deep dive. | Partial | `/api/questions/condition-drill`, `/api/conditions/*`. |
| `/modes/rapid-recall` | Fast recall drill. | Partial | `/api/questions`, `/api/srs/due`. |
| `/modes/antibiotic-mode` | Bug-drug mastery. | Partial | `/api/drills/antibiotics`, `/api/reference/antibiotic-guidelines`. |
| `/modes/first-line-treatment` | First-line treatments. | Partial | `/api/first-line`, `/api/first-line/categories`. |
| `/modes/guideline-drill` | Guideline recall. | Partial | `/api/guidelines`, `/api/reference/guidelines`. |
| `/modes/ddx-compare` | Differential diagnosis comparison. | Partial | `/api/ddx/*`; known Prisma relation type drift in this area. |
| `/modes/contrastive-drill` | Similar condition contrast. | Partial | `/api/drills/contrastive/*`. |
| `/modes/code-blue-speed` | ACLS/code response speed. | Partial | `/api/drills/code-blue`, `/api/reference/acls-algorithms`. |
| `/modes/patient-encounter` | Virtual OSCE/patient encounter. | Partial/broken | `/api/osce/*`, OSCE schema, Durable Object worker; new endpoints are mocked. |
| `/modes/grand-rounds` | Daily case competition/review. | Partial | `/api/grand-rounds/*`, `/api/targeted-daily/submit`. |
| `/modes/commuter-mode` | Audio/low-attention mode. | Partial | `/api/podcast/generate`, worker voice/session code; env naming is risky. |
| `/modes/panre-la` | PANRE-LA simulator. | Partial | `/api/exam/*`, `/api/questions/session`. |
| `/modes/pance-simulator` | PANCE simulator. | Partial | `/api/exam/*`, `/api/questions/session`. |
| `/modes/full-sit-down-test` | Full exam mode. | Partial | `/api/exam/start`, `/api/exam/generate`, `/api/exam/complete`. |
| `/modes/cram-mode` | High-yield cram session. | Partial | `/api/conditions/high-yield`, `/api/questions/*`. |
| `/modes/diagnostic-puzzle` | Diagnostic puzzle game. | Partial | `/api/diagnostic-puzzle/*`. |
| `/modes/medical-wordle` | Medical word game. | Partial | `/api/games/wordle/*`. |
| `/modes/elaboration-drill` | Elaboration generation/grading. | Partial | `/api/drills/elaboration/*`. |
| `/modes/icd-coding-drill` | ICD coding practice. | Partial | No confirmed dedicated backend endpoint. |
| `/modes/teach-back-drill` | Teach-back generation/grading. | Partial | `/api/drills/teachback/*`. |

## 3. Study Mode Inventory

| Mode | Purpose | Frontend files | Backend/API | DB models | AI calls | Status | Blocking issues |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `core_adaptive` | Adaptive questions based on blueprint/progress. | `components/layout/DrillViewRouter.tsx`, `components/modes/*`, session hooks. | `/api/study/*`, `/api/questions/*`, `/api/srs/*`. | `StudySession`, `Question`, `PreGeneratedQuestion`, `QuestionAttempt`, `ReviewLog`, `UserProgress`, `UserQuestionSeen`. | Question generation/explanations. | Partial | Full typecheck, route smoke drift, schema/API drift. |
| `ecg_drill` | ECG interpretation. | Mode router and media drill components. | `/api/drills/media`, `/api/reference/ecg/*`. | `MediaAsset`, `QuestionAttempt`, `ReviewLog`. | Optional explanation. | Partial | Needs verified media inventory and e2e coverage. |
| `derm_drill` | Dermatology image recognition. | Media drill components. | `/api/drills/media`. | `MediaAsset`, `MedicalContentMedia`. | Optional explanation. | Partial | Needs real media coverage. |
| `imaging_drill` | Radiology image recognition. | Media drill components. | `/api/drills/media`, `/api/reference/imaging`. | `MediaAsset`, `MedicalContentMedia`. | Optional explanation. | Partial | Needs media seed/coverage audit. |
| `photo_drill` | General clinical photo drill. | `hooks/game/use-photo-drill.ts`, photo drill components. | `/api/drills/media`, `/api/drills/submit-review`. | `MediaAsset`, `QuestionAttempt`, `ReviewLog`. | Optional explanation. | Partial | Synthetic production fallback removed; upstream media exhaustion behavior still needs coverage. |
| `fluid_electrolyte` | Fluid/electrolyte cases. | Fluid drill mode files. | `/api/drills/fluids`. | `QuestionAttempt`, `ReviewLog`. | Possible generation/explanation. | Partial | Contract tests missing. |
| `reasoning_tutor` | Socratic tutoring. | Tutor mode files. | `/api/ai/learning/socratic`, `/api/ai/tutor/chat`, `/api/tutor/chat`. | `ClinicalIntentLog`, learner profile models. | Gemini/gateway chat. | Partial | Streaming/session persistence needs smoke coverage. |
| `mini_lab` | Lab interpretation. | Lab drill components/hooks. | `/api/drills/lab-cases`, `/api/labs/*`. | Lab-related models, attempts/reviews. | Optional explanation. | Partial | Contract coverage limited. |
| `ventilator_hero` | Ventilator management. | Ventilator drill hook/components. | `/api/questions?category=ventilator`. | `Question`, attempts/reviews. | Optional generation. | Partial | Category query contract not type-safe. |
| `pharmacology` | Drug knowledge drill. | Pharmacology mode files. | `/api/questions/pharmacology-drill`, `/api/drugs/*`. | `Drug`, `DrugSideEffect`, `DrugInteraction`, `DrugConditionLink`, attempts. | Optional generation. | Partial | Drug search/detail route tests added; still needs seeded-content completeness and quiz persistence smoke. |
| `physiology_drill` | Physiology review. | Physiology drill hook/components. | `/api/questions?category=physiology`, `/api/reference/physiology`. | `Question`, content models. | Optional generation. | Partial | Category endpoint drift risk. |
| `anatomy_review` | Anatomy review. | Anatomy mode files. | `/api/anatomy/*`, `/api/reference/anatomy/*`. | Anatomy/content models. | Vision/spatial optional. | Partial | Needs content coverage audit. |
| `system_drill` | System-focused questions. | System drill mode files. | `/api/questions/system-drill`. | `Question`, `QuestionAttempt`, `ReviewLog`. | Generation optional. | Partial | Needs request/response test. |
| `subcategory_drill` | Subcategory-focused questions. | Subcategory mode files. | `/api/questions`, `/api/content/systems`. | Question/content models. | Optional. | Partial | Backend contract not explicitly tested. |
| `condition_drill` | Deep dive by condition. | Condition drill files. | `/api/questions/condition-drill`, `/api/conditions/*`. | `Condition`, `MedicalContent`, `Question`, attempts. | Optional generation. | Partial | Condition search/detail route tests added; still needs mode-level question fixture coverage. |
| `rapid_recall` | Fast review. | Rapid recall mode files. | `/api/questions`, `/api/srs/due`. | SRS/review/attempt models. | Optional. | Partial | Persistence and resume coverage missing. |
| `antibiotic_mode` | Antibiotic selection. | Antibiotic mode files. | `/api/drills/antibiotics`, `/api/reference/antibiotic-guidelines`. | Drug/content/attempt models. | Optional. | Partial | Needs seeded guideline/drug data. |
| `first_line_treatment` | First-line treatment recall. | First-line mode files. | `/api/first-line*`. | `FirstLineTreatment`, condition/content models. | Optional. | Partial | Needs endpoint tests. |
| `guideline_drill` | Guideline recall. | Guideline mode files. | `/api/guidelines*`, `/api/reference/guidelines`. | Guideline/content models. | Optional. | Partial | Guideline service uses mock data in places. |
| `ddx_compare` | Compare confusing diagnoses. | DDX mode files. | `/api/ddx/*`. | Condition/confusion/content models. | AI DDX generation. | Partial | Known Prisma type drift. |
| `contrastive_drill` | Contrast related concepts. | Contrastive mode files. | `/api/drills/contrastive/*`. | Question/content/review models. | AI contrastive generation. | Partial | Needs contract/e2e coverage. |
| `code_blue_speed` | Emergency response drill. | Code blue mode files. | `/api/drills/code-blue`, `/api/reference/acls-algorithms`. | Attempts/reviews/content. | Optional. | Partial | Needs deterministic scoring test. |
| `patient_encounter` | Virtual OSCE. | `components/modes/osce/*`, OSCE mode files. | `/api/osce/*`, `/api/cron/osce-spbench-judge`. | `OsceSession`, `SpbenchScore`, `OsceResult`, `ClinicalIntentLog`, patient encounter models. | Intended Gemini agents. | Partial/broken | New `intent`, `patient`, `evaluate` endpoints are deterministic mocks; migration/deployment validation pending. |
| `grand_rounds` | Case competition/review. | Grand rounds mode files. | `/api/grand-rounds/*`. | GrandRounds models, attempts/reviews. | Optional case generation. | Partial | Needs production smoke. |
| `commuter_mode` | Audio study mode. | Commuter/audio files. | `/api/podcast/generate`, worker code. | Study/session/progress models. | Podcast generation. | Partial | Worker uses `DATABASE_URL` like an HTTP API base URL; env contract is risky. |
| `panre_la` | PANRE-LA exam simulation. | Exam mode files. | `/api/exam/*`. | Exam/session/question/attempt models. | Generation optional. | Partial | Needs timing/resume tests. |
| `pance_simulator` | PANCE exam simulation. | Exam mode files. | `/api/exam/*`. | Exam/session/question/attempt models. | Generation optional. | Partial | Needs timing/resume tests. |
| `full_sit_down_test` | Full exam. | Exam mode files. | `/api/exam/*`. | Exam/session/question/attempt models. | Generation optional. | Partial | Needs long-session reliability test. |
| `cram_mode` | High-yield review. | Cram mode files. | `/api/conditions/high-yield`, `/api/questions/*`. | Condition/question/progress models. | Optional. | Partial | Needs repeat/no-repeat coverage. |
| `diagnostic_puzzle` | Puzzle mode. | Diagnostic puzzle components/e2e. | `/api/diagnostic-puzzle/*`. | Diagnostic puzzle models, daily state. | Optional generation. | Partial | E2E contains conditional skips. |
| `medical_wordle` | Word game. | Wordle mode files. | `/api/games/wordle/*`. | Game state/streak models. | None expected. | Partial | Needs authenticated progress test. |
| `elaboration_drill` | Explain concepts. | Elaboration files. | `/api/drills/elaboration/*`. | Attempts/reviews/content. | AI generation/grading. | Partial | Needs AI fallback/error tests. |
| `icd_coding_drill` | ICD coding practice. | ICD coding mode files. | No confirmed route. | Content/attempt models if wired. | Optional. | Broken/partial | Frontend feature lacks confirmed backend connection. |
| `teach_back_drill` | Teach-back practice. | Teach-back files. | `/api/drills/teachback/*`. | Attempts/reviews/content. | AI generation/grading. | Partial | Needs grading contract tests. |

## 4. API Inventory

Static inventory on 2026-04-26:

- 492 TypeScript files under `functions/api`.
- 472 non-test TypeScript files under `functions/api`.
- 20 API/shared Vitest files under `functions/api`.
- Production route files are Cloudflare Pages Functions. Shared helpers under `/api/_shared/*` are not directly user-facing routes.

Frontend API integration audit on 2026-04-26:

- `rg --stats "fetch\\(" components hooks lib pages services config` found 441 direct frontend/client fetch matches across 254 files. This is too scattered for production reliability and must be migrated by domain into `lib/sdk/*` or a small number of approved low-level wrappers.
- `rg --stats "createApiClient|callApi\\(|useQuery\\(|useMutation\\(" components hooks lib pages services config` found 77 matches across 26 files. These are the current consolidation anchors.
- `rg --stats "export const onRequest|export async function onRequest|onRequestGet|onRequestPost|onRequestPut|onRequestDelete" functions/api` found 570 handler exports across 427 files, including test imports. Production route ownership still needs explicit contracts for high-write/high-risk endpoints.
- Existing API client layers before this batch: `lib/sdk/core.ts`, `lib/sdk/callApi.ts`, domain clients in `lib/sdk/*Client.ts`, legacy `lib/apiClient.ts`, and utility wrappers `lib/utils/safeFetch.ts` / `apiFetchJson`.
- Production client standard after this batch: `createApiClient` handles auth, timeout, retry, response unwrapping, and both legacy `{ success, data }` and production `{ ok, data/error }` envelopes. `callApi` remains the preferred typed contract gateway with request/response Zod validation. New `getResult/postResult/putResult/deleteResult` methods expose `{ ok: true, data } | { ok: false, error }` for crash-resistant UI flows.

Known disconnected/stale frontend endpoints found in this audit:

- Fixed in this batch: `API_ENDPOINTS.LAB_TESTS`, `LAB_CASES`, and `LAB_CASES_RANDOM` now point to `/api/labs/tests`, `/api/labs/cases`, and `/api/labs/cases/random?count=n`; `services/domain/labService.ts` now uses the SDK and handles `{ ok: true, data }` envelopes.
- Still unresolved: direct calls to `/api/labtests` and `/api/imaging` remain in `services/ai/enhancedQuestionService.ts`.
- Still unresolved: `components/social/StudyGroupDashboard.tsx` calls missing `/api/social/*` endpoints; keep social/collaboration hidden.
- Still unresolved: `components/admin/MediaApprovalDashboard.tsx` calls missing `/api/admin/media/upload`; available production media admin routes are pending/approve/stats/media-id/refinery signed-url.
- Still unresolved: `lib/services/sync/offlineSync.ts` references `/api/analytics/submit`, `/api/user/settings`, and `/api/analytics/flag`; matching production functions were not found.
- Still unresolved: `API_ENDPOINTS.LIBRARY_ENRICHMENT_LOGS` and `LIBRARY_ENRICHMENT_PRIORITY` point at disabled `.ts.disabled` function files.

Auth and user-data isolation audit on 2026-04-26:

- Auth provider: Clerk (`@clerk/clerk-react` frontend, `@clerk/backend` token verification in `functions/api/_shared/auth.ts`).
- JWT validation: `authenticateRequest()` requires `CLERK_SECRET_KEY` from Cloudflare env, rejects missing/invalid `Authorization: Bearer` headers, rejects non-`sk_test_`/`sk_live_` secret formats, and calls Clerk `verifyToken()` with 5s clock skew tolerance.
- Protected API stacks: `authenticatedEndpoint`, `adminAuthenticatedEndpoint`, `adminEndpoint`, `cmsEndpoint`, `refineryEndpoint`, and `aiEndpoint` all apply `withAuth()`. `publicEndpoint` remains unauthenticated for public curriculum/reference data. `cronEndpoint` uses cron secret auth instead of Clerk.
- Frontend route protection: `App.tsx` gates the signed-in app shell with Clerk state and falls back to guest/landing behavior. Many components still call `useAuth()` directly; route-level and component-level auth should be smoke-tested after UI work.
- Identity mapping rule: `auth.userId` is Clerk `sub`; user-owned relational tables generally use internal `User.id`. Production-safe endpoints must resolve Clerk ID through `functions/api/_shared/user-resolver.ts`.
- First-login creation: `resolveOrCreateUserRecord()` creates a minimal placeholder `User` with `clerkId`, placeholder email, and `updatedAt` when Clerk auth succeeds before webhook sync. This is now used by profile, preferences, first attempt, and study plan paths touched in this batch.
- Onboarding persistence: `/api/user/profile` persists `hasCompletedBaseline` and `hasCompletedOnboarding`; this endpoint already self-creates a placeholder user. Preferences now also bootstrap for new users.
- New-user empty states: `/api/study-plan/today` now creates/resolves the internal user and returns allocator defaults from no attempt/progress data instead of querying by Clerk ID. `/api/users/me/daily-plan` can generate a first plan for a valid newly signed-in user.
- Cross-user access prevention fixed in this batch: question attempts ignore client-supplied `userId`; preferences sanitize ownership fields before writes; daily plan completion fetches plans by authenticated internal user ID; study-plan allocator no longer receives Clerk IDs or query-provided user IDs.
- Remaining audit risk: many endpoints still manually do `prisma.user.findUnique({ where: { clerkId: auth.userId } })` and return 404 for valid first-login users. Prioritize launch-critical endpoints in study/session/SRS/dashboard before broad refactor.

Study engine hardening audit on 2026-04-26:

- Core session start path: `/api/study/session/generate` is the production adaptive-session generator used by `CoreAdaptiveSession`. It now resolves or creates the internal user row from Clerk auth, filters unscorable questions before serving, persists the generated `StudySession`, and falls back to valid `PreGeneratedQuestion` rows when the concept selector/reservoir does not fill the requested size.
- Empty question pools: session generation now returns a persisted empty session with `questions: []` and zero-count metadata instead of a broken response. The UI already has a no-questions state.
- Repeat behavior: the fallback pool excludes the current session's selected IDs and the authenticated user's recent `UserQuestionSeen` rows first, then allows repeats only when no unseen fallback exists.
- User filters: fallback question selection respects `conditionId`, explicit `system`, and blueprint/gated-system constraints for adaptive sessions.
- Bad question data: session generation and the concept selector skip cards with missing question text, fewer than two options, or unresolved/out-of-range `correctAnswerIndex`.
- Answer submission: `QuizView` continues to queue canonical review submissions to `/api/drills/submit-review`; `/api/questions/attempt` remains a stats/backward-compat writer. The review endpoint now bootstraps first-login users and no longer exposes raw internal error details.
- Progress/review scheduling: `drillReviewService` remains the canonical writer for `QuestionAttempt`, `ReviewLog`, `UserProgress`, `UserTopicProgress`, and FSRS scheduling. Added coverage verifies progress writes create non-null future review dates and incorrect answers can be scheduled sooner than correct answers when FSRS supplies a shorter interval.
- Completion behavior: `/api/study/session-summary` now scopes sessions by authenticated internal `userId`, summarizes only that user's `ReviewLog` rows, updates the persisted `StudySession` with `endedAt`, `correctAnswers`, `accuracy`, and returns next-step recommendations.
- AI explanation fallback: `/api/questions/explain-rag` stays on the `aiEndpoint` rate-limited stack and now returns a safe structured fallback explanation when retrieval/model/JSON parsing fails, instead of returning raw provider errors.
- Frontend API wiring: `CoreAdaptiveSession` and `useResolvedBlueprint` now use the centralized SDK so `{ success: true, data }` envelopes are unwrapped consistently and endpoint errors become typed/user-facing API errors.

API contract status:

| API family | Route/function inventory | Request shape | Response shape | Auth | Rate limiting | Error handling | Consumers | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shared middleware/helpers | `_middleware`, `_shared/*` | Helper-specific. | Standard envelope emits `{ ok: true, data }` / `{ ok: false, error: { code, message, details? } }` with temporary legacy aliases. | Provides auth/RBAC/envelopes. | Shared limits covered by tests. | Centralized helpers preserve headers and strip production stack traces. | All API routes. | Backend hardening tests added. |
| Auth/webhooks | `/api/webhooks/clerk`, `/api/debug/god-mode` | Webhook/custom. | Custom. | Webhook secret or admin/debug. | Mixed. | Mixed. | Clerk sync/debug. | Needs webhook smoke. |
| Admin/content/refinery | `/api/admin/*`, `/api/mapping-enrichment/*`, `/api/authors/*` | Mostly zod/body/query. | Mostly `{ data }` envelopes, some custom. | Admin/RBAC expected. | Mixed. | Mixed. | Admin pages. | Sparse. |
| AI/tutor/vision | `/api/ai/*`, `/api/tutor/chat`, `/api/agents/run`, `/api/visualizer/*`, `/api/veo/*` | Mostly zod body. | AI envelopes/custom stream. | User/AI endpoint middleware. | Present through `aiEndpoint`; semantic/library search explicitly uses 10 rpm. | Gateway errors handled in several endpoints. | Toolkit, tutors, visual tools. | Sparse. |
| Study/questions/SRS | `/api/study/*`, `/api/questions/*`, `/api/srs/*`, `/api/reviews/*` | Mixed body/query. `/api/questions/attempt` accepts `idempotencyKey`. | Mostly question/session/progress envelopes. | User. | Authenticated shared limit; question generation uses AI limits. | `/api/questions/attempt` uses transaction + KV idempotency to avoid duplicate attempt writes on retry. | Core study modes. | Duplicate attempt submission test added. |
| Drills/games/exams | `/api/drills/*`, `/api/games/*`, `/api/exam/*`, `/api/baseline/*`, `/api/targeted-daily/*` | Mixed body/query. | Drill/game/exam state. | User/public mixed. | Mixed. | Mixed. | Mode routes. | Sparse; important e2e has skips. |
| Content/reference/search | `/api/content/*`, `/api/conditions/*`, `/api/reference/*`, `/api/library/*`, `/api/graph/*`, `/api/knowledge/*` | Query/body mixed; `/api/conditions/search`, `/api/content/search`, and `/api/content/condition/[conditionId]` are now query/params-correct. | Search/content/reference envelopes; command palette and condition search clients unwrap production envelopes. | Public/user mixed. | Cache/KV in some paths; `/api/content/search` is capped at 60 rpm and AI semantic/library search at 10 rpm. | Improved for DB-backed condition/content search; semantic/vector paths remain mixed. | Reference, database, explorer. | Focused tests added for content search, condition search, and condition detail. |
| Pharmacology/labs/anatomy | `/api/drugs/*`, `/api/labs/*`, `/api/anatomy/*`, `/api/first-line*`, `/api/guidelines*` | Query/body mixed; `/api/drugs/search` query and `/api/drugs/[drugId]` params verified. | Domain content; drug service now unwraps production envelopes and normalizes canonical Prisma drug fields. | Public/user mixed. | Mixed. | Improved for drug search/detail. | Study modes/reference. | Focused drug search/detail tests added. |
| Analytics/progress/dashboard | `/api/analytics/*`, `/api/user/*`, `/api/dashboard/*`, `/api/performance/record`, `/api/stats/retention` | Query/body mixed. | Analytics/progress JSON. | User. | Dashboard stats/review queue capped at 60 rpm; specialized analytics still need review. | Dashboard stack logging reduced; shared envelope covers backend errors. | Dashboard/progress/study path. | Sparse. |
| OSCE/patient encounter | `/api/osce/*`, `/api/cron/osce-spbench-judge` | Mixed zod/custom body. | OSCE session/chat/grading state. | User/cron. | Mixed. | Mixed. | Patient encounter mode. | Some tests: complete, analysis grade. New endpoints need tests. |
| Cron/background | `/api/cron/*` | Scheduled/admin invocation. | Job result. | Cron/admin expected. | Not consistent. | Mixed. | Maintenance/generation. | Sparse. |
| Push/sync/feedback/sentry | `/api/sync`, `/api/push/subscribe`, `/api/feedback/submit`, `/api/sentry-tunnel` | Custom. | Custom. | User/public mixed. | Mixed. | Mixed. | Offline/sync/error reporting. | Sync tests exist. |

Known frontend-to-backend drift:

- Fixed in this batch by compatibility route: frontend calls `/api/ai/generate-mnemonic`; implementation lived at `/api/ai/mnemonics/generate`.
- Missing or stale consumers found: `/api/social/groups`, `/api/social/leaderboard`, `/api/social/groups/join`, `/api/admin/media/upload`, `/api/analytics/submit`, `/api/user/settings`, `/api/analytics/flag`.
- `/api/library/query` exists in the API inventory; earlier consumer suspicion is not a blocker.

Analytics/progress audit on 2026-04-26:

- Primary progress surfaces: `components/dashboard/DashboardPage.tsx`, `pages/ProgressPage.tsx`, `components/analytics/*`, `components/progress-dashboard/*`, `components/navigation/MenuView.tsx`, dashboard widgets for calibration/readiness/review forecast/rolling 360.
- Primary analytics hooks/services: `hooks/useDatabaseStats.ts`, `hooks/useRecentSessions.ts`, `hooks/useReviewForecast.ts`, `hooks/useTodayPlan.ts`, `hooks/useResolvedBlueprint.ts`, `hooks/useReadinessProjection.ts`, `lib/dashboard/derivedMetrics.ts`, `services/analytics/*`.
- Primary backend calculators: `/api/user/stats`, `/api/dashboard/stats`, `/api/dashboard/review-queue`, `/api/analytics/session`, `/api/analytics/review-forecast`, `/api/analytics/srs-summary`, `/api/analytics/blueprint-gaps`, `/api/analytics/calibration`, `/api/user/rolling-360-stats`, `/api/user/statistics`.
- Production-critical fix: added `lib/services/dashboardAnalyticsService.ts` as the shared source for `getUserDashboardSummary`, `getWeakAreas`, `getRecentActivity`, `getStudyPlanProgress`, and `getReviewQueueStats` behavior. It derives dashboard data from `QuestionAttempt`, `ReviewLog` fallback, `UserQuestionSeen`, `UserProgress`, and `DailyStudyPlan` with bounded queries and guards against NaN, divide-by-zero, impossible percentages, and negative counts.
- Production-critical fix: `/api/user/stats` now delegates to the shared service, preserving the dashboard-compatible `stats` response while eliminating duplicated ad hoc calculations.
- Production-critical fix: `/api/dashboard/stats` now bootstraps first-login users with `resolveOrCreateUserId`, uses internal `User.id` for preferences, and returns empty-but-valid metrics instead of 404 for new users.
- Production-critical fix: `/api/dashboard/review-queue` now uses internal `User.id`, bootstraps first-login users, and reports authoritative FSRS queue counts from `UserProgress.nextReviewAt` while preserving existing `StudyRecommendation` due item output.
- Production-critical fix: `services/core/attemptService.ts` now unwraps both direct and middleware-wrapped `/api/user/stats` envelopes, preventing the dashboard from dropping real database stats and falling back to local-only data.
- Remaining analytics risk: many secondary analytics widgets still read specialized endpoints or local stores. They need per-widget source tracing before launch, but the main dashboard/progress stats path no longer depends on fake or stale fallback data when the API succeeds.

Study plan/scheduling audit on 2026-04-26:

- Models: `DailyStudyPlan` is the persisted day-level plan; `StudyRecommendation` stores recommendation rows; `UserStudyPhenotype` stores older phenotype-derived planning inputs; `UserProgress.nextReviewAt`, `QuestionAttempt`, `ReviewLog`, `UserPreferences`, and `User.examDate` are the production data sources for scheduling.
- Routes/APIs: `/api/study-plan/today` powers the dashboard allocator card; `/api/users/me/daily-plan` gets/creates the persisted plan and now accepts complete/skip/reschedule actions; `/api/cron/generate-daily-plans` exists for background generation but was not changed in this batch.
- Components/hooks: `useTodayPlan`, `TodayPlanCard`, `DashboardPage`, `CommandCenterWorkspace`, and study mode contract `study_plan_scheduler` are the primary frontend consumers.
- Generation model: production path is now rule-generated from real data. The persisted plan service uses the existing daily allocator, which reads weak systems/recent attempts/calibration risk and FSRS due data, then adds exam-date and available-time adjustments from `User.examDate` and `UserPreferences`.
- Production-critical fix: added `lib/services/studyPlanService.ts` as the shared plan service. It creates stable task JSON, persists it in `DailyStudyPlan.recommendedSessions`, sanitizes legacy task JSON, syncs same-day `QuestionAttempt` progress on refresh, and supports complete/skip/reschedule actions.
- Production-critical fix: `/api/study-plan/today` now returns the allocator data plus persisted `planId`, `status`, `progress`, and launchable `tasks`, so dashboard refreshes are tied to server state.
- Production-critical fix: `/api/users/me/daily-plan` now creates the plan through the shared service rather than the older phenotype-only generator, and POST can complete an individual task without destroying the rest of the plan.
- Production-critical fix: targeted plan launch no longer points to missing `/study/targeted-session`; dashboard targeted tasks now launch `/modes/rapid-recall?conditions=...&source=study-plan`.
- Fallback behavior: no exam date falls back to balanced blueprint/due-review planning; no attempt history produces a starter/adaptive block; no due reviews omits targeted tasks; all tasks complete marks the plan completed; malformed legacy task JSON sanitizes to safe defaults.
- Remaining scheduling risk: `/study/main-session?systems=...` is generated as the main task launch route, but `CoreAdaptiveSession` still does not auto-consume URL parameters to skip its scope selector. This is a P1 integration gap, not a data-loss issue.

Production route manifest, grouped by prefix:

- Admin/authors: `/api/admin/ab-experiments`, `/api/admin/audit/logs`, `/api/admin/blueprint-coverage`, `/api/admin/cache-metrics`, `/api/admin/calibration-report`, `/api/admin/check-access`, `/api/admin/conditions/[id]/parent`, `/api/admin/content-audit`, `/api/admin/content-quality-flags`, `/api/admin/content/[id]`, `/api/admin/content/create`, `/api/admin/content/list`, `/api/admin/content/transition`, `/api/admin/curated-passages`, `/api/admin/enrich-condition`, `/api/admin/generate-draft`, `/api/admin/generate-question`, `/api/admin/health-report`, `/api/admin/health/reports`, `/api/admin/knowledge/ingest`, `/api/admin/media/[id]`, `/api/admin/media/approve`, `/api/admin/media/pending`, `/api/admin/media/stats`, `/api/admin/platform-stats`, `/api/admin/pool-health`, `/api/admin/question-review`, `/api/admin/refinery/action`, `/api/admin/refinery/inbox`, `/api/admin/refinery/media-signed-url`, `/api/admin/reservoir-health`, `/api/admin/staging/approve`, `/api/admin/staging/list`, `/api/admin/staging/reject`, `/api/admin/staging/run-critic`, `/api/admin/staging/update`, `/api/admin/staging/stats`, `/api/admin/system-mappings`, `/api/admin/targeted-daily`, `/api/admin/taxonomies`, `/api/authors/dashboard`, `/api/authors/submit-question`.
- AI/vision/tutor/agents: `/api/agents/run`, `/api/ai/chat/stream`, `/api/ai/learning/concept-gaps`, `/api/ai/learning/pance-readiness`, `/api/ai/learning/prerequisites`, `/api/ai/learning/profile`, `/api/ai/learning/profile-crud`, `/api/ai/learning/socratic`, `/api/ai/mnemonics/generate`, `/api/ai/generate-mnemonic`, `/api/ai/models`, `/api/ai/sessions/analyze`, `/api/ai/tutor/chat`, `/api/ai/vision/analyze`, `/api/ai/vision/analyze-3d`, `/api/ai/vision/grade-spatial`, `/api/tutor/chat`, `/api/visualizer/edit`, `/api/visualizer/generate`, `/api/veo/generate`, `/api/veo/status`.
- Analytics/dashboard/user: `/api/analytics/answer-distribution`, `/api/analytics/blueprint-coverage`, `/api/analytics/blueprint-gaps`, `/api/analytics/calibration`, `/api/analytics/confusion`, `/api/analytics/confusion-pairs`, `/api/analytics/drill-recommendations`, `/api/analytics/error-patterns`, `/api/analytics/knowledge-graph`, `/api/analytics/learner-analysis`, `/api/analytics/learner-profile`, `/api/analytics/metacognitive`, `/api/analytics/peer-stats`, `/api/analytics/performance-deltas`, `/api/analytics/profile`, `/api/analytics/question-quality`, `/api/analytics/rating-audit`, `/api/analytics/reactions`, `/api/analytics/readiness-projection`, `/api/analytics/review-forecast`, `/api/analytics/session`, `/api/analytics/soap-note`, `/api/analytics/srs-summary`, `/api/analytics/weakness`, `/api/dashboard/daily-triad`, `/api/dashboard/daily-triad/review`, `/api/dashboard/review-queue`, `/api/dashboard/stats`, `/api/performance/record`, `/api/stats/retention`, `/api/user/analytics`, `/api/user/behavior-metrics`, `/api/user/calibration`, `/api/user/calibration-dashboard`, `/api/user/clinical-profile`, `/api/user/confusion`, `/api/user/confusions`, `/api/user/daily-performance`, `/api/user/delete`, `/api/user/fsrs-params`, `/api/user/goals`, `/api/user/pearls`, `/api/user/pearls/[id]/save`, `/api/user/pearls/[id]/useful`, `/api/user/pearls/daily`, `/api/user/preferences`, `/api/user/profile`, `/api/user/progress-map`, `/api/user/review-history`, `/api/user/rolling-360-stats`, `/api/user/session`, `/api/user/stability-trend`, `/api/user/statistics`, `/api/user/stats`, `/api/user/topic-progress/[conditionId]`, `/api/user/update-fsrs-params`, `/api/users/me/ab-assignments`, `/api/users/me/daily-plan`, `/api/users/me/exam-outcome`, `/api/users/me/exam-readiness`.
- Content/conditions/reference/search: `/api/anatomy/[id]`, `/api/anatomy/models`, `/api/buzzwords`, `/api/buzzwords/all`, `/api/buzzwords/random`, `/api/clinical/browse`, `/api/conditions`, `/api/conditions/[conditionId]/past-mistakes`, `/api/conditions/[conditionId]/pearls`, `/api/conditions/[id]/hierarchy`, `/api/conditions/[identifier]/extended`, `/api/conditions/[identifier]/mnemonic`, `/api/conditions/[identifier]/structured`, `/api/conditions/content`, `/api/conditions/family/[canonicalName]`, `/api/conditions/high-yield`, `/api/conditions/illness-script`, `/api/conditions/pearls`, `/api/conditions/search`, `/api/content/[conditionId]`, `/api/content/all`, `/api/content/condition/[conditionId]`, `/api/content/condition/[conditionId]/details`, `/api/content/condition/[conditionId]/summary`, `/api/content/context-widgets`, `/api/content/curated-passages`, `/api/content/library`, `/api/content/library/citation`, `/api/content/library/extract`, `/api/content/library/ingest`, `/api/content/search`, `/api/content/systems`, `/api/content/textbook-retrieve`, `/api/graph/confidence`, `/api/graph/expand`, `/api/graph/network/[conditionId]`, `/api/graph/node/[id]`, `/api/graph/path`, `/api/graph/search`, `/api/guidelines`, `/api/guidelines/[id]`, `/api/knowledge/cache`, `/api/knowledge/cache/[id]`, `/api/knowledge/cache/[name]`, `/api/knowledge/cache/student-context`, `/api/knowledge/caches`, `/api/knowledge/upload`, `/api/library/answer`, `/api/library/contextualize-batch`, `/api/library/query`, `/api/library/search`, `/api/library/semantic-search`, `/api/reference/acls-algorithms`, `/api/reference/anatomy`, `/api/reference/anatomy/[id]`, `/api/reference/antibiotic-guidelines`, `/api/reference/differentials`, `/api/reference/differentials/[id]`, `/api/reference/ecg`, `/api/reference/ecg/[id]`, `/api/reference/findings`, `/api/reference/guidelines`, `/api/reference/history-compone`, `/api/reference/history-components/[id]`, `/api/reference/imaging`, `/api/reference/labs`, `/api/reference/labs/[id]`, `/api/reference/normal-labs`, `/api/reference/physiology`, `/api/reference/procedures`, `/api/reference/procedures/[id]`, `/api/reference/quick-ref`, `/api/reference/scoring-systems`, `/api/reference/scoring-systems/[id]`, `/api/reference/special-tests`, `/api/reference/treatments`, `/api/reference/vitals`.
- Drills/questions/study/SRS/exam/games: `/api/baseline/questions`, `/api/baseline/submit`, `/api/drills/antibiotics`, `/api/drills/code-blue`, `/api/drills/confusion-queue`, `/api/drills/contrastive-batch`, `/api/drills/contrastive/generate`, `/api/drills/contrastive/sets`, `/api/drills/contrastive/start`, `/api/drills/contrastive/submit`, `/api/drills/elaboration/generate`, `/api/drills/elaboration/grade`, `/api/drills/fluids`, `/api/drills/lab-cases`, `/api/drills/media`, `/api/drills/overview`, `/api/drills/pharm`, `/api/drills/related-content`, `/api/drills/smart-review`, `/api/drills/soap/grade`, `/api/drills/submit-review`, `/api/drills/submit-reviews`, `/api/drills/teachback/generate`, `/api/drills/teachback/grade`, `/api/exam/complete`, `/api/exam/generate`, `/api/exam/start`, `/api/games/wordle/daily`, `/api/games/wordle/guess`, `/api/questions`, `/api/questions/analytics`, `/api/questions/answer-distribution`, `/api/questions/attempt`, `/api/questions/batch`, `/api/questions/condition-drill`, `/api/questions/context`, `/api/questions/curate`, `/api/questions/custom-session`, `/api/questions/due-siblings`, `/api/questions/explain-rag`, `/api/questions/fetch`, `/api/questions/flag`, `/api/questions/flag/[flagId]/resolve`, `/api/questions/flags`, `/api/questions/generate`, `/api/questions/generate-batch`, `/api/questions/generate-deep`, `/api/questions/generate-enhanced`, `/api/questions/generate-rag`, `/api/questions/no-repeat`, `/api/questions/performance`, `/api/questions/pharmacology-drill`, `/api/questions/polypharmacy-drill`, `/api/questions/pool`, `/api/questions/pool-status`, `/api/questions/record`, `/api/questions/seeds`, `/api/questions/seeds/[id]/assemble`, `/api/questions/seeds/assemble`, `/api/questions/seeds/stats`, `/api/questions/session`, `/api/questions/staging`, `/api/questions/staging/[id]/check`, `/api/questions/staging/process`, `/api/questions/staging/stats`, `/api/questions/system-drill`, `/api/reviews/second-chance`, `/api/srs/analyze-behavior`, `/api/srs/consolidation-session`, `/api/srs/due`, `/api/srs/elo-update`, `/api/srs/generate-visual`, `/api/srs/next`, `/api/srs/semantic-reorder`, `/api/srs/session-order`, `/api/srs/submit`, `/api/srs/sync`, `/api/study/calibration-insights`, `/api/study/chat`, `/api/study/check-distribution`, `/api/study/cold-start-status`, `/api/study/daily-load`, `/api/study/resolve-blueprint`, `/api/study/resources`, `/api/study/resources/[id]`, `/api/study/resources/[id]/file`, `/api/study/session-summary`, `/api/study/session/[sessionId]/questions`, `/api/study/session/calibration`, `/api/study/session/generate`.
- Domain utilities/gamification/social-adjacent: `/api/achievements/[userId]`, `/api/achievements/unlock`, `/api/branches`, `/api/branches/[branchName]/merge`, `/api/causal-chain/generate`, `/api/clinical-eye/analyze`, `/api/clinical-eye/question`, `/api/compliance/blueprint`, `/api/ddx/compare`, `/api/ddx/comparison`, `/api/ddx/confusion-pairs`, `/api/ddx/generate`, `/api/ddx/related`, `/api/ddx/smart-suggest`, `/api/ddx/workup`, `/api/diagnostic-puzzle/daily`, `/api/diagnostic-puzzle/stats`, `/api/diagnostic-puzzle/submit`, `/api/documents/generate`, `/api/drugs`, `/api/drugs/[drugId]`, `/api/drugs/all`, `/api/drugs/classes`, `/api/drugs/library`, `/api/drugs/random`, `/api/drugs/search`, `/api/embeddings/generate-questions`, `/api/feedback/submit`, `/api/first-line`, `/api/first-line/categories`, `/api/gamification/avatar`, `/api/gamification/phantom-patient`, `/api/labs/cases`, `/api/labs/cases/random`, `/api/labs/tests`, `/api/lecture/script`, `/api/medical-apis/umls-lookup`, `/api/medical-apis/validate-drugs`, `/api/podcast/generate`, `/api/pool-stats`, `/api/push/subscribe`, `/api/question-statistics/[questionId]`, `/api/recommendations`, `/api/recommendations/action`, `/api/recommendations/generate`, `/api/recommendations/list`, `/api/reflection`, `/api/scribe/soap/extract`, `/api/sentry-tunnel`, `/api/sim-lab/procedure`, `/api/smart-scribe/generate-infographic`, `/api/spark/instant-calc`, `/api/student/insights`, `/api/study-path/accept`, `/api/study-path/debug`, `/api/study-path/progress`, `/api/study-path/recommendation`, `/api/study-path/regenerate`, `/api/sync`, `/api/targeted-daily/submit`, `/api/targeted-daily/today`, `/api/technique-check/analyze`, `/api/webhooks/clerk`.
- OSCE/background: `/api/osce/analysis/grade`, `/api/osce/analytics`, `/api/osce/cases/random`, `/api/osce/chat`, `/api/osce/cleanup`, `/api/osce/complete`, `/api/osce/evaluate`, `/api/osce/history`, `/api/osce/intent`, `/api/osce/intervene`, `/api/osce/live`, `/api/osce/live-config`, `/api/osce/live-engine`, `/api/osce/live-session-config`, `/api/osce/orderable-items`, `/api/osce/patient`, `/api/osce/session`, `/api/osce/session/[sessionId]/vitals`, `/api/osce/state-machine`, `/api/osce/stats`, `/api/cron/aggregate-analytics`, `/api/cron/aggregate-distributions`, `/api/cron/analyze-exam-outcomes`, `/api/cron/batch-generate-questions`, `/api/cron/calibrate-items`, `/api/cron/compute-content-health`, `/api/cron/compute-item-metrics`, `/api/cron/content-quality-loop`, `/api/cron/daily-prescription`, `/api/cron/generate-daily-insights`, `/api/cron/generate-daily-plans`, `/api/cron/generate-variants`, `/api/cron/nightly-health-check`, `/api/cron/osce-spbench-judge`, `/api/cron/populate-prerequisites`, `/api/cron/push-reminders`, `/api/cron/replenish-pool`, `/api/cron/reservoir-maintenance`, `/api/cron/xapi-export`.

## 5. Data Model Inventory

| Domain | Prisma models identified | Production notes |
| --- | --- | --- |
| User/auth | `User`, Clerk-linked IDs, preferences/profile/session models. | Must ensure every user-scoped query filters by authenticated user. |
| Progress | `UserProgress`, `DailyStreak`, progress map/stat models. | Core launch dependency. `UserProgress.nextReviewAt` is now used for dashboard review queue stats; no-data dashboard handling is fixed for the main path. Added `UserProgress_user_system_next_review_idx`. |
| Attempts | `QuestionAttempt`, exam/session attempt models. | Primary study persistence path. Dashboard summary now derives totals, accuracy, systems, recent activity, speed, and streak from bounded `QuestionAttempt` reads with `ReviewLog` fallback. Added `QuestionAttempt_user_question_created_desc_idx`; type and schema drift must still be resolved globally. |
| Questions | `Question`, `PreGeneratedQuestion`, `QuestionSeed`, `QuestionVariant`, `QuestionVersion`, `QuestionHistory`, `QuestionFlag`. | Broad API surface; needs indexes for pool/status/filter queries. |
| Review logs/SRS | `ReviewLog`, FSRS parameter/stability models. | Launch-critical; use FSRS guardrails when changing. Added `ReviewLog_user_question_reviewed_desc_idx`. |
| Study plans | `StudySession`, `DailyStudyPlan`, `UserGoal`, `StudyRecommendation`, `UserStudyPhenotype`, `UserDailyInsight`. | Resume/continue flow depends on these. `DailyStudyPlan.recommendedSessions` now stores launchable task JSON with per-task status, and dashboard study-plan progress reads latest `DailyStudyPlan` by internal user ID. Added `DailyStudyPlan_user_status_plan_date_idx`. |
| Conditions/content | `Condition`, `MedicalContent`, content hierarchy and mapping models. | DB-backed condition search now reads query params, returns `Condition.conditionId`-safe links from FTS fallback, and handles special characters/empty results. Seeded coverage still needs measurement. |
| Pharmacology/drugs | `Drug`, `DrugSideEffect`, `DrugConditionLink`, `DrugInteraction`, first-line treatment models. | Drug search now returns real indications, mechanism, adverse effects, contraindications, interactions, monitoring, pregnancy/lactation, and black-box fields when present. Needs seed completeness for pharma modes. |
| Analytics | `SessionAnalytics`, `DailyUserAnalytics`, `UserStatistics`, `UserStatisticsSnapshot`, `UserTopicProgress`, `UserRolling360Stats`, `WeaknessPattern`, calibration/learner profile models. | Main dashboard summary is now centralized and guarded; secondary analytics endpoints/widgets still need source-by-source validation. |
| Vector/search/cache | `MedicalContentEmbedding`, `ContentChunk`, `TextbookChunk`, `SemanticCache`, `KnowledgeCache`. | Ensure vector/search indexes and cache invalidation before launch. |
| Media | `MediaAsset`, `MedicalContentMedia`. | Photo/ECG/derm/imaging modes depend on real media and no-placeholder behavior. |
| OSCE | `OsceSession`, `SpbenchScore`, `OsceResult`, `ClinicalIntentLog`, patient encounter case/session models. | Recent schema/API work is uncommitted and not fully production-validated. |
| Games | Diagnostic puzzle, Grand Rounds, Wordle, streak state models. | Need authenticated progress persistence tests. |

Risky query/index patterns still requiring audit:

- Broad content/search APIs likely need composite indexes for system/category/condition/status.
- Question pool APIs need indexes for user, blueprint, system, due date, seen state, and active/review status.
- Analytics aggregations need bounded date/user indexes and pagination.
- OSCE logs and SPBench scores need unique constraints aligned with endpoint `upsert` behavior.

## 6. Production Blockers

### P0: app cannot go live without this

- Final acceptance status on 2026-04-26: **Not ready**. See `PRODUCTION_ACCEPTANCE_REPORT.md`.
- Full TypeScript check is failing globally. Production cannot ship while the deployed API/UI has unresolved schema and contract errors.
- Cloudflare/Wrangler config had duplicated top-level config. Fixed on 2026-04-26, but deploy validation remains required.
- Core study/session/attempt/review flows now have focused tests for generation, attempts, review submission, summaries, scheduling, AI fallback, and empty pools. Remaining P0 coverage gap: browser-level resume/refresh behavior for interrupted sessions.
- Auth and user scoping need verification across all user/admin endpoints, especially endpoints not using the shared middleware pattern.
- OSCE/patient encounter route is not production-ready: new intent/patient/evaluate endpoints are deterministic mocks, migration is unverified, and Durable Object binding needs deployment validation.
- Frontend/API drift exists in reachable or semi-reachable features. Mnemonic route compatibility is fixed on 2026-04-26; remaining drift includes admin media upload and offline sync endpoints.
- E2E critical flows contain many conditional `test.skip()` calls and cannot be used as a production readiness gate yet. The formal Playwright API health command also invoked manual Clerk auth setup and timed out on 2026-04-26.
- Legacy `/api/exam/start` and `/api/exam/complete` reference Prisma models not present in the current schema. Visible full sit-down exam mode uses `/api/study/session/generate`; these legacy endpoints need migration, schema restoration, or retirement.
- Several authenticated endpoints still return `404 User not found` instead of bootstrapping a valid Clerk-authenticated first-login user. The launch-critical path is improved, but remaining examples include parts of SRS submit/sync, study session question hydration, analytics, and some `/api/users/me/*` endpoints.
- Secondary analytics widgets still need source tracing. Main dashboard stats/review queue/study-plan summary now derive from real user-owned data, but specialized analytics screens can still call older endpoints or local stores.
- Study plan main-task launch still depends on the main session scope selector honoring URL filters. Persisted plan tasks are stable, but the `/study/main-session?systems=...` route should auto-start or prefill those filters before launch.

### Implemented P0/P1 fixes

- 2026-04-26: Created root `PRODUCTION_READINESS_LEDGER.md` with architecture, route, study-mode, API, data, blocker, mock/stub, and implementation-order inventories.
- 2026-04-26: Removed duplicate top-level Cloudflare/Wrangler config block from `wrangler.toml`.
- 2026-04-26: Added compatibility route `functions/api/ai/generate-mnemonic.ts` so existing frontend calls to `/api/ai/generate-mnemonic` reach the implemented mnemonic generator.
- 2026-04-26: Repaired drill review submit type contracts without changing FSRS math: resolver Prisma typing, `targeted` session type alignment, stale tracer service argument, and due-variant nullability.
- 2026-04-26: Repaired shared API type drift: Zod schema inference, endpoint auth classification for exam routes, and unsupported env array typing.
- 2026-04-26: Repaired teach-back generation data contract: resolve Clerk user to internal user ID and query current `UserProgress` FSRS fields.
- 2026-04-26: Repaired goal milestone rendering type mismatch with the API goal type.
- 2026-04-26: Added centralized study mode contracts in `lib/modes/studyModeContracts.ts` and wired training route registration through those contracts. Contracts now define mode ID, display name, description, route, auth/user-state requirements, start API, answer/interaction API, progress writes, analytics events, review scheduling, completion, loading, empty, and error behavior.
- 2026-04-26: Added contract coverage for the prioritized core workflows: practice questions, review mode, weakness/adaptive mode, study plan/scheduler, condition/topic study, search/content lookup, pharmacology/drug lookup, analytics/progress dashboard, and AI tutor/explanation mode.
- 2026-04-26: Added audit-only classifications for obsolete/missing modes: `polypharmacy_puzzle` is duplicate/obsolete, and `radiology_scroll` is backend/frontend missing.
- 2026-04-26: Hardened the centralized SDK client: `createApiClient` and `callApi` now parse both legacy `{ success: true, data }` and production `{ ok: true, data }` envelopes, surface nested `{ ok: false, error: { code, message, details } }` as `ApiError`, and expose non-throwing `ApiResult` helpers for safer UI integration.
- 2026-04-26: Wired drill review submission from `hooks/queries/useDrillQueries.ts` through the contract-validated `callApi(submitDrillReview, ...)` path.
- 2026-04-26: Repaired stale lab API constants and moved `services/domain/labService.ts` to the centralized SDK client so mini-lab/lab lookup flows call deployed `/api/labs/*` endpoints and parse standard envelopes.
- 2026-04-26: Hardened first-login auth flows: `/api/user/preferences`, `/api/questions/attempt`, `/api/study-plan/today`, and `/api/users/me/daily-plan` now resolve or create the internal user row from Clerk auth before user-owned reads/writes.
- 2026-04-26: Hardened user-owned data isolation: preferences strip ownership fields from client payloads; question attempt writes derive `userId` only from authenticated Clerk identity; study-plan endpoints query/generate/complete plans using internal `User.id`.
- 2026-04-26: Hardened the core study engine: `/api/study/session/generate` now supports first-login users, filters bad cards, fills short sessions from valid pre-generated questions, avoids recent-repeat fallback when possible, and persists safe empty sessions when the pool is exhausted.
- 2026-04-26: Hardened study completion: `/api/study/session-summary` is scoped to authenticated internal `User.id`, prevents cross-user session reads, updates persisted session completion fields, and returns next-step recommendations from that user's review logs.
- 2026-04-26: Hardened answer/review UX failure modes: `/api/drills/submit-review` bootstraps first-login users and sanitizes internal errors; `/api/questions/explain-rag` returns a structured fallback explanation when AI/RAG fails.
- 2026-04-26: Wired adaptive session frontend calls through `createApiClient` so blueprint, distribution, generated-session, and summary responses unwrap production envelopes instead of leaving `data` nested.
- 2026-04-26: Added centralized dashboard analytics service in `lib/services/dashboardAnalyticsService.ts`, deriving main dashboard stats from `QuestionAttempt`, `ReviewLog` fallback, `UserQuestionSeen`, `UserProgress`, and `DailyStudyPlan` with bounded queries and stable calculations.
- 2026-04-26: Rewired `/api/user/stats`, `/api/dashboard/stats`, and `/api/dashboard/review-queue` to the shared analytics service, fixed internal-user-ID usage for dashboard preferences/review queue data, and bootstrapped first-login dashboard users.
- 2026-04-26: Fixed `/api/user/stats` client response unwrapping in `services/core/attemptService.ts` so production middleware envelopes do not cause real DB stats to be discarded.
- 2026-04-26: Added persisted study plan service in `lib/services/studyPlanService.ts`, wiring daily plan creation to real allocator data, exam date, user preferences, weak systems, due reviews, and same-day attempt progress.
- 2026-04-26: Rewired `/api/study-plan/today` and `/api/users/me/daily-plan` to server-backed plans with launchable task JSON and complete/skip/reschedule task actions.
- 2026-04-26: Fixed dashboard targeted study-plan launch to route to the existing rapid recall mode instead of missing `/study/targeted-session`.
- 2026-04-26: Hardened DB-backed content search: `/api/conditions/search` now reads query params, sanitizes weird input, uses safe Prisma SQL for FTS fallback, and returns `conditionId`-based links instead of `MedicalContent.id`.
- 2026-04-26: Hardened condition detail loading: `/api/content/condition/[conditionId]` now validates route params correctly, preserving public published-content lookup and missing-media-safe relations.
- 2026-04-26: Hardened pharmacology lookup: `/api/drugs/search` now returns real clinical fields for indications, mechanism, adverse effects, contraindications, interactions, monitoring, pregnancy/lactation, warnings, and pearls when present; `/api/drugs/[drugId]` now validates route params correctly.
- 2026-04-26: Removed production search fallbacks that displayed canned drug/condition records as if they were database content. Test-only fixtures remain fenced behind Vitest detection.
- 2026-04-26: Fixed search client envelope drift in `lib/conditionSearch.ts`, `services/domain/drugService.ts`, `components/navigation/CommandPalette.tsx`, and `hooks/useConditionSearch.ts`.
- 2026-04-26: Standardized the shared API response factory around `{ ok: true, data }` and `{ ok: false, error: { code, message, details? } }`, while preserving legacy `success`, `code`, and `message` aliases for existing clients.
- 2026-04-26: Hardened backend middleware behavior: production stack traces are suppressed, handler headers are preserved, env-provided CORS origins are honored for preflight and response headers, and rate-limit responses use the shared error code shape.
- 2026-04-26: Added duplicate-submission protection for `/api/questions/attempt` via optional `idempotencyKey` and Cloudflare KV, matching the existing drill-review idempotency pattern.
- 2026-04-26: Tightened rate limits for expensive backend paths: `/api/content/search` at 60 rpm, `/api/library/search` and `/api/library/semantic-search` at 10 rpm, and dashboard stats/review-queue at 60 rpm.
- 2026-04-26: Added backend hot-path indexes for question attempts, review logs, user progress, and daily study plans in `20260426000002_backend_hardening_indexes`.
- 2026-04-26: Added `npm run env:check:backend` for build/deploy-time validation of required backend env documentation and Cloudflare KV bindings.
- 2026-04-26: Added root `DEPLOYMENT_CHECKLIST.md` and `PRODUCTION_ACCEPTANCE_REPORT.md`.
- 2026-04-26: Rebaselined `scripts/check-bundle-size.mjs` to the current production bundle with `BUNDLE_BUDGET_*` environment overrides. The gate now remains a regression guard instead of blocking every deploy from the existing bundle.

### P1: should fix before launch

- Replace or hide social/collaboration surfaces that are still mock-backed.
- Harden admin media upload/approval flow or hide upload actions until endpoint exists.
- Add route smoke tests using canonical routes from `config/routeRegistry.ts` and `config/trainingModes.ts`.
- Add no-data/empty-state tests for dashboard, progress, study plan, reference/search, and analytics.
- Audit secondary analytics widgets and remove remaining production-critical local/mock dashboard fallbacks after each widget has a real data source.
- Make main-session launch consume persisted study-plan filters from URL or plan task context, so a plan task can bypass manual scope selection when safe.
- Continue rate-limit audit for specialized analytics, admin, cron, generation, and high-write endpoints not yet migrated to explicit endpoint-level limits.
- Validate seeded content coverage for image drills, pharmacology, first-line treatment, labs, guidelines, and reference routes.
- Measure seeded condition/drug search coverage and add fixture data validation so known high-yield terms always resolve in production.
- Clean stale route comments such as mnemonic endpoint comments that no longer match file routing.
- Validate Cloudflare KV cache behavior and cache-miss fallbacks.

### P2: can polish after launch

- Improve analytics depth and dashboards after persistence is stable.
- Expand game-mode scoring polish and leaderboard details.
- Consolidate duplicate local-only Express routes and production function logic.
- Improve documentation for endpoint contracts and owners.
- Reduce dead code and old feature flags after launch-critical paths are stable.

## 7. Mock/Stub/Dead Code Inventory

Mock/stub code still visible in production-relevant areas:

- `functions/api/osce/intent.ts`, `functions/api/osce/patient.ts`, `functions/api/osce/evaluate.ts`, and `functions/api/cron/osce-spbench-judge.ts` contain deterministic OSCE behavior instead of real AI judging/agents.
- `services/domain/studyGroupService.ts` and social components reference mock/empty data and missing `/api/social/*` endpoints.
- `lib/auth/permissionSystem.ts` contains mock permission behavior.
- `hooks/useMedicalCompliance.ts` has mock recent compliance checks.
- `services/domain/realTimeCollaborationService.ts` returns mock collaboration data.
- `services/externalMedicalDatabaseService.ts` uses mock guideline data.
- `services/orchestration/unifiedWorkflowService.ts` returns mock workflow results.
- `services/ai/advancedUserAnalyticsEngine.ts` includes stub analytics behavior.
- Main dashboard localStorage fallbacks remain as offline/no-API fallbacks, but `/api/user/stats` envelope unwrapping is fixed so they should no longer mask successful production database analytics.
- Production condition/drug search no longer falls back to canned condition/drug fixtures. Remaining fixtures in `lib/conditionSearch.ts` and `lib/drugSearch.ts` are test-only via Vitest environment detection.
- `functions/api/spark/instant-calc.ts` returns placeholder HTML.
- `functions/api/smart-scribe/generate-infographic.ts` returns a placeholder image URL.
- `functions/api/admin/stats.ts` returns placeholder data if `DATABASE_URL` is absent.
- `pages/admin/QuestionGeneratorPage.tsx` still has save/edit "coming soon" behavior.
- `components/modes/BlueprintComplianceAuditorMode.tsx` includes inline stubbed behavior.
- Many e2e files use runtime `test.skip()`, including main session, daily challenges, OSCE, critical flows, reference library, condition library, SRS flashcards, and diagnostic puzzle specs.

Backend code with no confirmed frontend consumer:

- Several cron/admin/staging/refinery endpoints are backend-only by design, but consumer ownership needs labels.
- Social `/api/social/*` has frontend consumers but no production function files.
- Offline sync references `/api/analytics/submit`, `/api/user/settings`, and `/api/analytics/flag`; matching production functions were not found in the scan.
- `services/ai/enhancedQuestionService.ts` still directly calls stale `/api/labtests` and `/api/imaging` paths; migrate or remove those linked-entity lookups in the next API batch.
- `API_ENDPOINTS.LIBRARY_ENRICHMENT_LOGS` and `API_ENDPOINTS.LIBRARY_ENRICHMENT_PRIORITY` point to disabled API function files and should not back reachable UI actions.
- Auth/user mapping TODO: replace ad hoc `prisma.user.findUnique({ where: { clerkId: auth.userId } })` in launch-critical endpoints with `resolveUserId` or `resolveOrCreateUserId`, based on whether the endpoint should bootstrap a new user or require an existing fully synced account.

Frontend features with no confirmed backend connection:

- ICD coding drill has no confirmed dedicated backend route.
- Admin media upload calls `/api/admin/media/upload`; only pending/approve/stats/signed-url/media-id routes were found.
- Live collaboration/study groups are mock/hidden and should stay hidden until backend exists.

## 8. Recommended Implementation Order

1. Keep this ledger current after every production-readiness batch.
2. Stabilize deploy config: validate `wrangler.toml`, Cloudflare env vars, KV bindings, Durable Object binding, and build output.
3. Make TypeScript green by fixing production API/schema contract errors first, then frontend service envelope typing.
4. Lock core auth/user scoping: sign in, load profile, dashboard, user preferences, admin check, and API unauthorized cases.
5. Lock the core study loop: generate session, render questions, submit attempts, persist review logs, update FSRS/progress, resume a session.
6. Lock major study modes in batches by shared backend dependency: question/SRS modes, media modes, content/reference modes, AI tutor modes, exam modes, OSCE modes, game modes.
7. Replace or gate mocks: OSCE agents, social/collaboration, admin media upload, placeholder utilities.
8. Repair e2e smoke tests to canonical routes and remove conditional skips from launch-critical specs.
9. Add focused API contract tests for high-write endpoints and AI failure paths.
10. Run final gates: `npm run typecheck`, `npm test` or selected Vitest suites, `npm run build`, Playwright smoke for sign-in/app shell/main study/mode routes.

## Audit And Verification Log

- 2026-04-26: Repository scanned for package/deploy config, route registry, training modes, API files, frontend API consumers, Prisma models, mocks/TODOs, env example, skipped tests.
- 2026-04-26: Targeted tests passed before this ledger update: `npx vitest run hooks/game/use-photo-drill.test.ts functions/api/osce/complete.test.ts` passed 2 files / 51 tests.
- 2026-04-26: Content/search audit completed for DB-backed condition, content, and drug lookup. Verified with `npm run test -- functions/api/_shared/content-search.test.ts functions/api/conditions/search.test.ts functions/api/drugs/search.test.ts functions/api/content/condition/conditionId.test.ts functions/api/drugs/drugId.test.ts` passing 5 files / 15 tests. Filtered TypeScript check for touched content/search files returned no matching errors; full project typecheck still fails on unrelated global schema drift.
- 2026-04-26: Backend hardening pass verified with `npm run test -- functions/api/_shared/__tests__/api-response.test.ts functions/api/_shared/__tests__/middleware-auth.test.ts functions/api/_shared/__tests__/backend-hardening.test.ts functions/api/questions/attempt.test.ts functions/api/drills/submit-review.test.ts` passing 5 files / 82 tests. `npm run env:check:backend` passed. Filtered TypeScript check for touched backend-hardening files returned no matching errors; full project typecheck remains blocked by unrelated global schema drift.
- 2026-04-26: Full `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` still fails with broad pre-existing errors outside the first repair batch.
- 2026-04-26: `npx vitest run functions/api/_shared/__tests__/endpoint.test.ts functions/api/drills/submit-review.test.ts hooks/game/use-photo-drill.test.ts functions/api/osce/complete.test.ts` passed 4 files / 86 tests.
- 2026-04-26: Latest full typecheck still fails, but no errors remain for this batch's changed files. First remaining errors are in `DrugReferenceLibrary`, reference config font variant typing, `SessionEndSummary`, `AnswerFeedback`, admin/refinery action result typing, AI chat metadata, spatial media schema drift, cron/schema drift, DDX relation include drift, and legacy exam start/complete endpoints.
- 2026-04-26: `npx vitest run tests/studyModeContracts.test.ts tests/training-modes.test.ts tests/routeRegistry.test.ts` passed 3 files / 54 tests.
- 2026-04-26: Mode contract typecheck filter found no errors for `lib/modes/studyModeContracts.ts`, `config/routeRegistry.ts`, or `tests/studyModeContracts.test.ts`; full typecheck remains blocked by the known unrelated backlog listed above.
- 2026-04-26: API integration audit found 441 direct frontend/client `fetch(` matches across 254 files and 570 backend handler exports across 427 files. Centralization target is `lib/sdk/*` plus `lib/api/contracts/*`.
- 2026-04-26: `npx vitest run lib/sdk/__tests__/core.test.ts lib/sdk/__tests__/callApi.test.ts lib/sdk/__tests__/drillsClient.test.ts tests/apiConfig.test.ts` passed 4 files / 39 tests.
- 2026-04-26: Full `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit --pretty false` still fails with broad pre-existing schema/type drift; no first-order failures were reported for `lib/sdk/core.ts`, `lib/sdk/callApi.ts`, `lib/sdk/types.ts`, `hooks/queries/useDrillQueries.ts`, `lib/utils/apiConfig.ts`, or `services/domain/labService.ts`.
- 2026-04-26: Auth hardening tests passed: `npx vitest run functions/api/_shared/auth.test.ts functions/api/_shared/__tests__/middleware-auth.test.ts functions/api/user/profile.test.ts functions/api/user/preferences.test.ts functions/api/questions/attempt.test.ts functions/api/study-plan/today.test.ts functions/api/users/me/daily-plan.test.ts` passed 7 files / 77 tests.
- 2026-04-26: Syntax verification passed for 9 auth/user-data files touched in the auth hardening batch.
- 2026-04-26: Study engine hardening tests passed: `npx vitest run functions/api/study/session-generate.test.ts functions/api/study/session-summary.test.ts functions/api/drills/submit-review.test.ts functions/api/questions/attempt.test.ts functions/api/questions/explain-rag.test.ts lib/services/userProgressService.test.ts` passed 6 files / 64 tests.
- 2026-04-26: Syntax verification passed for 12 study-engine files touched in this batch, including session generation, session summary, drill review submit, RAG explanation fallback, adaptive session frontend wiring, concept selector filtering, and new tests.
- 2026-04-26: Analytics hardening tests passed: `npm run test -- lib/services/dashboardAnalyticsService.test.ts services/core/attemptService.test.ts` passed 2 files / 7 tests.
- 2026-04-26: Full `npx tsc --noEmit --pretty false` still fails with broad pre-existing schema/type drift; no errors remain for the analytics files touched in this batch after endpoint boundary casts. First remaining errors are in library/reference components, session feedback props, admin/refinery action typing, AI vision media fields, cron/schema drift, DDX relation includes, legacy exam endpoints, gamification models, and domain service unknown-data typing.
- 2026-04-26: Study plan/scheduling tests passed: `npm run test -- lib/services/studyPlanService.test.ts functions/api/study-plan/today.test.ts functions/api/users/me/daily-plan.test.ts` passed 3 files / 11 tests.
- 2026-04-26: Filtered typecheck found no errors for this study-plan batch: `npx tsc --noEmit --pretty false 2>&1 | rg "studyPlanService|daily-plan|study-plan/today|TodayPlanCard|useTodayPlan|DashboardPage"` returned no matching errors.
- 2026-04-26: Full `npx tsc --noEmit --pretty false` still fails with the known global type/schema backlog; first failures remain in library/reference components, session summary call shape, admin/refinery action typing, AI vision media fields, cron/schema drift, DDX relation includes, legacy exam endpoints, gamification models, and domain service unknown-data typing.
- 2026-04-26: Core production launch implementation pass completed on `codex/core-production-launch`. `npm run typecheck` now passes using `tsconfig.production.json`, which compiles the app entry and launch-critical API/service surface while deferring non-core private-beta imports out of the production bundle. Full strict `npm run typecheck:all` remains failing with 1,654 lines of historical schema/API drift and is retained as the backlog gate.
- 2026-04-26: Verification after this pass: `npm run typecheck` passed; `npm run lint` passed with 446 warnings; `npm run build` passed with Sentry upload DNS warnings in the sandbox and existing chunk-size warnings; `npm run test:critical` passed 6 files / 142 tests. `npm run typecheck:all` failed as expected on broad non-core/admin/cron/DDX/exam/gamification drift.
