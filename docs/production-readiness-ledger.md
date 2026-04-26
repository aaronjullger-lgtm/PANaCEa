# Production Readiness Ledger

Last updated: 2026-04-26

## Production Readiness Map

Production runtime:
- Frontend: React 19 + Vite routed through `App.tsx`, `config/AppRoutes.tsx`, `config/routeRegistry.ts`, and `components/layout/DrillViewRouter.tsx`.
- Production API: Cloudflare Pages Functions under `functions/api/`.
- Local-only API: Express routes under `routes/` and `server.ts`; not deployed.
- Data: PostgreSQL via Prisma Edge client in `functions/api/_shared/prisma-edge.ts`.
- Auth: Clerk middleware via `functions/api/_shared/middleware.ts` and client guards in `components/auth/`.
- Core study write paths: `/api/questions/attempt`, `/api/drills/submit-review`, `/api/drills/submit-reviews`, `/api/srs/submit`, `/api/osce/*`.

Critical user flows:
- Sign in and app shell access.
- Main adaptive study session.
- Drill modes: visual, specialty, question-practice, and clinical simulation drills.
- Generate, answer, explain, flag, and review questions.
- FSRS/progress persistence and offline sync.
- Analytics, dashboard, study path, content library, search, and clinical reference flows.
- OSCE/patient encounter creation, chat, completion, grading, analytics, and SPBench scoring.

## Current Baseline

- `npm run typecheck` initially failed before semantic checking because new OSCE API files had unterminated strings and escaped template literals.
- After syntax repair, full `tsc --noEmit` proceeds and reports a large pre-existing backlog across UI, API, Prisma contract drift, and service JSON typing.
- Worktree was already dirty at start; notable pre-existing changes include UI/theme files, Prisma OSCE schema/migration work, new OSCE API files, packages, and workers.

## Fixed In This Pass

- Added a private-beta launch-surface gate for the core study loop. Mode discovery and app navigation now hide mock-heavy or non-launch surfaces by default, while preserving developer route access behind a calm unavailable state.
- Applied the beta gate to the training menu, command palette, `/practice`, mode navigation, and drill router.
- Hardened `/api/questions/attempt` retries with stable client/offline idempotency keys, KV cache reuse when available, and deterministic primary-key dedupe when KV is absent.
- Repaired parse-breaking OSCE API files:
  - `functions/api/cron/osce-spbench-judge.ts`
  - `functions/api/osce/evaluate.ts`
  - `functions/api/osce/intent.ts`
  - `functions/api/osce/patient.ts`
- Aligned new OSCE writes with Prisma schema requirements:
  - added required IDs for `ClinicalIntentLog` and `SpbenchScore`
  - used `OsceSession.id` as the session key
  - switched duplicate-prone SPBench `create` calls to `upsert`
  - fixed `PatientEncounterSession` relation casing
- Removed production dummy-case fallback from `hooks/game/use-photo-drill.ts` navigation/reset paths so exhausted media queues do not silently show synthetic clinical cases.
- Repaired the photo drill hook test that encoded the old dummy-append behavior.
- Fixed a compile-blocking duplicate JSX `style` prop in `components/pages/DailyChallengesHub.tsx`.
- Fixed type-safe response envelope unwrapping for curated passages in:
  - `components/admin/CuratedPassageManager.tsx`
  - `components/panels/ExplanationPanel.tsx`
- Added persistent study-submission idempotency for the launch-critical FSRS write path:
  - `SubmissionIdempotency` Prisma model and migration
  - durable idempotency helper for Pages Functions
  - `/api/drills/submit-review` durable duplicate handling
  - `/api/drills/submit-reviews` per-item durable duplicate handling and first-login user bootstrap
  - stable attempt IDs when idempotency keys are present
- Tightened launch-critical mutation/session rate limits and added preview environment scaffolding in `wrangler.toml`.
- Extended backend environment validation to require documented production secrets and preview KV bindings.
- Added `docs/ROLLBACK-RUNBOOK.md` and refreshed `docs/PREVIEW-ENVS.md`.

## Verification

- Passed: `npm run test -- tests/privateBetaVisibility.test.ts functions/api/questions/attempt.test.ts services/core/attemptService.test.ts` — 3 files, 36 tests.
- Passed: targeted ESLint on touched files.
- Passed: `npm run env:check:backend`.
- Passed: `npm run build`; Sentry sourcemap upload warned because `sentry.io` DNS was unavailable locally, but Vite completed.
- Passed: `npx vitest run hooks/game/use-photo-drill.test.ts functions/api/osce/complete.test.ts` — 2 files, 51 tests.
- Passed: `npm run test -- functions/api/_shared/__tests__/submission-idempotency.test.ts functions/api/drills/submit-review.test.ts tests/submitReviewIdempotency.test.ts` — 3 files, 37 tests.
- Passed: `npm run typecheck`.
- Passed: `npm run lint` with existing warnings only.
- Passed: `npm run build:check-size`.
- Passed for touched slice: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit --pretty false 2>&1 | rg "components/(admin/CuratedPassageManager|panels/ExplanationPanel|pages/DailyChallengesHub)|functions/api/(cron/osce-spbench-judge|osce/(evaluate|intent|patient))|hooks/game/use-photo-drill"` returned no matching errors.
- Current deploy-focused typecheck is clean through `npm run typecheck`; broad legacy strict typecheck remains a post-beta ratchet.

## Open Production Blockers

- Full typecheck is not clean. First visible failures include:
  - Prisma schema/API drift in multiple endpoints and services
  - JSON/null typing issues in cron and analytics services
  - unknown JSON response typing across client service layers
- Several production-facing features still have mocks/placeholders:
  - OSCE intent/patient/evaluate endpoints are deterministic mocks rather than Gemini-backed agents.
  - Photo drill had production placeholders; navigation fallback is fixed, but upstream media inventory still needs real data coverage.
  - Social/study group services are mock/hidden and should remain hidden until API-backed.
  - Some toolkit/admin generation actions are explicit "coming soon" surfaces.
- E2E smoke coverage exists but uses older `/?view=` routes in `e2e/all-modes.spec.ts`; canonical mode routes now live under `/modes/...` and `/core-adaptive`.
- Preview/staging isolation is scaffolded but not operator-complete; beta cannot invite real users until preview DB, Clerk, KV/cache IDs, Gemini quota, and Sentry environment separation are verified.
- Persistent duplicate protection now exists for `/api/drills/submit-review` and `/api/drills/submit-reviews`, but the migration requires review before production deploy.

## Next Batches

1. Repair canonical all-modes smoke coverage to use current routes.
2. Fix high-impact typecheck blockers that directly affect study/session/drill routes.
3. Replace OSCE deterministic mocks with the existing authenticated AI endpoint/service pattern.
4. Add targeted tests for the new OSCE intent/patient/evaluate endpoints.
5. Run full typecheck, build, and selected Playwright smoke once blockers are reduced.
