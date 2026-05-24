# Next Implementation Plan

> Last synchronized: 2026-05-23
> Based on: NEXT_WORK_DISCOVERY.md, CONTINUATION_IMPLEMENTATION_LOG.md, CHANGE_INTEGRATION_LOG.md, PRODUCTION_ACCEPTANCE_REPORT.md, UPDATED_PRODUCTION_READINESS_SCORECARD.md

## Priority Stack

Work items ordered by risk-to-launch × blocking status. Complete P0 before P1.

---

### P0 — Launch Blockers

#### 1. Live Cloudflare/Clerk/Postgres Runtime Smoke
**Severity:** P0 | **Effort:** Medium | **Owner:** panacea-deployment-guard

The production-smoke Playwright suite exists (`playwright.production-smoke.config.ts`, 4 tests) but has never been executed against a configured runtime with Clerk E2E credentials.

- [ ] Configure `E2E_CLERK_TEST_EMAIL` and `E2E_CLERK_TEST_PASSWORD` in runtime env
- [ ] Run `npm run dev:wrangler` + `npm run test:e2e:production-smoke`
- [ ] Verify auth, study launch, answer submission, review, session summary
- [ ] Verify `/api/health` returns 200
- [ ] Verify KV namespace bindings respond correctly

**Verification:** `BASE_URL=http://localhost:8788 npm run test:e2e:production-smoke` must pass all 4 specs.

#### 2. Canonical Question/Source Identity Migration
**Severity:** P0 | **Effort:** Large | **Owner:** panacea-identity-migration

Historical `QuestionAttempt` rows, `StudySession` question ID arrays, and `ReviewLog` records cannot be proven end-to-end without a `source` column distinguishing canonical `Question` IDs from `PreGeneratedQuestion` IDs.

- [ ] Run read-only DB probe on production-like data
- [ ] Design migration: add `source` column to `QuestionAttempt`, `ReviewLog`, `UserQuestionSeen`, `StudentReservoirItem`
- [ ] Draft backfill script
- [ ] FK/domain guard tests

**Verification:** Audit script output + migration plan approved by Aaron.

#### 3. Condition/Content Concept Identity Migration
**Severity:** P0 | **Effort:** Large | **Owner:** panacea-identity-migration

`UserProgress.conditionId` can still point at legacy condition domain concepts rather than canonical `MedicalContent` IDs. Progress correctness depends on this.

- [ ] Probe current `UserProgress` table for concept-domain mismatches
- [ ] Design `medicalContentId` migration
- [ ] Draft backfill script linking condition IDs to `MedicalContent.id`
- [ ] FK constraint tests

**Verification:** Progress aggregation tests must produce identical results before and after migration.

---

### P1 — Launch Quality

#### 4. Generated-Question Canonical Schema & Prompt Adapter
**Severity:** P1 | **Effort:** Medium | **Owner:** panacea-question-generation

Primary and RAG generation now share a preview/staging helper, but enhanced, deep, and batch/refill generation still use separate normalization, prompt, and staging contracts.

- [ ] Design canonical generated-question schema (unified Zod schema + prompt registry)
- [ ] Migrate enhanced generation onto shared schema (preserve CoVe gate, staging-first)
- [ ] Keep deep generation hidden/admin-only until canonical schema migration
- [ ] Wire batch/refill through shared adapter

**Verification:** Full generation-family test suite (5+ files, 16+ tests) remains green.

#### 5. StudyPlanTask V2 Consolidation
**Severity:** P1 | **Effort:** Medium | **Owner:** panacea-study-plan

The daily-plan contract remains split across `_shared/studyPlanService.ts`, local daily-plan compatibility, study-path, and launch-intent consumers.

- [ ] Define canonical `StudyPlanTask` type with version tag
- [ ] Consolidate task-mode normalization in one place
- [ ] Migrate multi-system/review tasks to explicit modes
- [ ] Add browser-level smoke when authenticated runtime is available

**Verification:** Study-plan launch/progress suite (4+ files, 12+ tests) remains green.

#### 6. QuizView Refactor — Parked Branch Resolution
**Severity:** P1 | **Effort:** Large | **Owner:** panacea-session-pipeline

`wip/quizview-refactor-parked` has 192 TypeScript errors. The main session UI component is 2,045 lines and needs state + button primitive rewiring.

- [ ] Audit current branch state
- [ ] Decide: finish refactor incrementally OR shelve and file improvement plan
- [ ] If continuing: phased sprints, 1-4 files per sprint, always verified

**Verification:** `npm run build` and `npm run test:critical` must pass after each sprint.

#### 7. Drill Routing Consolidation
**Severity:** P1 | **Effort:** Small | **Owner:** panacea-session-pipeline

Resolve the split between `DrillShell` (wrapper) and `useDrillFSRS` (hook). Decide which drill types consolidate.

- [ ] Audit current drill component wiring
- [ ] Decide canonical contract: wrapper-only, hook-only, or hybrid
- [ ] Consolidate without breaking FSRS integration

**Verification:** All drill tests pass after consolidation.

#### 8. Transactional Review Writes
**Severity:** P1 | **Effort:** Medium | **Owner:** panacea-fsrs-guardrails

`drillReviewService` writes `QuestionAttempt`, `ReviewLog`, and `UserProgress` in sequence but not atomically. A mid-write failure can create inconsistent state.

- [ ] Design transactional write contract
- [ ] Implement with Prisma interactive transactions or savepoint strategy
- [ ] Test partial-failure recovery paths

**Verification:** Single-writer and idempotency tests must not regress.

#### 9. Apply Pending Prisma Migrations (after Aaron approval)
**Severity:** P1 | **Effort:** Small | **Owner:** panacea-prisma-data-integrity

7 migrations drafted in `prisma/audit/` and `prisma/migrations/`. All have 0 orphan risks (verified 2026-04-17). Needs Aaron's approval.

- [ ] Get approval from Aaron
- [ ] Apply: `UserDailyInsight`, missing FKs, composite indexes
- [ ] Add model declarations for `ContentGap`, `NotificationLog` to `schema.prisma`
- [ ] Draft `banditState` migration on `UserPreferences`
- [ ] `prisma generate` to type the client

**Verification:** `npx prisma validate`, `npm run build`, `npm run test:critical`.

---

### P2 — Hardening

#### 10. Legacy SRS Compatibility Shell Removal
**Severity:** P2 | **Effort:** Small | **Owner:** panacea-repo-hygiene

`/api/srs/*` adapters delegate to `submitDrillReview`. Remove after browser/runtime compatibility is proven through live smoke.

- [ ] Prove no runtime clients depend on legacy SRS routes
- [ ] Remove adapters and `SRSItem` schema usage
- [ ] Migration-backed cleanup

**Verification:** Import census must show zero active `/api/srs/*` consumers.

#### 11. Design Token Migration
**Severity:** P2 | **Effort:** Medium | **Owner:** panacea-repo-hygiene

422 raw-color/design-token warnings in lint. Should be migrated to semantic tokens from `tailwind.config.js`.

- [ ] Baseline current warnings
- [ ] Replace raw hex with semantic token classes
- [ ] Reduce warning count iteratively

**Verification:** `npm run lint` warning count decreases per slice.

#### 12. Direct AI Call Cleanup (Vision/Image)
**Severity:** P2 | **Effort:** Small | **Owner:** panacea-content-refinery

All major AI routes now use the gateway. Remaining direct calls are in vision/image routes. Should be consolidated through gateway for consistent telemetry and fail-closed behavior.

**Verification:** `rg` for raw `fetch` calls to AI providers in `functions/api/` should return zero results outside known-safe backfill/evaluation utilities.

#### 13. Full Strict Typecheck Restore
**Severity:** P2 | **Effort:** Large | **Owner:** panacea-repo-hygiene

`typecheck:all` has 1,654 lines of historical drift across admin, cron, DDX, exam, and gamification surfaces. Track as backlog, not blocking.

**Verification:** Error count decreases per slice; final gate is `typecheck:all` passes.

---

### P3 — Improvement

#### 14. Chunk Splitting & Bundle Performance
**Severity:** P3 | **Effort:** Medium | **Owner:** panacea-repo-hygiene

Bundle size is at the rebaselined budget ceiling. Route-level splitting in `vite.config.ts` needs tuning.

- [ ] Analyze `dist/stats.html`
- [ ] Identify heaviest unsplit chunks
- [ ] Add `manualChunks` entries

**Verification:** `npm run build:check-size` should show headroom, not ceiling warnings.

#### 15. Expanded E2E Coverage
**Severity:** P3 | **Effort:** Large | **Owner:** panacea-regression-guard

- [ ] OSCE flow E2E
- [ ] PWA/offline regression suite
- [ ] Admin content management flows
- [ ] Optional modes and games

**Verification:** Incremental Playwright spec count increases.

#### 16. Blueprint Coverage Gap Fill (CV, PULM)
**Severity:** P3 | **Effort:** Medium | **Owner:** panacea-content-refinery

Under-represented PANCE blueprint areas need additional generated questions.

- [ ] Identify specific blueprint gaps in CV and PULM
- [ ] Generate questions through approved pipeline
- [ ] Validate clinical correctness through audit

**Verification:** Blueprint coverage report shows improved distribution.

---

## Implementation Order

```
P0: 1 (runtime smoke) → 2 (source identity) → 3 (concept identity)
P1: 4 (gen-question schema) → 5 (StudyPlanTask V2) → 6 (QuizView) → 7 (drill routing) → 8 (transactional writes) → 9 (pending migrations)
P2: 10 (SRS cleanup) → 11 (design tokens) → 12 (direct AI cleanup) → 13 (strict typecheck)
P3: 14 (bundle) → 15 (E2E) → 16 (blueprint gaps)
```

## Running Verification Cadence

Before declaring any slice complete:
1. Targeted Vitest for changed files
2. `NODE_OPTIONS="--max-old-space-size=4096" npm run typecheck`
3. `npm run lint` (0 errors, design-token warnings tracked separately)
4. `npm run build`
5. `git diff --check`
6. `npm run test:critical` when shared services/pipeline code changes
