# APP FUNCTIONALITY PLAN

Last updated: 2026-05-17

## 1. Current Understanding Of The App

StudyPANaCEa is a React 19 + TypeScript + Vite PANCE/PANRE prep platform. The product surface is a premium medical learning command center with:

- public landing flow at `/`
- Clerk-protected study workspace under `/study`, `/practice`, `/progress`, and related routes
- adaptive question sessions through `components/session/CoreAdaptiveSession.tsx`
- production API handlers in `functions/api`
- legacy local Express API in `server.ts` and `routes`
- Prisma/Postgres data model under `prisma`
- Vitest unit/integration tests and Playwright smoke/E2E tests
- Cloudflare Pages production target with Pages Functions

The repo is in a dirty working tree with many modified and untracked files. Treat existing changes as user work unless this file explicitly marks a change as Codex-made.

## 2. Definition Of Functional For This Repo

Functional means:

- dependencies can be installed with npm using the checked-in lockfile
- setup instructions point to real files and real docs
- Prisma schema validates
- TypeScript checks pass
- production build completes
- Vite dev server can render the public and protected route shells
- Cloudflare Pages dev server can serve built direct routes and public API health
- the core authenticated study flow works, or the remaining blocker is clearly identified
- future Codex sessions have a durable plan and repo-specific workflow

## 3. Core User Flows

- Public visitor: `/` -> landing page -> Clerk sign-in/sign-up entry.
- Setup missing: missing `VITE_CLERK_PUBLISHABLE_KEY` -> `SetupRequiredPage`.
- Protected unauthenticated route: `/study` -> protected auth gate.
- Authenticated learner: `/study` -> command center -> start adaptive session.
- Practice launcher: `/practice` -> visible beta modes -> `core_adaptive`, `system_drill`, or `condition_drill`.
- Core adaptive session:
  - `CoreAdaptiveSession` resolves blueprint with `GET /api/study/resolve-blueprint`.
  - checks distribution with `POST /api/study/check-distribution`.
  - generates questions with `POST /api/study/session/generate`.
  - renders `QuizView`.
  - answer persistence goes through sync/review pipeline and `/api/drills/submit-review`.
- Progress: `/progress` -> progress dashboard guarded by auth.

## 4. Known Blockers And Risks

| Classification | Priority | Status | Issue | Evidence | Next Action |
| --- | --- | --- | --- | --- | --- |
| Auth/security issue | MUST FIX | Open | Full authenticated adaptive session is blocked by Clerk E2E auth setup. | Local production build with the test Clerk key reached Clerk sign-in, but the available test user previously returned `needs_second_factor`; current `.env` has no `E2E_CLERK_TEST_EMAIL` / `E2E_CLERK_TEST_PASSWORD`. Session generation/submission contracts pass in tests, and `.env.example` / README now document the required safe E2E variables. | Configure a safe E2E Clerk test user/session without second factor, set `E2E_CLERK_TEST_EMAIL` and `E2E_CLERK_TEST_PASSWORD`, then rerun authenticated production smoke. |
| Build/setup blocker | MUST FIX | Closed | `npm run dev:wrangler` was broken with the installed Wrangler command shape. | Previous script mixed a Pages build output directory with a proxy command, and Wrangler rejected it with "Specify either a directory OR a proxy command, not both." | Fixed `dev:wrangler` to run the existing `pages:dev` build-and-serve flow; `BASE_URL=http://localhost:8788 npm run verify:health` passes against it. |
| Configuration issue | MUST FIX | Closed | Local Express API could not connect to the configured direct Postgres URL because TLS certificate verification rejected the managed/self-signed chain. | `DIRECT_DATABASE_URL` uses `sslmode=require`; `pg-connection-string` currently treats that like `verify-full` unless `uselibpqcompat=true` is set. | Fixed for local/test PG-adapter connections; `/health`, `/api/content/all`, and `/api/drugs/all` now return healthy/200 through Express. |
| Configuration issue | SHOULD FIX | Documented | Production build on localhost gets Clerk 400s when built with the live custom-domain Clerk key from `wrangler.toml`. | `http://localhost:8788/study` renders the auth gate, but live-key/custom-domain Clerk endpoints return 400 locally. Rebuilding with the test key from `.env` avoids the custom-domain 400 and reaches sign-in. | Use a local/test Clerk publishable key for local auth smoke; keep live/custom-domain key behavior documented as a production-parity limitation on localhost. |
| Developer workflow gap | SHOULD FIX | Closed | Vite-only local API proxy targets legacy Express, which does not mount maintained `/api/study/*` Pages Functions. | `routes/index.ts` has no `/api/study` registration; Wrangler `/api/study/resolve-blueprint` routes and returns 401 unauthenticated. | README now says maintained `/api/study/*` routes require Wrangler/Pages Functions for production-parity testing. |
| Developer workflow gap | SHOULD FIX | Closed | Production-smoke docs said E2E credentials could live in `.env`, but the script did not load `.env`. | `test:e2e:production-smoke` previously called `playwright test ...` directly; Node does not load `.env` by default. | Script now invokes Playwright through `node --env-file-if-exists=.env ... test`; public production-smoke tests pass and the authenticated test skips without credentials. |
| Developer workflow gap | SHOULD FIX | Closed | Saved-auth Playwright setup was manual-only and duplicated Clerk sign-in logic. | `e2e/auth.setup.ts` only waited for manual login using stale UI text selectors, while production smoke used a separate programmatic Clerk sign-in path. | Added shared `e2e/helpers/clerkAuth.ts`; `auth.setup.ts` now signs in with `E2E_CLERK_TEST_EMAIL` / `E2E_CLERK_TEST_PASSWORD` when present, falls back to manual login, and `npm run test:auth` loads `.env`. |
| UX/runtime warning | SHOULD FIX | Closed | Landing route emitted a non-blocking Motion container-position warning in dev. | Dev Playwright smoke captured: "Please ensure that the container has a non-static position..." from the landing scroll story. | Replaced the landing scroll-story `useScroll({ target })` usage with a viewport-scroll motion value; dev smoke now has only the expected Clerk dev-key warning. |
| Refactor/maintainability issue | SHOULD FIX | Open | Build emits large-chunk warnings, although bundle budget passes. | `npm run build` warns for chunks over 700 kB; `npm run build:check-size` passes with total JS 6824.4 kB / 8200 kB and largest chunk 715.5 kB / 1250 kB. | Keep lazy-loading 3D/anatomy chunks and revisit only if budget fails or performance smoke regresses. |
| Developer workflow gap | SHOULD FIX | Closed | The local `node_modules` tree became unrecoverable during dependency verification in this shell. | After `tests/express-sync.test.ts` passed once, a combined Vitest run failed because Vite could not resolve `picomatch`; subsequent install repair attempts hit competing npm/rm processes, missing `.bin` links, npm cache/tar extraction errors, and incomplete package contents. | Repaired by stopping stale install/delete interference, syncing `package-lock.json` with the current `package.json`, reinstalling with a fresh npm cache, regenerating Prisma client types, and rerunning dry-run install, audit, typecheck, CI typecheck, lint, full Vitest, critical tests, production build, and bundle-size checks successfully. |
| Testing gap | SHOULD FIX | Closed | Memory/RAG context sanitizer mutation reporting did not flag replaced control characters when string length stayed the same. | Focused sanitizer regression coverage exposed that unsafe control bytes were replaced, but `mutated` stayed false because the prior implementation compared only output length. | Fixed `sanitizeRetrievedContextText` to compare against the original text and added regression coverage for unsafe control-byte replacement. |
| Auth/security issue | SHOULD FIX | Closed | Dependency install previously reported npm audit vulnerabilities. | Stale `node_modules` and an out-of-sync lockfile exposed advisories for Babel SystemJS, `fast-uri`, Hono, LangSmith, and extraneous Next/Geist. `package.json` now removes unused `geist`, bumps `langsmith`, and pins patched transitive versions for Babel SystemJS, `fast-uri`, and Hono; `npm audit --json` reports 0 vulnerabilities and `npm ls` confirms no `next`/`geist` path. | Keep the overrides until upstream packages naturally resolve to patched versions; rerun `npm audit --json` after dependency changes. |
| Developer workflow gap | SHOULD FIX | Closed | Multi-chat staged work included stale audit docs and unused experimental visual dependencies. | `rg` found no runtime imports for GSAP, React Three Fiber, or drei; stale `docs/repo-audit/*` files contradicted the current implementation with `SAFE-OVERRIDE` and outdated no-launch claims. | Removed `gsap`, `@react-three/fiber`, and `@react-three/drei`; retained `motion`, `three`, and `@tanstack/react-table`; deleted the stale repo-audit bundle and updated active docs to describe the current raw-Three viewer. |
| TypeScript/build issue | SHOULD FIX | Closed | Production typecheck failed on a readonly Prisma nested `orderBy` array in `lib/services/conceptQuestionSelector.ts`. | `npm run typecheck` reported `QuestionAnswerChoice.orderBy` was readonly and not assignable to Prisma's mutable order-by input. | Fixed `QUESTION_SELECT` to use `Prisma.QuestionSelect`; production typecheck now exits 0. |
| Testing gap | SHOULD FIX | Closed | `/api/user/review-history` needed regression coverage for the canonical ReviewLog contract. | The endpoint now returns ReviewLog events with QuestionAttempt-compatible export fields, but no endpoint test pinned the source table, filters, or legacy aliases. | Added `functions/api/user/review-history.test.ts`; targeted Vitest passes. |
| Testing gap | SHOULD FIX | Closed | Study-plan regeneration needed regression coverage for new review data. | `ensureStudyPlanWindow` checks the latest real `ReviewLog` and regenerates stale pending daily plans while preserving learner-acted rows, but tests did not pin this contract. | Added stale-plan coverage in `functions/api/_shared/studyPlanService.test.ts`; targeted Vitest and production typecheck pass. |
| Data integrity issue | SHOULD FIX | Closed | SRS due-card launch responses needed normalized question identity metadata. | `/api/srs/due` and `/api/srs/next` served due `Card` rows with legacy question IDs, while the answer pipeline now preserves `questionIdentityId`, `sourceQuestionId`, and `questionSource`. | Added identity fields to SRS due/next responses and pinned them in endpoint tests; targeted Vitest, production typecheck, and critical FSRS tests pass. |
| Data integrity issue | SHOULD FIX | Closed | Approved generated-question promotion populated legacy `Question.options` / `Question.explanation` JSON but did not consistently populate normalized answer/explanation tables. | `upsertCanonicalQuestionMirror` and `createCanonicalQuestionMirrors` are shared approval/mirror boundaries for admin review, auto-approval, staging promotion, and bulk pre-generated mirrors; `selectSessionQuestions` now prefers `QuestionAnswerChoice` and `QuestionExplanation` when present. | Added normalized relation sync at the canonical mirror boundary for both single upsert and bulk create paths, with a guard so duplicate answer text only marks the resolved keyed normalized choice correct; focused canonical mirror, admin-review, staging-promotion, lint, format, diff, and production typecheck verification pass. |
| Poor UX | SHOULD FIX | Closed | Guided post-answer scaffolding accepted learner context but did not adapt the generated explanation to it. | `GuidedFeedbackScaffold` passed `guidanceLevel`, `learnerReflection`, and `hintsViewed` props, but `buildScaffoldedExplanation` only used the question and selected answer. | The explanation scaffold now adapts chunk framing, repair language, and knowledge checks to support level, first-clue reflection, and hint usage; focused scaffold tests, lint, format, and production typecheck pass. |
| Poor UX | SHOULD FIX | Closed | Several active learning/admin surfaces still used literal `"Loading..."` text, content-spinner patterns, or layout-level conditional loading branches instead of structured loading affordances. | `npm run audit:loading` reported 7 `"Loading..."` entries across `CoreAdaptiveSession`, `QuestionReviewQueue`, `GrandRoundsMode`, and `DailyChallengesHub`; it also counted benign refresh/canonical spinner implementation details as content spinners and flagged 13 conditional loading branches. | Replaced the core session placeholder label, review queue text-only state, Grand Rounds leaderboard/review labels, Daily Challenges status copy, protected-route auth gate spinner, and layout-level loaders for goals, DDx matrix, external medical search, flag feedback, and OSCE order catalog. Tightened the audit to ignore canonical primitives, refresh-icon animations, browser `spin-button` CSS, and structured loading branches. `npm run audit:loading` now reports 0 `"Loading..."` entries, 0 content-spinner patterns, and 0 conditional-loading review candidates. |
| Data/API issue | SHOULD FIX | Closed | Core offline/sync replay parsed internal API JSON manually instead of using shared API envelope helpers. | `node scripts/audit-api-envelope-callers.mjs --fail-on-findings` flagged `lib/services/sync/syncManager.ts` and `lib/services/offlineSyncService.ts`; these drain offline answers/reviews into `/api/questions/attempt`, `/api/drills/submit-reviews`, and legacy queued-operation endpoints. | Added `unwrapApiEnvelope` / `getApiEnvelopeError` handling for attempt IDs, batch review results, sync error payloads, and conflict payloads; added a conflict-envelope regression test. The audit no longer lists the core sync files, though lower-priority UI/admin/toolkit callers remain. |
| Developer workflow gap | SHOULD FIX | Closed | `AGENTS.md` is untracked and local skill docs had stale text saying no `AGENTS.md` exists. | `AGENTS.md` exists in the working tree; `.agents/skills/panacea-navigator/SKILL.md` said the repo did not currently have one. | Fixed `panacea-navigator` to point at `AGENTS.md`; removed empty placeholder skill directories; skill audit passes. |
| Testing gap | SHOULD FIX | Open | `/practice` private-beta mode discoverability has test coverage, but route-level browser smoke is still blocked by auth. | `tests/privateBetaVisibility.test.ts` and `tests/training-modes.test.ts` pass; `/practice` is wrapped in `AuthenticatedRoute`, so browser verification needs the same non-2FA Clerk test session as the core flow. | Run `/practice` browser smoke after the Clerk E2E auth blocker is resolved. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Duplicate Daily Triad client services disagreed on the production API envelope. | `components/dashboard/DailyTriad.tsx` imports `@/services/domain`, while `functions/api/dashboard/daily-triad.ts` returns `{ success, data }`; the domain service previously parsed a raw object and the core service had a separate partial parser. | Domain Daily Triad service is now canonical and unwraps the shared API envelope; the core service re-exports it for compatibility. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Question pool monitor refill decisions were split between staging and learner-serving pools. | `services/ai/batchGeneratorService.ts` writes `PreGeneratedQuestion`, while `services/ai/poolMonitorService.ts` counted `stagingQuestion`. | AI pool monitor now delegates to the core `PreGeneratedQuestion` monitor so thresholds inspect the same pool that batch generation refills. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Dead post-answer explanation panel duplicated the active rationale component. | Active answer feedback imports `components/questions/ExplanationPanel.tsx`; `rg` found no code consumers of `components/panels/ExplanationPanel.tsx` beyond its stale barrel export. | Deleted the old panel copy, removed the barrel export, and updated the stale ClinicalTrials reference. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Topic mastery had two client implementations for the same topic-progress API. | `ConditionDetailPanel` imported `components/dashboard/TopicMasteryBreakdown.tsx`, while `components/analytics/TopicMasteryBreakdown.tsx` had the richer React Query/token/envelope implementation for the same `/api/user/topic-progress/:conditionId` endpoint. | The analytics implementation is canonical; the dashboard file is now a compatibility re-export so existing imports use one implementation. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Legacy UI skeleton shim duplicated the canonical loading/skeleton surface. | Active source imports skeletons and spinners from `@/components/loading`; `rg` found `components/ui/SkeletonLoader` only in historical docs and the shim itself. | Deleted `components/ui/SkeletonLoader.tsx`; keep `components/loading/index.tsx` as the single active loading/skeleton entrypoint. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Legacy generic landing page duplicated the current Diagnostic Atlas landing implementation. | `App.tsx` imports `components/landing/LandingPage.tsx`; source search found no active consumers of `pages/LandingPage.tsx`. | Deleted `pages/LandingPage.tsx`; keep `components/landing/LandingPage.tsx` as the canonical public landing page. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Legacy UI section header duplicated the StudyPanacea design-system section header. | Active source imports `SectionHeader` from `@/components/studypanacea`; source search found no active importers for `components/ui/SectionHeader.tsx`. | Deleted `components/ui/SectionHeader.tsx`; keep `components/studypanacea/SectionHeader.tsx` as the product-specific section header. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Generic UI smart image duplicated the active attributed medical image component. | `components/library/SmartConditionView.tsx` imports the library `ImageGallery`; source search found no active importers for `components/ui/SmartImage.tsx`. | Deleted `components/ui/SmartImage.tsx`; keep `components/library/SmartImage.tsx` for medical image attribution/gallery behavior. |
| Refactor/maintainability issue | SHOULD FIX | Closed | Toolkit rotation selector duplicated the active onboarding/settings rotation selector. | Active rotation imports point to `components/onboarding/RotationSelector.tsx`; source search found no active consumers of `components/toolkit/RotationSelector.tsx`. | Deleted `components/toolkit/RotationSelector.tsx`; keep onboarding selector as canonical for profile/settings rotation selection. |
| Data integrity issue | SHOULD FIX | Closed | The normalized schema now has a `QuestionIdentity` contract, and the active runtime writers dual-write `questionIdentityId`. | `prisma/schema.prisma` and migration `20260517000000_add_question_identity_contract` add nullable identity links and backfill existing rows. `functions/api/study/session/generate.ts`, `lib/services/drillReviewService.ts`, `functions/api/questions/attempt.ts`, `functions/api/questions/record.ts`, `functions/api/sync.ts`, and mounted Express `/api/sync` now resolve identities and write `questionIdentityId` to session questions, attempts, review logs, cards, and synced saved questions where available. | Keep lower-priority legacy session/read-only analytics paths compatibility-only unless they become active write paths. |
| Documentation gap | DONE | Closed | Setup copy command referenced `env.example` instead of `.env.example`. | Repo has `.env.example`; stale references were in README/auth setup UI. | Fixed and verified with `rg`. |
| Documentation gap | DONE | Closed | README linked missing root deployment docs. | Actual docs live under `docs/deployment`. | Fixed README links. |
| Configuration issue | DONE | Closed | Wrangler rejected `/* /index.html 200` as an infinite-loop redirect. | `public/_redirects:5`; Wrangler warning during `pages dev`. Cloudflare Pages docs now document built-in SPA fallback when no top-level `404.html` exists. | Removed self-rewrite rules, rebuilt, verified `/study` direct navigation under Wrangler. |
| Runtime bug | DONE | Closed | Dev server produced false React missing-key warnings. | Vite aliased `react/jsx-dev-runtime` to a production shim even in dev. | Alias the shim only for production builds. |

## 5. Unknowns

- Whether a full fresh clone can run every setup command end to end. Dependency installation itself is verified with an isolated temp `npm ci` using the current package files and Prisma schema.
- Whether the Clerk dashboard can provide a safe non-2FA E2E user or test session for full sign-in smoke. The required local env variables are now documented, but not currently present in `.env`.
- Whether the local database has enough seeded safe questions for adaptive sessions. Read-only content/drug endpoint connectivity is verified.
- Whether the custom Clerk domain 400s on localhost affect only local production-parity smoke or any preview deployment.
- Whether authenticated `/study` can launch a full adaptive session and submit a review after the Clerk second-factor blocker is resolved.
- Whether `/practice` renders the intended private-beta mode library in a browser after the Clerk second-factor blocker is resolved. Mode visibility tests pass.

## 6. Setup / Build / Run / Test Commands

Detected package manager: npm (`package-lock.json` lockfile version 3).

Install:

```bash
npm ci
```

Local env:

```bash
cp .env.example .env
```

Prisma:

```bash
npm run db:generate
npx prisma validate
```

Local dev:

```bash
npm run dev
npm run dev:server
npm run dev:all
npm run dev:wrangler
```

Production parity local flow:

```bash
npm run build
npm run pages:serve
```

Verification:

```bash
npm run typecheck:ci
npm run typecheck
npm run lint
npm run build
npm run build:check-size
npm run test:critical
npm test
npm run verify:health
```

Database local option:

```bash
docker-compose up -d db
npm run db:migrate:dev
```

Safety note: do not run production migrations, destructive database scripts, deploy commands, or env edits without explicit approval.

## 7. Work Phases

### Phase 1 - Setup And Command Discovery

Status: complete.

Completed:

- Identified npm as package manager.
- Mapped major commands in `package.json`.
- Confirmed Node version file is `.node-version` with `22`.
- Read `README.md`, `CLAUDE.md`, `AGENTS.md`, CI, Vite, Vitest, Playwright, Prisma, Wrangler, Docker config.
- Fixed setup doc/UI mismatches for `.env.example` and docs paths.

### Phase 2 - Build / Runtime Baseline

Status: complete for unauthenticated shell and public API.

Passed:

- Prisma validation.
- CI and production typechecks.
- Production build.
- Critical tests.
- Full Vitest suite.
- Lint with warnings under configured threshold.
- Bundle-size check.
- npm install dry-run check.
- Vite `/` and `/study` smoke.
- Vite preview smoke for desktop landing, mobile reduced-motion landing, and protected `/study`.
- Wrangler `/study` direct navigation and `/api/health` smoke.
- `npm run dev:wrangler` build-and-serve production-parity smoke.
- Public production-smoke Playwright suite against Wrangler.
- Local Express `/health`, `/api/content/all`, and `/api/drugs/all` smoke after direct-Postgres TLS fix.
- Wrangler `/api/content/all` smoke and `/api/study/resolve-blueprint` routing smoke.

### Phase 3 - App Structure

Status: partially inspected.

Known map:

- Frontend entry: `index.html` -> `index.tsx` -> `App.tsx`.
- Routing: `config/AppRoutes.tsx`, `config/routes.ts`, `config/routeRegistry.ts`.
- Lazy views: `config/lazyComponents.tsx`.
- Primary study session: `components/session/CoreAdaptiveSession.tsx`.
- Practice launcher: `pages/PracticePage.tsx`.
- Auth: `components/auth/AuthProvider.tsx`, `AuthenticatedRoute.tsx`, `ProtectedRouteGate.tsx`.
- Production API: `functions/api`.
- Local-only API: `server.ts`, `routes`.
- Database: `prisma/schema.prisma`, `prisma/migrations`.
- Tests: `tests`, `components/**/*.test.tsx`, `functions/api/**/*.test.ts`, `e2e`.

### Phase 4 - Core Functionality

Status: started, not complete.

Verified:

1. public landing route renders
2. protected `/study` route renders unauthenticated auth gate
3. built direct `/study` navigation works under Wrangler
4. `/api/health` works under Wrangler
5. local Express database health and read-only content/drug endpoints work
6. Wrangler content endpoint works and protected study endpoint routes to auth
7. core session generation/submission API contracts pass in targeted Vitest coverage
8. private-beta mode visibility tests pass
9. study session selection now hydrates normalized `QuestionAnswerChoice` and active `QuestionExplanation` relations when present, with legacy question JSON/string fields as fallback
10. `/api/user/review-history` reads canonical `ReviewLog` rows and exposes FSRS state for exports, analytics, and optimizer inputs
11. study-plan task progress auto-completes from submitted review attempts when the task target is met
12. `/progress` now surfaces today's adaptive plan beside FSRS retention/upcoming-review analytics
13. study-plan window generation refreshes stale pending plans after newer real review data while preserving completed and in-progress plans
14. `/api/srs/due` and `/api/srs/next` preserve normalized question identity fields for due-card study launchers and submit paths
15. approved generated-question promotion now mirrors normalized answer choices and the active correct-rationale explanation for learner-facing canonical questions
16. guided post-answer explanations now adapt their chunk framing and knowledge checks to the learner's support level, first-clue reflection, and hint usage

Not verified:

1. Clerk sign-in completion from local production build; the available test user stops at second factor / Client Trust
2. authenticated command center route
3. adaptive session generation
4. answer submission persistence

### Phase 5 - Reliability

Status: in progress.

Candidates:

- API error envelopes and SDK result handling.
- Empty/error/loading states in core session.
- Private beta mode discoverability.
- Sync and offline queue behavior around answer submission.
- Landing/dashboard console warning cleanup.

Completed:

- Removed all literal `"Loading..."`, content-spinner, and conditional-loading matches reported by `npm run audit:loading`; the loading audit is clean for the tracked categories.

### Phase 6 - Developer Workflow

Status: in progress.

Completed:

- Created this plan as the durable continuation source.
- Added repo-aware future prompts and workflows.
- Confirmed `AGENTS.md` exists and contains repo-specific instructions, but it is currently untracked.
- Documented the Clerk E2E auth-smoke variables and production-smoke workflow in `.env.example` and `README.md`.
- Corrected stale `panacea-navigator` guidance so it points future Codex sessions to `AGENTS.md`.
- Removed empty placeholder skill directories that caused the skill audit to fail.
- Removed the landing page Motion scroll-container warning without changing global `html/body` positioning.
- Added a recovery workflow note to `AGENTS.md` pointing future sessions to this plan.
- Repaired newly generated memory/RAG skill files with required front matter and updated skill overview/routing docs.
- Fixed the production-smoke npm script so E2E auth variables can be read from `.env` as documented.
- Added a shared Playwright Clerk auth helper and updated saved-auth setup to use the same safe E2E credentials as production smoke.

## 8. Current Task

E2E auth workflow hardening completed. Saved-auth Playwright setup and production-smoke setup now share the same programmatic Clerk sign-in helper and `.env`-loaded credential path, with manual login preserved as a fallback. The external-auth blocker still prevents browser-level authenticated core-flow smoke until a safe Clerk E2E user/session can complete sign-in locally without second factor.

FSRS review-history contract coverage is now in place: `/api/user/review-history` is pinned to canonical `ReviewLog` reads, maps legacy export aliases, and can intentionally include rapid-guess audit rows when requested.

FSRS/planner integration pass is now in place: progress exports pull canonical review events, optimizer history mapping reads FSRS fields, review submissions update active daily-plan task progress, and `/progress` shows today's actionable adaptive tasks with launch actions.

Personalized question-selection inputs are now wired for on-demand study sessions. `/api/study/session/generate` derives per-topic mastery and per-system weakness from existing `UserProgress` rows, then passes those maps plus a cold-start bandit state into `selectSessionQuestions` when learner history exists. This avoids a schema migration while giving the existing contextual-bandit selector real learner signals.

Study-plan regeneration regression coverage is now in place: `ensureStudyPlanWindow` is pinned to read latest real `ReviewLog` activity, refresh stale pending plans, and avoid overwriting completed or in-progress learner work.

SRS due-card launch identity is now wired: `/api/srs/due` returns `questionIdentityId` for due card rows, and `/api/srs/next` returns `questionIdentityId`, `canonicalQuestionId`, `sourceQuestionId`, and `questionSource` on normalized question payloads so the review submit path can preserve the same identity contract.

The schema normalization task is completed for active runtime writers after the auth workflow cleanup. The repo has the additive normalized study schema and `QuestionIdentity` migration-ready layer for session questions, attempts, review logs, saved questions, and cards. Runtime dual-write wiring now covers generated study-session links, submit-review attempts/review logs/cards, linked `StudySessionQuestion` rows, synced saved-question/bookmark rows, stats-only `/api/questions/attempt` writes, legacy `/api/questions/record` writes, and mounted Express `/api/sync` saved-question compatibility writes.

Current continuation added route-level Express `/api/sync` regression coverage proving synced saved questions resolve `QuestionIdentity` and write `SavedQuestion.questionIdentityId` on create/update, while no-database local sync remains persistence-free. It also preserves `questionIdentityId` in the isolated drill-session attempt helper so future drill writers do not drop normalized identity links while keeping `isMainSession=false`. Static migration/schema-reference audit and production build both pass for the normalized identity contract.

Latest continuation hardened migration rollout verification. The existing read-only `db:audit-learning-identity` script now checks for the `question_identities` table, nullable identity rollout columns, unresolved identity source targets, and missing `questionIdentityId` coverage across session questions, attempts, review logs, saved questions, and FSRS cards. Rollout probes skip safely when post-migration columns are not deployed yet, so the audit can run before and after migration without mutating data.

`CoreAdaptiveSession` semantic token contrast review is closed for the current state actions. Error and empty-state exit actions now use outlined/tinted status affordances with `text-primary`, and the summary `Done` action uses the accent CTA foreground/background pairing instead of inverse text on a neutral surface. The state-action class contract has focused regression coverage.

Local dependency repair and audit cleanup are closed for the current state. The checked-in lockfile now matches the current `package.json`, stale Next/Geist entries are gone, `npm install` and `npm ci --dry-run` pass, Prisma client generation succeeds, `npm audit --json` reports 0 vulnerabilities, and the repaired dependency tree supports production typecheck, CI typecheck, lint, full Vitest, critical FSRS tests, production build, and bundle-size verification. The dependency repair also exposed a Sentry SDK type/runtime mismatch, which is now fixed in the lazy Sentry wrapper by merging React and browser SDK exports before initialization.

Memory/RAG sanitizer hardening is now in place. The unsafe control-character sanitizer no longer relies on an ESLint-forbidden control-character regex, reports `mutated` when replacement preserves string length, and has focused regression coverage. ESLint also ignores transient `node_modules*` scratch directories so interrupted package-manager repairs do not become false source lint failures.

Generated-question promotion normalization is now in place. The shared canonical mirror helper used by admin review, auto-approval, staging promotion, and bulk pre-generated mirrors now upserts `QuestionAnswerChoice` rows and the active version-1 `CORRECT_RATIONALE` `QuestionExplanation` alongside the legacy canonical `Question` mirror, so approved RAG/staging content can be consumed through the normalized selector path. Duplicate answer text is guarded so only the resolved keyed normalized choice is marked correct.

Guided study-mode explanation scaffolding now uses the context it already collects. The post-answer scaffold adjusts the first explanation chunk for foundational versus confident learners, changes repair language for wrong answers, and folds the learner's written clue plus hint usage into the knowledge-check prompt and reveal.

The current continuation widened verification after the mirror/scaffold changes. Critical FSRS/store tests, production build, full lint, and bundle-size budget all pass. The first bundle-size check immediately after build reported a missing `dist/assets` directory, but inspection showed the assets existed and an immediate rerun passed, so this is recorded as a transient build-artifact visibility issue rather than a source regression.

Latest continuation closed the loading-state reliability pass. CoreAdaptiveSession now uses a non-placeholder initial blueprint label, the admin question review queue renders structured skeleton rows, Grand Rounds leaderboard/review loading states no longer rely on literal placeholder text, Daily Challenges reports `Syncing status` instead of generic loading copy, and the protected-route auth gate uses skeleton text instead of a bare CSS spinner. Layout-level loading branches in Goals, DDx Matrix, external medical search, flag feedback, and the OSCE order catalog now use skeleton primitives. The loading audit now distinguishes content-loading spinners from benign refresh/canonical implementation animations and structured branches; `npm run audit:loading` reports 0 `"Loading..."` entries, 0 content-spinner patterns, and 0 conditional-loading review candidates.

Latest continuation hardened core sync API-envelope handling. `SyncManager` now unwraps attempt and batch-review success envelopes, uses the shared envelope error parser for sync failures, and the legacy offline sync service unwraps conflict response envelopes before newest-wins conflict resolution. Focused sync regression tests pass, and the API-envelope audit no longer reports the core sync services.

The remaining browser-level functional blocker is external: a safe Clerk E2E user/session without second factor is still required for authenticated `/study` and `/practice` smoke. If those credentials are not available, the next unblocked local recovery work is smaller runtime/UX cleanup that does not require authenticated browser access.

Latest consolidation pass is complete for the current multi-chat change set. The repo now has one retained visual dependency direction (`motion` plus on-demand raw `three`), one lightweight AI Gateway URL helper for URL-only tests, stale repo-audit output removed, and final validation passing across typecheck, lint, critical tests, full Vitest, memory verification, anatomy asset verification, and production build.

## 9. Completed Tasks

Codex-made changes in this recovery pass:

- `APP_FUNCTIONALITY_PLAN.md`: created and updated as the recovery plan.
- `README.md`: aligned prerequisites with Node 22, changed setup command to `npm ci`, fixed `.env.example` copy command, changed local migration command to `npm run db:migrate:dev`, and fixed deployment/env doc links.
- `README.md`: clarified Express vs Wrangler local API targets for maintained `/api/study/*` routes.
- `README.md`: added production-parity smoke-test instructions, including the authenticated Clerk E2E smoke workflow.
- `components/auth/AuthProvider.tsx`: fixed missing-key setup text and auth-guide path; ClerkProvider children are grouped under a fragment.
- `components/auth/SetupRequiredPage.tsx`: fixed setup copy command, clipboard text, and auth-guide path.
- `vite.config.ts`: uses the JSX dev-runtime shim only for production builds so Vite dev keeps React dev JSX metadata.
- `public/_redirects`: removed self-rewrite SPA fallback and asset pass-through rules; documented Cloudflare Pages built-in SPA fallback.
- `lib/config/localPgConnectionString.ts`: added local/test PG connection-string normalization for `sslmode=require` direct URLs.
- `lib/config/localPgConnectionString.test.ts`: added regression coverage for the connection-string normalization.
- `lib/prisma.ts`: applies the local/test PG normalization before constructing the Prisma PG adapter pool.
- `.env.example`: documents `DIRECT_DATABASE_URL` for local Express dev/migrations and the local SSL compatibility behavior.
- `.env.example`: documents optional `E2E_REQUIRE_AUTH`, `E2E_CLERK_TEST_EMAIL`, and `E2E_CLERK_TEST_PASSWORD` values for authenticated production smoke.
- `package.json`: fixes `npm run dev:wrangler` by routing it to the verified `pages:dev` build-and-serve command.
- `package.json`: updates `test:e2e:production-smoke` to load `.env` via Node 22 before invoking Playwright.
- `package.json`: updates `test:auth` to load `.env` via Node 22 before invoking Playwright.
- `e2e/helpers/clerkAuth.ts`: adds shared Playwright helpers for Clerk E2E credentials, active-session detection, programmatic sign-in, and clearer `needs_second_factor` messaging.
- `e2e/auth.setup.ts`: uses the shared helper to sign in with E2E credentials when present and keeps manual login as fallback before saving `playwright/.auth/user.json`.
- `e2e/production-smoke/core-launch.spec.ts`: reuses the shared Clerk auth helper instead of carrying duplicate sign-in logic.
- `e2e/README.md`: updates saved-auth and production-smoke instructions to use the npm scripts and explains `.env` loading behavior.
- `.agents/skills/panacea-navigator/SKILL.md`: corrected stale guidance so it says `AGENTS.md` exists and should be read first.
- Empty `.agents/skills/{graph-memory,hybrid-retrieval,memory-discovery,memory-regression-eval,memory-safety,rag-quality,tabular-memory}` directories: removed because they contained no `SKILL.md` and made the audit fail.
- `components/landing/DiagnosticScrollStory.tsx`: replaced the Motion `useScroll({ target })` offset measurement with an equivalent viewport-scroll `useMotionValue` calculation to avoid the dev scroll-container warning.
- `AGENTS.md`: added a repo recovery workflow section requiring future functional-recovery sessions to read and update `APP_FUNCTIONALITY_PLAN.md`.
- `.agents/skills/{graph-memory,hybrid-retrieval,memory-discovery,memory-regression-eval,memory-safety,rag-quality,tabular-memory}/SKILL.md`: added required YAML front matter.
- `docs/skills-overview.md`: listed the memory and retrieval skills.
- `docs/skills-usage.md`: added routing rows for memory/RAG/graph/tabular-memory work.
- `lib/services/conceptQuestionSelector.ts`: session question normalization now hydrates normalized `QuestionAnswerChoice` rows and active `QuestionExplanation` rows before falling back to legacy `Question.options`, `Question.correctAnswer`, and `Question.explanation`; learner-facing selected questions must include a non-empty explanation.
- `lib/services/conceptQuestionSelector.ts`: typed `QUESTION_SELECT` as `Prisma.QuestionSelect` so nested Prisma `orderBy` arrays remain assignable during production typecheck.
- `tests/conceptQuestionSelector.test.ts`: added regression coverage for normalized answer/explanation hydration in session selection.
- `lib/services/fsrsScheduleService.ts`: added optional `progressContext` input and switched the `UserProgress` lookup to `userId_conditionId_progressContext`, defaulting to `READINESS`.
- `tests/fsrsScheduleService.test.ts`: updated the default lookup expectation and added coverage for `TARGETED` progress reads.
- `functions/api/user/review-history.ts`: canonical review-history export now reads `ReviewLog`, resolves the internal user id, supports optional rapid-guess inclusion, and preserves QuestionAttempt-compatible export fields.
- `functions/api/user/review-history.test.ts`: added endpoint coverage for ReviewLog filters, legacy export aliases, rapid-guess inclusion, telemetry fallbacks, and the `events` alias.
- `components/settings/DataExport.tsx`: exports review history from the authenticated canonical endpoint and includes FSRS/session metadata in CSV output.
- `services/ai/adaptiveFSRSService.ts`: maps optimizer review-history inputs from canonical FSRS review fields instead of deriving ratings only from correctness.
- `functions/api/study/session/generate.ts`: derives topic mastery and system weakness from existing `UserProgress` history, then passes those personalization inputs and a cold-start bandit state into on-demand `selectSessionQuestions`.
- `functions/api/study/session-generate.test.ts`: pins learner-progress signal handoff into on-demand question selection.
- `lib/services/drillReviewService.ts`: submitted reviews now advance linked daily study-plan tasks and mark the task/plan complete when question targets are met.
- `tests/drillReviewService.test.ts`: pinned automatic study-plan task completion from review submission.
- `pages/ProgressPage.tsx`: added today's adaptive plan surface with consistent workspace primitives and task launch actions.
- `functions/api/_shared/studyPlanService.test.ts`: added regression coverage for regenerating stale pending daily plans from newer real review activity while preserving completed and in-progress plan rows.
- `functions/api/srs/due.ts`: includes `questionIdentityId` for due `Card` rows so study-mode launchers can preserve normalized identity metadata.
- `functions/api/srs/next.ts`: includes canonical `questionSource`, `sourceQuestionId`, `canonicalQuestionId`, and due-card `questionIdentityId` on normalized SRS question payloads.
- `functions/api/srs/due.test.ts` and `functions/api/srs/next.test.ts`: pin SRS due-card identity propagation and pre-generated variant source metadata.
- `prisma/schema.prisma`: added `QuestionIdentity` and nullable `questionIdentityId` links on `Card`, `QuestionAttempt`, `ReviewLog`, `SavedQuestion`, and `StudySessionQuestion`.
- `prisma/migrations/20260517000000_add_question_identity_contract/migration.sql`: added the additive identity migration and deterministic backfill for `Question`, `PreGeneratedQuestion`, `StagingQuestion`, and `QuestionSeed` sources.
- `docs/database/normalized-study-schema.md` and `prisma/README.md`: documented the identity contract, migration order, indexes, and remaining open decisions.
- `lib/study/questionIdentityPersistence.ts`: added server-side helpers to normalize, upsert, batch-create, and look up `QuestionIdentity` records while falling back safely when source FKs are not available yet.
- `lib/sessionGeneration.ts`: threaded optional `questionIdentityId` through normalized session questions and persisted session-question records.
- `functions/api/study/session/generate.ts`: resolves/creates question identities before writing `StudySessionQuestion` rows, persists `questionIdentityId` alongside canonical/pre-generated compatibility IDs, and returns the resolved identity id in generated question payloads.
- `lib/services/drillReviewService.ts`: resolves/creates question identities during submit-review and dual-writes `questionIdentityId` to `QuestionAttempt`, `ReviewLog`, `Card`, and linked `StudySessionQuestion` rows.
- `lib/api/schemas/questions.ts`: `/api/questions/attempt` now accepts optional `canonicalQuestionId`, `sourceQuestionId`, and `questionSource` metadata.
- `functions/api/questions/attempt.ts`: legacy/stale-offline stats-only attempt recording resolves source identity metadata, mirrors pre-generated questions when needed, writes `QuestionAttempt.questionIdentityId` when available, and uses the shared guarded `QuestionIdentity` helper boundary.
- `functions/api/questions/record.ts`: legacy question-record compatibility path resolves `QuestionIdentity` for active canonical questions and approved pre-generated mirrors, then writes `QuestionAttempt.questionIdentityId` when available.
- `functions/api/questions/record.test.ts`: pins canonical and pre-generated record-path identity writes.
- `lib/services/reviewLogService.ts`: preserves optional `questionIdentityId` when using the centralized ReviewLog create helper.
- `tests/reviewLogService.test.ts`: pins ReviewLog helper identity passthrough.
- `services/drill/drillSessionManager.ts`: preserves optional `questionIdentityId` on isolated drill attempts while keeping `isMainSession=false`.
- `services/drill/drillSessionManager.test.ts`: pins drill attempt identity passthrough and statistical isolation.
- `routes/sync.ts`: Express-only local sync compatibility path already resolves and writes `SavedQuestion.questionIdentityId`; the remaining Express question routes are selection/read/local-dev paths and do not create `QuestionAttempt`, `ReviewLog`, or `StudySessionQuestion` rows.
- `functions/api/sync.ts`: preserves saved-question source identity metadata from client sync payloads, batch-resolves `QuestionIdentity`, and writes `SavedQuestion.questionIdentityId` when available.
- `routes/sync.ts`: best-effort Express compatibility sync now resolves saved-question source identity metadata and writes `SavedQuestion.questionIdentityId` when available, falling back to legacy fields if identity resolution is unavailable.
- `tests/express-sync.test.ts`: added Express route-level coverage for synced saved-question identity writes and the no-database local acknowledgement path.
- `lib/api/types/questions.ts`: exposes optional `questionIdentityId` on the shared `QuestionDTO` contract.
- `lib/study/questionIdentityPersistence.test.ts`, `lib/sessionGeneration.test.ts`, `functions/api/study/session-generate.test.ts`, `tests/drillReviewService.test.ts`, `functions/api/questions/attempt.test.ts`, and `functions/api/sync.saved-question-identity.test.ts`: added targeted identity persistence and propagation coverage.
- `components/session/CoreAdaptiveSession.tsx`: centralized state-action button class contracts and replaced unsafe inverse-text/status-fill pairings in error, empty, and summary states with theme-stable semantic token pairs.
- `components/session/CoreAdaptiveSession.test.ts`: added regression coverage for the state-action foreground/background token pairings.
- Local dependency tree: repaired from a staged install, regenerated Prisma client types, and restored missing local Sentry package type declarations from clean published tarballs so official verification commands can run again.
- `package.json`: removed unused direct `geist`, bumped `langsmith` to the audited range, and added temporary overrides for patched Babel SystemJS, `fast-uri`, and Hono transitive versions.
- `package-lock.json`: regenerated from current `package.json` with a fresh npm cache, bringing the lockfile back in sync with the declared React/Vite/Radix/Three/TanStack/Motion dependencies, removing stale `geist`/Next entries, and resolving the stale audit advisories.
- `lib/monitoring/sentry.ts`: lazy Sentry initialization now merges `@sentry/browser` and `@sentry/react` exports so the existing wrapper can typecheck and safely call browser transport/scope helpers while preserving the React SDK entrypoint.
- `lib/services/memory/contextSanitizer.ts`: replaced the lint-invalid raw control-character regex with an explicit codepoint sanitizer and fixed `mutated` reporting for same-length unsafe-character replacement.
- `tests/memory/contextSanitizer.test.ts`: added regression coverage proving unsafe control characters are replaced without losing useful clinical text.
- `eslint.config.js`: ignores transient `node_modules*` scratch directories left by interrupted package-manager operations.
- `functions/api/_shared/canonical-question-mirror.ts`: canonical question mirroring now synchronizes normalized answer-choice rows and the active correct-rationale explanation for both single upsert and bulk create mirror paths when the Prisma delegates are available.
- `functions/api/_shared/canonical-question-mirror.test.ts`: pins normalized answer/explanation row sync for the shared single and bulk mirror helpers, including duplicate answer text correctness.
- `functions/api/_shared/staging-questions.test.ts`: pins normalized answer/explanation row sync for staging promotion to the live learner pool.
- `functions/api/admin/question-review.test.ts`: pins normalized answer/explanation row sync for admin approval and auto-approval through the shared mirror boundary.
- `lib/study/studyModeScaffolding.ts`: post-answer guided explanations now adapt chunk framing, answer repair text, and knowledge checks to `guidanceLevel`, `learnerReflection`, and `hintsViewed`.
- `lib/study/studyModeScaffolding.test.ts`: adds regression coverage for foundational scaffolding and learner-reflection/hint-aware knowledge checks.
- `components/session/StudyModeCoach.tsx`: passes the existing guided-mode learner context into `buildScaffoldedExplanation`.
- `components/session/CoreAdaptiveSession.tsx`: replaced the remaining internal `"Loading..."` blueprint placeholder label with a stable study-plan label.
- `components/admin/QuestionReviewQueue.tsx`: replaced the text-only queue loading state with structured skeleton rows.
- `components/modes/GrandRoundsMode.tsx`: replaced text-only leaderboard loading placeholders with skeleton text and changed review-button pending copy from generic loading text to `Fetching review`.
- `components/pages/DailyChallengesHub.tsx`: changed daily-card loading status copy from generic loading text to `Syncing status`.
- `components/auth/ProtectedRouteGate.tsx`: replaced the auth-loading CSS spinner with skeleton text inside the existing status region.
- `components/auth/ProtectedRouteGate.test.tsx`: added regression coverage for the auth-loading skeleton state and absence of the old CSS spinner.
- `scripts/audit-loading-states.ts`: fixed stateful global-regex scans, broadened structured-loading detection to canonical study/drill skeleton primitives, ignored benign refresh/canonical/spin-button animation lines, and stopped flagging structured conditional-loading branches.
- `components/goals/GoalsDashboard.tsx`: replaced the goals list text loader with structured skeleton cards.
- `tests/components/Goals/GoalsDashboard.test.tsx`: updated the loading assertion to use the accessible `role="status"`/`aria-label="Loading goals"` contract exposed by the structured skeleton state.
- `components/library/DDxMatrixView.tsx`: replaced the DDx comparison text loader with skeleton text.
- `components/external/MedicalDatabaseSearch.tsx`: replaced the search results spinner loader with skeleton text.
- `components/questions/FlagFeedbackNotification.tsx`: replaced the flag list text loader with skeleton text.
- `components/modes/osce/OrderPanel.tsx`: replaced the order catalog spinner loader with skeleton text.
- `components/drill/DrillLandingPage.tsx`: replaced the custom motion start-button spinner with the canonical inline spinner.
- `lib/services/sync/syncManager.ts`: uses shared API-envelope helpers for offline answer/review success payloads and sync error payloads.
- `lib/services/offlineSyncService.ts`: unwraps conflict response envelopes before applying conflict resolution.
- `tests/offlineSyncService.test.ts`: adds regression coverage proving `newest-wins` conflict resolution respects an enveloped server `updatedAt`.
- `package.json` / `package-lock.json`: removed unused `gsap`, `@react-three/fiber`, and `@react-three/drei`; kept the current `motion`, `three`, and `@tanstack/react-table` runtime choices.
- `vite.config.ts`: removed manual chunk checks for packages no longer in the dependency graph; kept Three isolated from the default vendor chunk.
- `components/anatomy/AnatomyModelCanvas.tsx`: tightened the local material type used when toggling wireframe updates.
- `functions/api/_shared/ai-gateway.ts`: added a lightweight Gemini/Cloudflare AI Gateway URL helper so URL-only tests no longer import the full AI service graph.
- `functions/api/_shared/ai-service.ts`: re-exports the gateway URL helper while keeping existing callers compatible.
- `tests/aistack-upgrades.test.ts`: points Cloudflare AI Gateway URL tests at the lightweight helper, removing full-suite timeout risk.
- `docs/repo-audit/*`: removed stale generated audit docs that contradicted the current implementation and were not suitable for commit.
- `docs/studypanacea-ui-exec-plan.md`, `docs/ui-redesign-audit.md`, `docs/features/NIH_3D_MODEL_INTEGRATION.md`, `docs/implementation/3D_SPATIAL_BOUNDING_BOXES.md`, `docs/MODULE_1_QUICKSTART.md`, and `docs/UI_UX_POLISH_GUIDE.md`: updated visual-runtime guidance away from GSAP/R3F/drei and toward the current Motion/raw-Three/Web Animations approach.

Important dirty-worktree note:

- Many other modified/untracked files exist and appear to be user/design-system/anatomy/landing work. Do not revert or normalize them during recovery unless directly required.

## 10. Verification History

Passed:

- `rg` stale setup references in README/auth components: no stale `cp env.example .env` references remained.
- `npx prisma validate`: schema valid.
- `npm run typecheck:ci`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed after setup/docs, Vite alias, and redirect changes. Build still emits chunk-size warnings above 700 kB.
- `npm run typecheck`: passed after the landing scroll-story change.
- `npm run build`: passed after the landing scroll-story change. Build still emits chunk-size warnings above 700 kB.
- `npm run build:check-size`: passed; total JS and CSS are within configured budgets.
- `npx vitest run lib/config/localPgConnectionString.test.ts`: passed, 5 tests.
- `npm run test:critical`: passed, 6 files / 143 tests.
- `npm test`: passed, 502 files / 9581 tests, 1 skipped.
- `npm run lint`: passed with 0 errors and 356 existing warnings.
- `npm ci --dry-run --ignore-scripts`: passed.
- Isolated clean install check: copied `package.json`, `package-lock.json`, and `prisma/schema.prisma` to a temporary directory, ran `/opt/homebrew/bin/npm ci`, and passed with `prisma generate` postinstall. The command reported 5 audit vulnerabilities: 1 moderate and 4 high.
- `git diff --check`: passed.
- `rg -n "E2E_REQUIRE_AUTH|E2E_CLERK_TEST_EMAIL|Production-Parity Smoke|test:e2e:production-smoke|verify:health" .env.example README.md APP_FUNCTIONALITY_PLAN.md e2e/production-smoke/core-launch.spec.ts`: confirmed the E2E auth smoke variables and workflow are documented.
- `git diff --check -- .env.example README.md APP_FUNCTIONALITY_PLAN.md`: passed.
- Vite dev smoke for `/`: HTTP 200, landing H1 rendered.
- Vite dev smoke for `/study`: HTTP 200, protected auth gate H1 rendered.
- `npm run test:ui-smoke:preview`: passed desktop landing, mobile reduced-motion landing, and protected `/study` smoke with no page errors, console errors, or failed non-Clerk responses.
- `npm run test:ui-smoke:preview`: reran after the landing scroll-story change and passed the same desktop landing, mobile reduced-motion landing, and protected `/study` smoke with no page errors, console errors, or failed non-Clerk responses.
- Dev Playwright smoke for `/` after the landing scroll-story change: Motion container-position warning gone; only expected Clerk development-key warning remains; no page errors or failed non-Clerk responses.
- Vite proxy `http://localhost:3000/api/content/all`: returned HTTP 200 after Express DB fix.
- Express `npm run dev:server`: started, connected to database after local direct-URL TLS normalization.
- `curl http://localhost:3001/health`: returned healthy with database `ok` and Redis disabled.
- `curl http://localhost:3001/api/content/all`: returned HTTP 200.
- `curl http://localhost:3001/api/drugs/all`: returned HTTP 200.
- Wrangler `pages dev dist`: no invalid redirect warning after `_redirects` fix; parsed 0 redirect rules and 10 header rules.
- `curl -I http://localhost:8788/study`: HTTP 200.
- `curl http://localhost:8788/api/content/all`: returned HTTP 200 through Pages Functions.
- `curl http://localhost:8788/api/study/resolve-blueprint`: returned HTTP 401 unauthenticated, confirming the protected study function route is wired.
- Playwright smoke of `http://localhost:8788/study`: rendered H1 `Sign in to open your adaptive study plan.`, no page errors.
- `BASE_URL=http://localhost:8788 npm run verify:health`: 2 Playwright API-health tests passed.
- `npm run dev:wrangler`: starts successfully via `pages:dev` and serves on `http://localhost:8788`.
- `BASE_URL=http://localhost:8788 npm run verify:health` against `npm run dev:wrangler`: 2 Playwright API-health tests passed.
- Initial `BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke` after adding `node --env-file-if-exists=.env` failed because direct invocation of Playwright's CLI file still needed the `test` subcommand; fixed the script and reran.
- `BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke`: passed 3 public production-smoke tests and skipped 1 authenticated core-loop test because no E2E Clerk credentials are present.
- Local production auth smoke rebuilt with the test Clerk publishable key from `.env`: reached Clerk sign-in, but the available test user returned `needs_second_factor`.
- `npx vitest run components/session/CoreAdaptiveSession.test.ts functions/api/study/session-generate.test.ts tests/submitReviewIdempotency.test.ts lib/sdk/__tests__/drillsClient.test.ts lib/sdk/__tests__/core.test.ts`: passed, 5 files / 49 tests.
- `npx vitest run tests/privateBetaVisibility.test.ts tests/training-modes.test.ts`: passed, 2 files / 24 tests.
- `.agents/skills/skill-routing-and-usage/scripts/audit-skills.sh /Users/aaronullger/GitHub/StudyPANaCEa`: initially failed on seven empty skill directories missing `SKILL.md`; after removing the empty directories, passed with 28 skill folders checked and 0 warnings. Later regenerated memory/RAG skills lacked front matter; after adding front matter and docs entries, the audit passed with 35 skill folders checked and 0 warnings.
- `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest run tests/conceptQuestionSelector.test.ts`: passed, 1 file / 9 tests.
- `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed.
- `PATH=/opt/homebrew/bin:$PATH npx vitest run tests/fsrsScheduleService.test.ts`: passed, 1 file / 11 tests.
- `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck > /tmp/studypanacea-typecheck.log 2>&1`: exited 0 after the Prisma selector typing fix.
- `PATH=/opt/homebrew/bin:$PATH npx vitest run functions/api/user/review-history.test.ts`: passed, 1 file / 2 tests.
- `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck > /tmp/studypanacea-typecheck-review-history.log 2>&1`: exited 0.
- `PATH=/opt/homebrew/bin:$PATH npx vitest run functions/api/_shared/studyPlanService.test.ts`: passed, 1 file / 8 tests.
- `PATH=/opt/homebrew/bin:$PATH npx vitest run functions/api/questions/attempt.test.ts`: passed, 1 file / 34 tests.
- `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck > /tmp/studypanacea-typecheck-study-plan.log 2>&1`: exited 0 after study-plan regeneration coverage and the attempt endpoint helper type repair.
- `PATH=/opt/homebrew/bin:$PATH npx vitest run functions/api/srs/due.test.ts functions/api/srs/next.test.ts`: passed, 2 files / 22 tests.
- `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck > /tmp/studypanacea-typecheck-srs-identity.log 2>&1`: exited 0 after SRS identity handoff changes.
- `PATH=/opt/homebrew/bin:$PATH npm run test:critical`: passed, 6 files / 143 tests.
- `npx eslint e2e/helpers/clerkAuth.ts e2e/auth.setup.ts e2e/production-smoke/core-launch.spec.ts`: passed.
- `npx prettier --check e2e/helpers/clerkAuth.ts e2e/auth.setup.ts e2e/production-smoke/core-launch.spec.ts`: passed after formatting `e2e/production-smoke/core-launch.spec.ts`.
- `E2E_REQUIRE_AUTH=0 node --env-file-if-exists=.env ./node_modules/@playwright/test/cli.js test --config=playwright.production-smoke.config.ts --list`: listed 4 production-smoke tests without import errors.
- `E2E_REQUIRE_AUTH=0 npm run test:e2e:production-smoke -- --list`: listed 4 production-smoke tests through the npm script.
- `E2E_REQUIRE_AUTH=0 npm run test:auth -- --list`: listed the saved-auth setup test through the npm script.
- `rg -n "npx playwright test e2e/auth.setup|npm init playwright|E2E_CLERK_TEST|test:auth|production-smoke|auth.setup" e2e/README.md README.md .env.example package.json APP_FUNCTIONALITY_PLAN.md`: confirmed the auth workflow docs point at the current scripts and E2E variables.
- `./node_modules/.bin/prisma format`: completed; `prisma/schema.prisma` was formatted.
- `./node_modules/.bin/prisma validate`: passed after the `QuestionIdentity` schema change.
- `./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after the `QuestionIdentity` schema change.
- `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest run lib/study/questionIdentityPersistence.test.ts lib/sessionGeneration.test.ts functions/api/study/session-generate.test.ts tests/drillReviewService.test.ts`: passed, 4 files / 68 tests.
- `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest run functions/api/questions/attempt.test.ts`: passed, 1 file / 34 tests.
- `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/prisma validate`: passed after runtime identity wiring.
- `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after runtime identity wiring.
- `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/eslint lib/study/questionIdentityPersistence.ts lib/study/questionIdentityPersistence.test.ts lib/sessionGeneration.ts lib/sessionGeneration.test.ts functions/api/study/session/generate.ts functions/api/study/session-generate.test.ts lib/services/drillReviewService.ts tests/drillReviewService.test.ts --max-warnings 2000`: passed after fixing a local `prefer-const` warning in `lib/services/drillReviewService.ts`.
- `git diff --check -- lib/study/questionIdentityPersistence.ts lib/study/questionIdentityPersistence.test.ts lib/sessionGeneration.ts lib/sessionGeneration.test.ts functions/api/study/session/generate.ts functions/api/study/session-generate.test.ts lib/services/drillReviewService.ts tests/drillReviewService.test.ts`: passed.
- `npx vitest run functions/api/user/review-history.test.ts tests/drillReviewService.test.ts`: passed, 2 files / 18 tests.
- `npx vitest run functions/api/study-plan/progress.test.ts functions/api/_shared/studyPlanService.test.ts`: passed, 2 files / 6 tests.
- `npm run typecheck`: passed after the FSRS/planner integration pass.
- `npm run test:critical`: passed, 6 files / 143 tests.
- `npm run build`: passed after the FSRS/planner integration pass. Build still emits chunk-size warnings above 700 kB.
- `npm exec -- vitest run lib/study/questionIdentity.test.ts lib/study/questionIdentityPersistence.test.ts lib/sessionGeneration.test.ts functions/api/study/session-generate.test.ts tests/drillReviewService.test.ts functions/api/sync.test.ts functions/api/sync.integration.test.ts`: passed, 7 files / 82 tests.
- `npm exec -- vitest run functions/api/sync.saved-question-identity.test.ts`: passed, 1 file / 1 test.
- `./node_modules/.bin/prisma validate`: passed after saved-question identity wiring.
- `npm run typecheck`: passed after saved-question identity wiring.
- `npm run test:critical`: passed, 6 files / 143 tests.
- `npm run lint`: passed with 0 errors and 356 existing warnings.
- `npm run build`: passed after saved-question identity wiring. Build still emits chunk-size warnings above 700 kB.
- `npm run build:check-size`: passed; total JS 6820.5 kB / 8200 kB, CSS 271.7 kB / 300 kB, largest chunk 715.5 kB / 1250 kB.
- `git diff --check`: passed.
- `npm exec -- vitest run functions/api/questions/attempt.test.ts`: passed, 1 file / 34 tests.
- `npx vitest run functions/api/sync.saved-question-identity.test.ts functions/api/study/session-generate.test.ts lib/sessionGeneration.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 4 files / 53 tests.
- `npx vitest run functions/api/questions/attempt.test.ts functions/api/sync.saved-question-identity.test.ts functions/api/study/session-generate.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 4 files / 49 tests.
- `npm run typecheck`: passed after returning `questionIdentityId` from session generation.
- `npm run test:critical`: passed, 6 files / 143 tests.
- `npx prettier --check functions/api/questions/attempt.ts functions/api/questions/attempt.test.ts lib/api/schemas/questions.ts`: passed after stats-only attempt identity wiring.
- `npx vitest run functions/api/questions/attempt.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 2 files / 38 tests.
- `npm run typecheck`: passed after stats-only `/api/questions/attempt` identity wiring.
- 2026-05-17 continuation: `./node_modules/.bin/prisma validate`: passed after the identity helper type-boundary cleanup.
- 2026-05-17 continuation: `./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after the identity helper type-boundary cleanup.
- 2026-05-17 continuation: `./node_modules/.bin/vitest run lib/study/questionIdentity.test.ts lib/study/questionIdentityPersistence.test.ts lib/sessionGeneration.test.ts functions/api/study/session-generate.test.ts tests/drillReviewService.test.ts`: passed, 5 files / 74 tests.
- 2026-05-17 continuation: `git diff --check -- prisma/schema.prisma prisma/migrations/20260517000000_add_question_identity_contract/migration.sql docs/database/normalized-study-schema.md prisma/README.md APP_FUNCTIONALITY_PLAN.md lib/study/questionIdentity.ts lib/study/questionIdentityPersistence.ts lib/study/questionIdentity.test.ts lib/study/questionIdentityPersistence.test.ts lib/sessionGeneration.ts lib/sessionGeneration.test.ts functions/api/study/session/generate.ts functions/api/study/session-generate.test.ts functions/api/sync.ts lib/services/drillReviewService.ts tests/drillReviewService.test.ts functions/api/questions/attempt.ts functions/api/questions/attempt.test.ts`: passed.
- `npx vitest run functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 3 files / 42 tests.
- `npx prettier --check functions/api/questions/record.ts functions/api/questions/record.test.ts`: passed after `/api/questions/record` identity wiring.
- `npx vitest run functions/api/questions/record.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 2 files / 9 tests.
- `npm run typecheck`: passed after `/api/questions/record` identity wiring.
- `npm run test:critical`: passed after `/api/questions/record` identity wiring, 6 files / 143 tests.
- `git diff --check -- functions/api/questions/record.ts functions/api/questions/record.test.ts`: passed.
- 2026-05-17 continuation: `npm exec -- vitest run functions/api/questions/record.test.ts`: passed, 1 file / 5 tests.
- 2026-05-17 continuation: `npm exec -- prettier --check functions/api/questions/record.ts functions/api/questions/record.test.ts`: passed.
- 2026-05-17 continuation: `npm run typecheck`: passed after verifying `/api/questions/record` identity wiring.
- 2026-05-17 continuation: `npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `git diff --check -- functions/api/questions/record.ts functions/api/questions/record.test.ts routes/sync.ts APP_FUNCTIONALITY_PLAN.md`: passed before this plan update.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest run functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts functions/api/sync.saved-question-identity.test.ts`: passed, 3 files / 40 tests.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/eslint routes/sync.ts functions/api/questions/record.ts functions/api/questions/record.test.ts --max-warnings 2000`: passed.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after Express sync compatibility identity wiring.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" DATABASE_URL="postgresql://user:pass@localhost:5432/test" ./node_modules/.bin/tsx -e "import('./routes/sync.ts').then(() => console.log('routes/sync import ok'))"`: passed.
- 2026-05-17 continuation: `git diff --check -- routes/sync.ts APP_FUNCTIONALITY_PLAN.md`: passed.
- 2026-05-17 continuation: `npm audit --json`: passed with 0 vulnerabilities.
- 2026-05-17 continuation: staged dependency repair outside the repo with `npm install --ignore-scripts --no-audit --no-fund --progress=false --prefer-online`: passed, then copied the clean dependency tree and regenerated Prisma client types with `npm run db:generate`.
- 2026-05-17 continuation: restored missing local `@sentry/browser` and `@sentry/core` `.d.ts` files from `npm pack @sentry/browser@10.48.0 @sentry/core@10.48.0` after typecheck exposed incomplete package contents.
- 2026-05-17 continuation: `npm exec -- prettier --check components/session/CoreAdaptiveSession.tsx`: passed.
- 2026-05-17 continuation: `npm exec -- vitest run components/session/CoreAdaptiveSession.test.ts`: passed, 1 file / 11 tests.
- 2026-05-17 continuation: `npm audit --json`: passed with 0 vulnerabilities after dependency repair.
- 2026-05-17 continuation: `npm run typecheck`: passed after dependency repair and Prisma generation.
- 2026-05-17 continuation: `npm run build`: passed after dependency repair and `CoreAdaptiveSession` contrast cleanup. Build still emits chunk-size warnings above 700 kB.
- 2026-05-17 continuation: `npm run lint`: passed with 0 errors and 355 existing raw-hex token warnings under the configured warning threshold.
- 2026-05-17 continuation: `git diff --check -- components/session/CoreAdaptiveSession.tsx components/session/CoreAdaptiveSession.test.ts APP_FUNCTIONALITY_PLAN.md routes/sync.ts`: passed after `CoreAdaptiveSession` semantic token contrast cleanup.
- 2026-05-17 continuation: `./node_modules/.bin/vitest run tests/reviewLogService.test.ts functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts functions/api/srs/sync.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 5 files / 59 tests.
- 2026-05-17 continuation: `./node_modules/.bin/prisma validate`: passed after ReviewLog helper identity passthrough.
- 2026-05-17 continuation: `./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after ReviewLog helper identity passthrough.
- 2026-05-17 continuation: `node node_modules/vitest/vitest.mjs run tests/fsrs.test.ts tests/fsrs-optimizer-bridge.test.ts tests/retrievability.test.ts tests/fsrs-eor-scheduler.test.ts tests/lib/fsrs-canonical-verification.test.ts tests/store/useStudyStore.test.ts`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `./node_modules/.bin/vitest run tests/reviewLogService.test.ts functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts functions/api/srs/sync.test.ts lib/study/questionIdentityPersistence.test.ts`: passed on rerun, 5 files / 59 tests.
- 2026-05-17 continuation: `git diff --check -- APP_FUNCTIONALITY_PLAN.md functions/api/questions/record.ts lib/services/reviewLogService.ts tests/reviewLogService.test.ts prisma/schema.prisma prisma/migrations/20260517000000_add_question_identity_contract/migration.sql docs/database/normalized-study-schema.md prisma/README.md lib/study/questionIdentityPersistence.ts functions/api/questions/attempt.ts functions/api/sync.ts functions/api/study/session/generate.ts lib/sessionGeneration.ts lib/services/drillReviewService.ts`: passed.
- 2026-05-17 continuation: `npx vitest run tests/express-sync.test.ts`: passed, 1 file / 2 tests, before the later dependency-tree failure.
- 2026-05-17 continuation: `git diff --check -- routes/sync.ts tests/express-sync.test.ts functions/api/questions/record.ts functions/api/questions/record.test.ts functions/api/questions/attempt.ts functions/api/questions/attempt.test.ts functions/api/sync.ts functions/api/sync.saved-question-identity.test.ts functions/api/study/session/generate.ts functions/api/study/session-generate.test.ts lib/sessionGeneration.ts lib/sessionGeneration.test.ts lib/study/questionIdentityPersistence.ts lib/study/questionIdentityPersistence.test.ts lib/services/drillReviewService.ts tests/drillReviewService.test.ts functions/api/user/review-history.ts functions/api/user/review-history.test.ts components/settings/DataExport.tsx services/ai/adaptiveFSRSService.ts pages/ProgressPage.tsx`: passed.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/vitest/vitest.mjs run functions/api/srs/due.test.ts functions/api/srs/next.test.ts`: passed, 2 files / 22 tests after SRS due-card identity propagation and formatting.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" node node_modules/typescript/bin/tsc --noEmit -p tsconfig.production.json`: passed after the lazy Sentry SDK export merge.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/vitest/vitest.mjs run tests/fsrs.test.ts tests/fsrs-optimizer-bridge.test.ts tests/retrievability.test.ts tests/fsrs-eor-scheduler.test.ts tests/lib/fsrs-canonical-verification.test.ts tests/store/useStudyStore.test.ts`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `./node_modules/.bin/vitest run services/drill/drillSessionManager.test.ts tests/reviewLogService.test.ts functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 5 files / 59 tests.
- 2026-05-17 continuation: `git diff --check -- services/drill/drillSessionManager.ts services/drill/drillSessionManager.test.ts`: passed.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" node node_modules/typescript/bin/tsc --noEmit -p tsconfig.production.json`: passed after drill identity passthrough.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/prisma/build/index.js validate`: passed after drill identity passthrough.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/vitest/vitest.mjs run tests/fsrs.test.ts tests/fsrs-optimizer-bridge.test.ts tests/retrievability.test.ts tests/fsrs-eor-scheduler.test.ts tests/lib/fsrs-canonical-verification.test.ts tests/store/useStudyStore.test.ts`: passed after drill identity passthrough, 6 files / 143 tests.
- 2026-05-17 continuation: `git diff --check -- APP_FUNCTIONALITY_PLAN.md services/drill/drillSessionManager.ts services/drill/drillSessionManager.test.ts lib/services/reviewLogService.ts tests/reviewLogService.test.ts functions/api/questions/record.ts`: passed.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH npm run lint`: passed with 0 errors and 355 existing raw-hex token warnings.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/prettier/bin/prettier.cjs --check functions/api/srs/due.ts functions/api/srs/next.ts functions/api/srs/due.test.ts functions/api/srs/next.test.ts lib/monitoring/sentry.ts APP_FUNCTIONALITY_PLAN.md`: passed.
- 2026-05-17 continuation: `npx vitest run tests/memory/contextSanitizer.test.ts`: initially exposed the same-length mutation-reporting bug; passed after the sanitizer fix, 1 file / 5 tests.
- 2026-05-17 continuation: `npx eslint lib/services/memory/contextSanitizer.ts tests/memory/contextSanitizer.test.ts`: passed.
- 2026-05-17 continuation: `npx prettier --write lib/services/memory/contextSanitizer.ts tests/memory/contextSanitizer.test.ts eslint.config.js`: applied repo formatting to the sanitizer, sanitizer test, and ESLint ignore change.
- 2026-05-17 continuation: `npx prettier --check lib/services/memory/contextSanitizer.ts tests/memory/contextSanitizer.test.ts eslint.config.js APP_FUNCTIONALITY_PLAN.md`: passed after formatting.
- 2026-05-17 continuation: `npx vitest run tests/memory/contextSanitizer.test.ts`: passed on rerun after formatting, 1 file / 5 tests.
- 2026-05-17 continuation: `npx eslint lib/services/memory/contextSanitizer.ts tests/memory/contextSanitizer.test.ts`: passed on rerun after formatting.
- 2026-05-17 continuation: `npx vitest run lib/study/questionIdentityPersistence.test.ts functions/api/study/session-generate.test.ts functions/api/questions/attempt.test.ts functions/api/sync.saved-question-identity.test.ts tests/drillReviewService.test.ts lib/sessionGeneration.test.ts`: passed, 6 files / 103 tests.
- 2026-05-17 continuation: `git diff --check`: passed after the sanitizer and ESLint-ignore changes.
- 2026-05-17 continuation: `npx prisma validate`: passed after the sanitizer and ESLint-ignore changes.
- 2026-05-17 continuation: `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after the sanitizer and ESLint-ignore changes.
- 2026-05-17 continuation: `npm run lint`: passed with 0 errors and 355 existing raw-color warnings.
- 2026-05-17 continuation: `npm audit --omit=dev`: passed with 0 vulnerabilities.
- 2026-05-17 continuation: `npm run build`: passed after the sanitizer and ESLint-ignore changes; the known `three.module` and `vendor` chunk-size warnings remain non-blocking.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/vitest/vitest.mjs run functions/api/study/session-generate.test.ts`: passed, 1 file / 11 tests after learner-progress personalization wiring.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/vitest/vitest.mjs run functions/api/study/session-generate.test.ts functions/api/srs/due.test.ts functions/api/srs/next.test.ts`: passed, 3 files / 33 tests.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" node node_modules/typescript/bin/tsc --noEmit -p tsconfig.production.json`: passed after learner-progress personalization wiring.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH node node_modules/vitest/vitest.mjs run tests/fsrs.test.ts tests/fsrs-optimizer-bridge.test.ts tests/retrievability.test.ts tests/fsrs-eor-scheduler.test.ts tests/lib/fsrs-canonical-verification.test.ts tests/store/useStudyStore.test.ts`: passed, 6 files / 143 tests after learner-progress personalization wiring.
- 2026-05-17 continuation: staged lockfile regeneration in `/tmp/studypanacea-install-20260517` with `/opt/homebrew/bin/npm install --package-lock-only --ignore-scripts --no-audit --no-fund --cache /tmp/studypanacea-npm-cache-20260517 --prefer-online`: passed.
- 2026-05-17 continuation: staged dependency install/link repair with `/opt/homebrew/bin/npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/studypanacea-npm-cache-20260517 --prefer-offline` followed by a linking pass and copy into the repo: passed sufficiently to restore `.bin` tools and package contents.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run db:generate`: passed after the dependency tree was restored.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm audit --package-lock-only --json --cache /tmp/studypanacea-npm-cache-20260517`: passed with 0 vulnerabilities.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm ci --dry-run --ignore-scripts --no-audit --no-fund --cache /tmp/studypanacea-npm-cache-20260517 --prefer-offline --loglevel=error`: passed in the repo, confirming the synced lockfile can drive install resolution.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- vitest run functions/api/questions/record.test.ts`: passed, 1 file / 5 tests.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- prettier --check functions/api/questions/record.ts functions/api/questions/record.test.ts`: passed.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- prettier --write lib/monitoring/sentry.ts`: applied formatting after Sentry wrapper changes.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run typecheck`: passed after the dependency repair and lazy Sentry SDK export merge.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- prettier --check lib/monitoring/sentry.ts functions/api/questions/record.ts functions/api/questions/record.test.ts`: passed.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run build`: passed. Vite still warned that some chunks exceed 700 kB, but the build completed.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run build:check-size`: passed; total JS 6820.7 kB / 8200 kB, CSS 271.4 kB / 300 kB, largest chunk 715.5 kB / 1250 kB.
- 2026-05-17 continuation: `ps aux | rg 'npm ci|npm install|rm -rf node_modules|studypanacea'`: confirmed no active install/delete process was touching `node_modules` before final verification.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run db:generate`: passed, Prisma Client v7.7.0 generated.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run typecheck`: passed with `NODE_OPTIONS=--max-old-space-size=4096`.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run build`: passed with the known >700 kB chunk warning.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm audit --json`: passed with 0 vulnerabilities across 1517 dependencies.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm ls @babel/plugin-transform-modules-systemjs fast-uri hono langsmith next geist --all --loglevel=error`: passed; graph resolves to `@babel/plugin-transform-modules-systemjs@7.29.4`, `fast-uri@3.1.2`, `hono@4.12.19`, `langsmith@0.7.1`, with no `next`/`geist` path.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run build:check-size`: passed; total JS 6820.7 kB / 8200 kB, CSS 271.4 kB / 300 kB, largest chunk 715.5 kB / 1250 kB.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm ci --dry-run --no-audit --no-fund --loglevel=error`: passed and regenerated Prisma during postinstall.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm test`: passed, 511 files / 9620 tests, 1 skipped.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run lint`: passed with 0 errors and 355 existing raw-hex token warnings under the configured threshold.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run typecheck:ci`: passed.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- vitest run functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts`: passed, 2 files / 14 tests after normalized canonical mirror relation sync.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- vitest run tests/conceptQuestionSelector.test.ts functions/api/study/session-generate.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts`: passed, 4 files / 34 tests.
- 2026-05-17 continuation: `NODE_OPTIONS="--max-old-space-size=4096" /opt/homebrew/bin/npm run typecheck`: passed after normalized canonical mirror relation sync.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run lint`: passed with 0 errors and 355 existing raw-hex token warnings under the configured threshold.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run build`: passed after normalized canonical mirror relation sync. Build still emits the known chunk-size warnings above 700 kB.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm install --no-audit --no-fund --cache /tmp/studypanacea-npm-cache-20260517 --prefer-offline --loglevel=error`: repaired missing local `.bin` command shims and regenerated Prisma Client v7.7.0 after npm scripts initially could not find `eslint`, `vitest`, or `vite`.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest run functions/api/_shared/canonical-question-mirror.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts`: passed, 3 files / 17 tests after bulk canonical mirror relation sync.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/eslint functions/api/_shared/canonical-question-mirror.ts functions/api/_shared/canonical-question-mirror.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts --max-warnings 2000`: passed.
- 2026-05-17 continuation: `git diff --check -- functions/api/_shared/canonical-question-mirror.ts functions/api/_shared/canonical-question-mirror.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts APP_FUNCTIONALITY_PLAN.md`: passed before this plan update.
- 2026-05-17 continuation: first production typecheck retry was blocked while a concurrent `npm ci` rebuilt `node_modules`; after the install process finished, `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsc --noEmit -p tsconfig.production.json` passed.
- 2026-05-17 continuation: `npm ci --ignore-scripts --cache /tmp/studypanacea-npm-cache`: passed after moving the damaged local `node_modules` out of the repo.
- 2026-05-17 continuation: `./node_modules/.bin/prisma generate`: passed, Prisma Client v7.7.0 generated after the ignore-scripts install.
- 2026-05-17 continuation: `./node_modules/.bin/prisma validate`: passed.
- 2026-05-17 continuation: `npx vitest run tests/express-sync.test.ts functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts functions/api/sync.saved-question-identity.test.ts functions/api/study/session-generate.test.ts lib/sessionGeneration.test.ts lib/study/questionIdentityPersistence.test.ts tests/drillReviewService.test.ts functions/api/user/review-history.test.ts functions/api/study-plan/progress.test.ts functions/api/_shared/studyPlanService.test.ts`: passed, 11 files / 122 tests.
- 2026-05-17 continuation: `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`: passed after Prisma client generation.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest run lib/study/studyModeScaffolding.test.ts`: passed, 1 file / 4 tests after guided scaffold adaptation.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/eslint lib/study/studyModeScaffolding.ts lib/study/studyModeScaffolding.test.ts components/session/StudyModeCoach.tsx --max-warnings 2000`: passed.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/prettier --check lib/study/studyModeScaffolding.ts lib/study/studyModeScaffolding.test.ts components/session/StudyModeCoach.tsx`: passed after formatting.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after guided scaffold adaptation.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest run functions/api/_shared/canonical-question-mirror.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts lib/study/studyModeScaffolding.test.ts`: passed, 4 files / 22 tests after the duplicate-answer guard and scaffold adaptation.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/eslint functions/api/_shared/canonical-question-mirror.ts functions/api/_shared/canonical-question-mirror.test.ts functions/api/_shared/staging-questions.test.ts functions/api/admin/question-review.test.ts lib/study/studyModeScaffolding.ts lib/study/studyModeScaffolding.test.ts components/session/StudyModeCoach.tsx --max-warnings 2000`: passed.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/prettier --check functions/api/_shared/canonical-question-mirror.ts functions/api/_shared/canonical-question-mirror.test.ts lib/study/studyModeScaffolding.ts lib/study/studyModeScaffolding.test.ts components/session/StudyModeCoach.tsx`: passed.
- 2026-05-17 continuation: `PATH="/Users/aaronullger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after the duplicate-answer guard.
- 2026-05-17 continuation: `npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `npm run build`: passed after the mirror/scaffold changes. Build still emits the known chunk-size warning above 700 kB.
- 2026-05-17 continuation: first `npm run build:check-size` immediately after build reported `dist/assets` missing; inspection showed `dist/assets` existed and an immediate rerun passed. Treat this as transient artifact visibility, not a source failure.
- 2026-05-17 continuation: `npm run build:check-size`: passed on rerun; total JS 6826.8 kB / 8200 kB, CSS 271.8 kB / 300 kB, largest chunk 715.5 kB / 1250 kB.
- 2026-05-17 continuation: `npm run lint`: passed with 0 errors and 355 existing raw-hex token warnings under the configured threshold.
- 2026-05-17 continuation: `npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `npm run build`: passed. Build still emits the known >700 kB chunk warning.
- 2026-05-17 continuation: `npm run lint`: passed with 0 errors and 355 existing raw-hex token warnings under the configured threshold.
- 2026-05-17 continuation: `npm run build:check-size`: passed; total JS 6824.4 kB / 8200 kB, CSS 271.4 kB / 300 kB, largest chunk 715.5 kB / 1250 kB.
- 2026-05-17 continuation: migration static schema-reference audit passed with `migration referenced schema fields present`.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH npm run build`: passed after the normalized identity contract close-out; Vite still emits the known >700 kB chunk warning.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/vitest run tests/learningIdentityAudit.test.ts`: passed, 1 file / 3 tests after adding QuestionIdentity rollout audit probes.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH ./node_modules/.bin/prettier --check scripts/db/audit-learning-identity.ts tests/learningIdentityAudit.test.ts scripts/db/README.md docs/database/normalized-study-schema.md APP_FUNCTIONALITY_PLAN.md`: passed after formatting the audit script and test.
- 2026-05-17 continuation: `PATH=/opt/homebrew/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" node node_modules/typescript/bin/tsc --noEmit -p tsconfig.production.json`: passed after the rollout audit update.
- 2026-05-17 continuation: `npx vitest run components/navigation/command-center/CommandCenterWorkspace.test.tsx -t "opens and closes the attribution drawer" --pool=threads`: passed, 1 test / 8 skipped.
- 2026-05-17 continuation: `npx vitest run components/navigation/command-center/CommandCenterWorkspace.test.tsx`: passed, 1 file / 9 tests.
- 2026-05-17 continuation: `npx vitest run functions/api/questions/generate.test.ts functions/api/drills/submit-review.test.ts tests/confusionService.test.ts tests/reservoir-service.test.ts`: passed, 4 files / 92 tests after full-suite worker startup timeouts named these files.
- 2026-05-17 continuation: `npm audit --json`: passed with 0 vulnerabilities across 1517 dependencies.
- 2026-05-17 continuation: `npm run typecheck:ci`: passed.
- 2026-05-17 continuation: `npx vitest run tests/express-sync.test.ts functions/api/questions/record.test.ts functions/api/questions/attempt.test.ts functions/api/sync.saved-question-identity.test.ts lib/study/questionIdentityPersistence.test.ts`: passed, 5 files / 46 tests after formatting the Express sync route.
- 2026-05-17 continuation: `npx prettier --check routes/sync.ts tests/express-sync.test.ts APP_FUNCTIONALITY_PLAN.md`: passed.
- 2026-05-17 continuation: `npx eslint routes/sync.ts tests/express-sync.test.ts --max-warnings 2000`: passed.
- 2026-05-17 continuation: `git diff --check -- APP_FUNCTIONALITY_PLAN.md routes/sync.ts tests/express-sync.test.ts`: passed.
- 2026-05-17 continuation: `npm run audit:loading`: initially reported 7 `"Loading..."` entries across 4 files and 21 spinner-pattern candidates; after cleanup and audit-noise filtering it passed with 0 `"Loading..."` entries and 0 content-spinner patterns, while still reporting 13 conditional-loading review candidates.
- 2026-05-17 continuation: `./node_modules/.bin/vitest run components/session/CoreAdaptiveSession.test.ts`: passed, 1 file / 11 tests after the loading-state cleanup.
- 2026-05-17 continuation: `./node_modules/.bin/prettier --check components/session/CoreAdaptiveSession.tsx components/admin/QuestionReviewQueue.tsx components/modes/GrandRoundsMode.tsx components/pages/DailyChallengesHub.tsx`: passed after formatting the touched TSX files.
- 2026-05-17 continuation: `./node_modules/.bin/eslint components/session/CoreAdaptiveSession.tsx components/admin/QuestionReviewQueue.tsx components/modes/GrandRoundsMode.tsx components/pages/DailyChallengesHub.tsx --max-warnings 2000`: passed with 0 errors and 6 existing raw-hex token warnings in `DailyChallengesHub`.
- 2026-05-17 continuation: `./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after the loading-state cleanup.
- 2026-05-17 continuation: `./node_modules/.bin/prettier --check components/auth/ProtectedRouteGate.tsx scripts/audit-loading-states.ts`: passed after the protected auth loading/audit refinement.
- 2026-05-17 continuation: `./node_modules/.bin/eslint components/auth/ProtectedRouteGate.tsx components/session/CoreAdaptiveSession.tsx components/admin/QuestionReviewQueue.tsx components/modes/GrandRoundsMode.tsx components/pages/DailyChallengesHub.tsx --max-warnings 2000`: passed with 0 errors and the same 6 existing raw-hex token warnings in `DailyChallengesHub`.
- 2026-05-17 continuation: `./node_modules/.bin/vitest run components/session/CoreAdaptiveSession.test.ts components/ui/ClinicalInterface.test.tsx`: passed, 2 files / 13 tests after the audit refinement and protected auth loading skeleton.
- 2026-05-17 continuation: `./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after the audit refinement and protected auth loading skeleton.
- 2026-05-17 continuation: `npm run build`: passed after the loading-state reliability cleanup. Build still emits the known >700 kB chunk warning.
- 2026-05-17 continuation: `npm run build:check-size`: passed; total JS 6827.3 kB / 8200 kB, CSS 271.8 kB / 300 kB, largest chunk 715.5 kB / 1250 kB.
- 2026-05-17 continuation: `npm run audit:loading`: passed after the second reliability pass with 39 structured-loading components, 0 content-spinner patterns, 0 `"Loading..."` entries, and 0 conditional-loading review candidates.
- 2026-05-17 continuation: `./node_modules/.bin/prettier --check components/auth/ProtectedRouteGate.test.tsx components/goals/GoalsDashboard.tsx components/library/DDxMatrixView.tsx components/external/MedicalDatabaseSearch.tsx components/questions/FlagFeedbackNotification.tsx components/modes/osce/OrderPanel.tsx components/drill/DrillLandingPage.tsx scripts/audit-loading-states.ts`: passed.
- 2026-05-17 continuation: `./node_modules/.bin/eslint components/auth/ProtectedRouteGate.tsx components/auth/ProtectedRouteGate.test.tsx components/goals/GoalsDashboard.tsx components/library/DDxMatrixView.tsx components/external/MedicalDatabaseSearch.tsx components/questions/FlagFeedbackNotification.tsx components/modes/osce/OrderPanel.tsx components/drill/DrillLandingPage.tsx --max-warnings 2000`: passed with 0 errors.
- 2026-05-17 continuation: `./node_modules/.bin/vitest run components/auth/ProtectedRouteGate.test.tsx tests/components/Goals/GoalsDashboard.test.tsx`: passed, 2 files / 3 tests after replacing content/loading branches.
- 2026-05-17 continuation: `./node_modules/.bin/tsc --noEmit -p tsconfig.production.json`: passed after replacing content/loading branches.
- 2026-05-17 continuation: `npm run build`: passed after replacing content/loading branches. Build still emits the known >700 kB chunk warning.
- 2026-05-17 continuation: `npm run build:check-size`: passed; total JS 6830.1 kB / 8200 kB, CSS 270.9 kB / 300 kB, largest chunk 715.5 kB / 1250 kB.
- 2026-05-17 continuation: `node scripts/audit-api-envelope-callers.mjs --fail-on-findings`: initially failed with 57 unaudited internal API JSON callers, including the core `lib/services/sync/syncManager.ts` and `lib/services/offlineSyncService.ts` paths.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- vitest run tests/offlineSyncService.test.ts tests/syncManager.test.ts tests/syncResponseShape.test.ts tests/components/offline/OfflineSyncIndicator.test.tsx`: passed, 4 files / 40 tests after core sync envelope hardening.
- 2026-05-17 continuation: `NODE_OPTIONS="--max-old-space-size=4096" /opt/homebrew/bin/npm run typecheck`: passed after core sync envelope hardening.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- eslint lib/services/sync/syncManager.ts lib/services/offlineSyncService.ts tests/offlineSyncService.test.ts --max-warnings 2000`: passed after removing a stale eslint-disable comment.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm exec -- prettier --check lib/services/sync/syncManager.ts lib/services/offlineSyncService.ts tests/offlineSyncService.test.ts`: passed.
- 2026-05-17 continuation: `/opt/homebrew/bin/npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 continuation: `git diff --check -- lib/services/sync/syncManager.ts lib/services/offlineSyncService.ts tests/offlineSyncService.test.ts APP_FUNCTIONALITY_PLAN.md`: passed before this plan update.
- 2026-05-17 continuation: `npx vitest run tests/components/Goals/GoalsDashboard.test.tsx`: passed, 1 file / 2 tests after aligning the assertion with the structured loading status.
- 2026-05-17 continuation: `npx vitest run --shard=1/4 --maxWorkers=4`: passed after the goals loading assertion update, 129 files / 2177 tests.
- 2026-05-17 continuation: `npx vitest run --shard=2/4 --maxWorkers=4`: passed, 129 files / 2471 tests.
- 2026-05-17 continuation: `npx vitest run --shard=3/4 --maxWorkers=4`: passed, 129 files / 2292 tests.
- 2026-05-17 continuation: `npx vitest run --shard=4/4 --maxWorkers=4`: passed, 129 files / 2707 passed / 1 skipped.
- 2026-05-17 consolidation: `npm run verify:anatomy-assets`: passed, 10 assets, 29.16 MB total model size, 0 warnings, 0 failures.
- 2026-05-17 consolidation: `npm run verify:memory`: passed memory eval manifest and memory regression tests, 25 files / 332 tests.
- 2026-05-17 consolidation: `npm run typecheck`: initially exposed a narrow `AnatomyModelCanvas` material type issue; after fixing the type, the final production typecheck passed.
- 2026-05-17 consolidation: `npm run test:critical`: passed, 6 files / 143 tests.
- 2026-05-17 consolidation: targeted identity/auth/sync/graph regression run passed, 17 files / 125 tests.
- 2026-05-17 consolidation: `npx vitest run tests/aistack-upgrades.test.ts components/auth/ProtectedRouteGate.test.tsx --reporter=verbose`: passed, 2 files / 58 tests after extracting the lightweight AI Gateway helper.
- 2026-05-17 consolidation: `npm run test`: passed, 517 files / 9648 tests, 1 skipped.
- 2026-05-17 consolidation: `npm run lint`: passed with 0 errors and 297 warnings under the configured `--max-warnings 2000` threshold. Warnings are existing raw design-token hex warnings plus one unused eslint-disable warning.
- 2026-05-17 consolidation: `npm run build`: passed. Build still emits the known >700 kB chunk warning; Three is isolated as its own lazy chunk.

Failed or warnings:

- Live-key production build on localhost produced external 400 responses from Clerk custom-domain endpoints `/v1/client` and `/v1/environment`; auth gate still rendered. Treat live-key localhost sign-in as a documented local limitation.
- Test-key local auth smoke could not obtain an application session because the available Clerk test user requires second factor / Client Trust.
- Build warns about chunks larger than 700 kB, but bundle-size budget passes.
- A raw exploratory `npx tsc --noEmit --pretty false --skipLibCheck false --project tsconfig.production.json` invocation produced unrelated library/declaration noise; the repo's official `npm run typecheck` passed.
- An earlier Codex shell did not expose `npm`/`npx` by default. Direct `./node_modules/.bin/vitest` under that Codex app Node hit a Rollup native-package code-signature mismatch, so verification used the workspace Node path from `load_workspace_dependencies`.
- Earlier `npx prisma format` and `npx prisma validate` attempts failed in that shell because `npx` was not exposed; direct `./node_modules/.bin/prisma` was used instead.
- 2026-05-17 continuation: after prior successful typecheck/Prisma validation, a later rerun hit a local dependency-tree issue: `./node_modules/.bin/tsc --noEmit -p tsconfig.production.json` reported missing `@types/json-schema` and `@types/ws`, and `./node_modules/.bin/prisma validate` reported missing module `effect`. Focused Vitest and critical Vitest still passed. Do not treat this as a code regression without repairing/reinstalling local dependencies first.
- 2026-05-17 continuation: a broader `npx vitest run ...` verification attempt failed with `Cannot find package 'picomatch' imported from node_modules/vite/dist/node/index.js`; `npm install` repair attempts then failed with `ENOTEMPTY`, missing `node_modules/.bin`, npm cache/tar `ENOENT`, and an incomplete `node_modules`. `npm cache verify` passed, but a fresh install attempt still failed. The current shell needs dependency repair before more Node-based verification.
- 2026-05-17 continuation: after the `CoreAdaptiveSession` token cleanup, initial verification was blocked by an incomplete local dependency tree: `./node_modules/.bin/vitest` was missing, Vite could not resolve `vitest/config`, ESLint could not resolve `@eslint/js`, and production typecheck initially failed because Prisma client types were not regenerated after an ignore-scripts install. These are resolved in the later dependency-repair pass above.
- 2026-05-17 continuation: earlier default full-suite Vitest runs had worker timeout/scheduling issues. This is superseded by the later consolidation run where default `npm run test` passed, 517 files / 9648 tests, 1 skipped.
- 2026-05-17 continuation: after core sync envelope hardening, `node scripts/audit-api-envelope-callers.mjs --fail-on-findings` still fails with 55 lower-priority unaudited internal API JSON callers across admin, toolkit, graph/explorer, and mode surfaces. The core sync services are no longer listed.
- A direct one-file `tsc routes/sync.ts ...` attempt could not resolve the repo `@/*` path alias without a temporary tsconfig; `eslint`, production typecheck, and a `tsx` import smoke were used instead.

Not run:

- Full fresh-clone setup beyond dependency installation.
- Authenticated browser sign-in completion.
- Adaptive session generation/submission smoke.
- Authenticated E2E suites beyond public production smoke.

## 11. Backlog

- Configure a safe Clerk E2E user/session without second factor and rerun authenticated `/study` -> adaptive session generation -> answer submission smoke.
- Keep live custom-domain Clerk 400s documented as a localhost production-parity limitation unless production/preview auth is affected.
- Browser-smoke `/practice` after private-beta tests if route-level UI confidence is needed.
- Express-only sync/drill/session compatibility identity audit is closed for now: `routes/sync.ts` writes saved-question identities and has route-level regression coverage, and the remaining Express question/drill paths do not create attempt/review/session-link rows.
- Continue reducing `scripts/audit-api-envelope-callers.mjs --fail-on-findings` findings in priority order: learner-facing modes and session-adjacent components first, then admin/toolkit/reference surfaces. Core sync/offline replay is closed.
- Keep monitoring bundle size and lazy 3D/anatomy loading.
- Keep `npm run audit:loading` clean when adding new pages or async surfaces.

## 12. Next Best Step

Resolve the remaining external auth blocker and rerun browser-level core-flow smoke when safe Clerk E2E credentials are available:

1. Configure a safe Clerk E2E user/session without second factor.
2. Set `E2E_CLERK_TEST_EMAIL` and `E2E_CLERK_TEST_PASSWORD` locally without printing secrets.
3. Run `npm run dev:wrangler`.
4. Run `E2E_REQUIRE_AUTH=1 BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke`.
5. If auth completes, verify `/study` adaptive session generation/submission and `/practice` private-beta route smoke.
6. If auth still fails, document the exact Clerk response and choose the next unblocked local backlog item.

If Clerk E2E credentials are still unavailable, the next unblocked local task is to continue reducing unaudited API-envelope callers in learner-facing mode/session-adjacent components.

## 13. Future Codex Prompts

PROMPT NAME: Fix The Next Authenticated Study Blocker

PURPOSE: Move from verified route/API shell to the core learner flow.

WHEN TO USE: Use after this baseline when continuing recovery work.

PROMPT:

```text
Use `panacea-navigator`, `panacea-session-pipeline`, and `panacea-verify`. Read `APP_FUNCTIONALITY_PLAN.md`, then trace the authenticated `/study` flow through `components/session/CoreAdaptiveSession.tsx`, `components/session/hooks`, `functions/api/study/resolve-blueprint.ts`, `functions/api/study/check-distribution.ts`, `functions/api/study/session/generate.ts`, and `functions/api/drills/submit-review.ts`. Identify the first blocker to starting and submitting an adaptive session locally. Make the smallest safe fix or document the exact external credential/data blocker.
```

EXPECTED OUTPUT:

- Exact first blocker to authenticated adaptive study.
- Small code/test fix if the blocker is local.
- Updated verification history.

VERIFICATION:

```bash
npm run typecheck
npx vitest run functions/api/study/session-generate.test.ts
npx vitest run tests/drillReviewService.test.ts
```

PROMPT NAME: Diagnose Clerk Local Production Smoke

PURPOSE: Decide whether Clerk 400s under `wrangler pages dev dist` are expected localhost/live-key behavior or a real config issue.

WHEN TO USE: Use before claiming local production-parity auth works.

PROMPT:

```text
Use `panacea-navigator`, `security-and-privacy-audit`, and `panacea-verify`. Read `APP_FUNCTIONALITY_PLAN.md`, inspect `components/auth/AuthProvider.tsx`, Clerk env handling, `.env.example`, and `wrangler.toml` without printing secret values. Reproduce the `wrangler pages dev dist` `/study` smoke and identify why `https://clerk.studypanacea.com/v1/client` and `/v1/environment` return 400 on localhost. Do not modify production auth settings without a risk explanation.
```

EXPECTED OUTPUT:

- Classified cause: expected localhost/live-key limitation or local config bug.
- No secret leakage.
- Minimal docs/config fix only if safe.

VERIFICATION:

```bash
npm run build
npm run pages:serve
```

PROMPT NAME: Run Authenticated Core Study Smoke

PURPOSE: Complete the remaining functional proof after Clerk local test auth is available.

WHEN TO USE: Use after a safe Clerk E2E user/session exists that does not require second factor / Client Trust.

PROMPT:

```text
Use `panacea-navigator`, `panacea-session-pipeline`, `security-and-privacy-audit`, and `panacea-verify`. Read `APP_FUNCTIONALITY_PLAN.md` first. Do not print secrets. Confirm `E2E_CLERK_TEST_EMAIL` and `E2E_CLERK_TEST_PASSWORD` are present, build the app with the local/test Clerk publishable key from `.env`, start `npm run dev:wrangler`, then run the smallest authenticated `/study` -> adaptive session -> answer submission smoke using safe test data. If the smoke fails, identify the first blocker and update the plan.
```

EXPECTED OUTPUT:

- Authenticated smoke pass/fail result.
- First blocker if sign-in, session generation, or submit-review fails.
- Updated verification history and next best step.

VERIFICATION:

```bash
npm run build
npm run dev:wrangler
BASE_URL=http://localhost:8788 npm run verify:health
E2E_REQUIRE_AUTH=1 BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke
```

PROMPT NAME: Recheck Local API Database Health

PURPOSE: Quickly verify or repair the local Express database connection if the TLS error returns.

WHEN TO USE: Use when `npm run dev:server` reports database disconnected, `/health` returns 503, or local content/drug endpoints fail.

PROMPT:

```text
Use `panacea-navigator`, `panacea-prisma-data-integrity`, `security-and-privacy-audit`, and `panacea-verify`. Read `APP_FUNCTIONALITY_PLAN.md`, inspect `lib/config/localPgConnectionString.ts`, `lib/prisma.ts`, and non-secret metadata for `DATABASE_URL`/`DIRECT_DATABASE_URL`. Do not print secret values. Verify that local/test direct Postgres URLs with `sslmode=require` are normalized safely and that Express `/health`, `/api/content/all`, and `/api/drugs/all` return healthy/200.
```

EXPECTED OUTPUT:

- Non-secret diagnosis of local DB health.
- Small fix or exact external DB credential blocker.
- Updated verification history.

VERIFICATION:

```bash
npx vitest run lib/config/localPgConnectionString.test.ts
npm run dev:server
curl -i http://localhost:3001/health
curl -i http://localhost:3001/api/content/all
curl -i http://localhost:3001/api/drugs/all
```

PROMPT NAME: Review Private Beta Mode Discoverability

PURPOSE: Ensure users are not shown modes that are still `productionDeferred`.

WHEN TO USE: After `/practice` renders or before launch checks.

PROMPT:

```text
Use `panacea-view-composition` and `panacea-verify`. Inspect `pages/PracticePage.tsx`, `lib/modes/modeReadiness.ts`, `lib/modes/privateBetaVisibility.ts`, and `config/lazyComponents.tsx`. Verify that private beta discovery only exposes real mounted modes (`core_adaptive`, `system_drill`, `condition_drill`) unless `VITE_PRIVATE_BETA_LAUNCH=false`. Add or update a focused test if behavior is not already covered.
```

EXPECTED OUTPUT:

- Confirmed visible mode set or a minimal fix.
- Focused test result.
- Updated plan.

VERIFICATION:

```bash
npx vitest run lib/modes/modeReadiness.test.ts tests/training-modes.test.ts
```

PROMPT NAME: Repair Npm Install And Audit State

PURPOSE: Recover from missing packages, broken `.bin` links, lockfile drift, or npm audit regressions without restarting broad repo inspection.

WHEN TO USE: Use when `npm ci`, `npm install`, Vitest, Vite, Prisma, or TypeScript fails because packages are missing or the lockfile is out of sync.

PROMPT:

```text
Use `panacea-navigator` and `panacea-verify`. Read `APP_FUNCTIONALITY_PLAN.md`, inspect `package.json`, `package-lock.json`, and active npm/node_modules processes. Preserve unrelated worktree changes. Stop stale install/delete processes if they are touching `node_modules`, sync the lockfile from current `package.json` with a fresh npm cache, reinstall without changing source code, regenerate Prisma, rerun `npm audit --json`, confirm patched dependency graph for known advisories, and then run the setup/build/test verification ladder.
```

EXPECTED OUTPUT:

- Exact cause of the install/audit failure.
- Minimal package/lockfile changes, if needed.
- Updated verification history and remaining blocker.

VERIFICATION:

```bash
ps aux | rg 'npm ci|npm install|rm -rf node_modules'
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm install --no-audit --no-fund
npm run db:generate
npm ci --dry-run --no-audit --no-fund
npm audit --json
npm run typecheck
npm run build
npm run test:critical
```

PROMPT NAME: Maintain Recovery Plan After A Fix

PURPOSE: Keep future Codex sessions from restarting inspection.

WHEN TO USE: At the end of every recovery pass.

PROMPT:

```text
Read `APP_FUNCTIONALITY_PLAN.md` and update only the sections affected by this pass: Known Blockers And Risks, Work Phases, Current Task, Completed Tasks, Verification History, Backlog, Next Best Step, and Future Codex Prompts if a new repeated workflow was discovered. Keep the plan concrete and repo-specific.
```

EXPECTED OUTPUT:

- Plan reflects current repo state.
- Completed work and blockers are distinguishable.

VERIFICATION:

```bash
sed -n '1,260p' APP_FUNCTIONALITY_PLAN.md
```

## 14. Workflows

WORKFLOW NAME: Local Setup Verification

PURPOSE: Confirm a fresh developer can install and configure the app.

TRIGGER: Setup docs change, dependency change, or "app cannot install" report.

INPUTS: `README.md`, `.env.example`, `package-lock.json`, `package.json`, `prisma.config.ts`.

STEPS:

1. Confirm npm lockfile.
2. Confirm Node version from `.node-version`.
3. Confirm env copy command uses `.env.example`.
4. Run install command in a clean or CI-like environment when appropriate.
5. Run Prisma generation/validation.

COMMANDS:

```bash
npm ci
npm run db:generate
npx prisma validate
```

SUCCESS CRITERIA: install, Prisma generate, and Prisma validate pass, or the first external credential/database blocker is documented.

FAILURE HANDLING: Capture the first failing command and fix only setup/config issues before moving on.

OUTPUT: Updated verification history in this plan.

WORKFLOW NAME: Dependency Tree Repair And Audit

PURPOSE: Repair local install state without masking source regressions.

TRIGGER: Missing `node_modules/.bin` tools, Vite/Vitest module-resolution failures, Prisma package-resolution failures, `npm ci` lockfile errors, or npm audit regressions.

INPUTS: `package.json`, `package-lock.json`, active shell processes, npm cache path, and the first failing command output.

STEPS:

1. Check for stale install/delete processes before touching `node_modules`.
2. Sync `package-lock.json` from the current `package.json` if npm reports lockfile drift.
3. Use a fresh npm cache and low socket concurrency if tar extraction or `ENOENT` errors appear.
4. Regenerate Prisma after install because postinstall may be skipped during repair.
5. Verify audit and dependency graph before broader app checks.
6. Run typecheck, build, critical tests, and broader tests when the dependency tree is stable.

COMMANDS:

```bash
ps aux | rg 'npm ci|npm install|rm -rf node_modules'
NPM_CONFIG_MAXSOCKETS=1 npm install --package-lock-only --ignore-scripts --no-audit --no-fund
NPM_CONFIG_MAXSOCKETS=1 npm install --no-audit --no-fund
npm run db:generate
npm ci --dry-run --no-audit --no-fund
npm audit --json
npm ls @babel/plugin-transform-modules-systemjs fast-uri hono langsmith next geist --all --loglevel=error
npm run typecheck
npm run build
npm run test:critical
```

SUCCESS CRITERIA: install and dry-run install pass, Prisma generates, audit reports 0 vulnerabilities or documented accepted risk, patched dependency graph is confirmed, and source verification commands pass.

FAILURE HANDLING: Treat package-resolution failures as setup blockers until the dependency tree is stable. Do not make source changes to fix missing-package errors unless a real import/API mismatch remains after reinstall.

OUTPUT: Updated Known Blockers, Completed Tasks, and Verification History in this plan.

WORKFLOW NAME: Build Verification

PURPOSE: Establish whether the current repo can build.

TRIGGER: Code changes, recovery baseline, Vite/config/frontend edits.

INPUTS: `package.json`, `vite.config.ts`, `tsconfig.ci.json`, changed files.

STEPS:

1. Run CI typecheck.
2. Run production build.
3. Run bundle-size check when build output changes.
4. Inspect git status and preserve user work.

COMMANDS:

```bash
npm run typecheck:ci
npm run build
npm run build:check-size
git status --short
```

SUCCESS CRITERIA: typecheck, build, and size budget pass.

FAILURE HANDLING: Stop at first meaningful failure, classify it, and write a `CHANGE PLAN` before editing.

OUTPUT: Exact pass/fail status and updated current blocker.

WORKFLOW NAME: Cloudflare Pages Local Smoke

PURPOSE: Verify built route fallback and public Pages Functions.

TRIGGER: `_redirects`, `_headers`, `wrangler.toml`, `functions/api`, or build output changes.

INPUTS: `dist`, `public/_redirects`, `public/_headers`, `wrangler.toml`, `functions/api/health.ts`.

STEPS:

1. Run `npm run build`.
2. Start `wrangler pages dev dist` on an unused port.
3. Confirm Wrangler does not reject routing rules.
4. Check direct client route `/study`.
5. Run API health smoke.
6. Stop Wrangler before ending the turn.

COMMANDS:

```bash
npm run build
npx wrangler pages dev dist --port 8788 --compatibility-date=2025-12-15 --compatibility-flag=nodejs_compat
curl -I http://localhost:8788/study
BASE_URL=http://localhost:8788 npm run verify:health
```

SUCCESS CRITERIA: direct `/study` returns HTTP 200 and renders the auth gate; `/api/health` Playwright tests pass; no invalid redirect warnings.

FAILURE HANDLING: Fix only the first routing/API-health blocker, then rerun this workflow.

OUTPUT: Route/API smoke notes and updated verification history.

WORKFLOW NAME: Local Express API Database Smoke

PURPOSE: Verify the legacy local Express API can connect to the configured direct Postgres database.

TRIGGER: `lib/prisma.ts`, `.env.example`, database connection config, or local API route changes.

INPUTS: `.env` without printing secrets, `lib/config/localPgConnectionString.ts`, `lib/prisma.ts`, `server.ts`, `routes`.

STEPS:

1. Run the connection-string helper test.
2. Start `npm run dev:server`.
3. Check health and two read-only database-backed endpoints.
4. Stop the server before ending the turn.

COMMANDS:

```bash
npx vitest run lib/config/localPgConnectionString.test.ts
npm run dev:server
curl -i http://localhost:3001/health
curl -i http://localhost:3001/api/content/all
curl -i http://localhost:3001/api/drugs/all
```

SUCCESS CRITERIA: Express starts, database status is healthy, and content/drug endpoints return HTTP 200.

FAILURE HANDLING: Capture the first non-secret connection error. Do not print or edit secrets. Do not weaken production TLS behavior to make local smoke pass.

OUTPUT: API health summary and updated verification history.

WORKFLOW NAME: Core User Flow Verification

PURPOSE: Verify the smallest meaningful learner journey.

TRIGGER: Build passes, auth config changes, or session/API changes.

INPUTS: local env, Vite or Wrangler server, Clerk test credentials if available, seeded database.

STEPS:

1. Start the relevant local server.
2. Open `/` and `/study`.
3. If credentials/data are available, authenticate and start an adaptive session.
4. Check console/network for first blocker.
5. Submit one answer only if using safe local/test data.

COMMANDS:

```bash
npm run dev
```

SUCCESS CRITERIA: landing/setup state renders; protected route prompts auth; authenticated study path reaches session selector or question view; answer submit succeeds against local/test data.

FAILURE HANDLING: Fix the first route-render, auth-config, or API-contract blocker only.

OUTPUT: Browser smoke notes and updated verification history.

WORKFLOW NAME: Dirty Worktree Hygiene

PURPOSE: Avoid overwriting user work during recovery.

TRIGGER: Before editing files in a dirty repo or summarizing changed files.

INPUTS: `git status --short`, `git diff -- <file>`.

STEPS:

1. Check current status.
2. Diff files before editing.
3. Claim only changes actually made in this recovery pass.
4. Do not revert unrelated modifications.
5. If a touched file has mixed user/Codex changes, describe the Codex-owned hunk precisely.

COMMANDS:

```bash
git status --short
git diff -- <file>
```

SUCCESS CRITERIA: No user work is reverted or misattributed.

FAILURE HANDLING: Stop and inspect the file-level diff before making further edits.

OUTPUT: Clear final summary with changed files and known unrelated dirty files.
