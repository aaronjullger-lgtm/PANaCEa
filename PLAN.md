# Audit Implementation Plan
> Created 2026-04-01 | Reference: AUDIT_HYPOTHESIS.md

## Status Key
- [ ] Not started
- [x] Complete & verified

---

## Improvement 1: Fix Missing `await` + Parallelize DB Writes in drillReviewService

**File:** `lib/services/drillReviewService.ts`
**Risk:** Critical — silent data loss in production

### Tasks
- [ ] **1a.** Write test: mock `updateReviewOutcome`, `applyAttemptToUserStatistics`, `updateTimingAggregates` — assert all three resolve before `submitDrillReview` returns
- [ ] **1b.** Add `await` to `updateReviewOutcome()` call at line ~339
- [ ] **1c.** Wrap `applyAttemptToUserStatistics` + `updateTimingAggregates` in `Promise.all()` (lines ~351-359)
- [ ] **1d.** Run test, confirm pass
- [ ] **1e.** Add `select` clause to `userProgress.findUnique` at line ~583 (only fetch `id`, `fsrsCard`, `nextReviewAt`, `lastReviewAt`, `totalReviews`, `correctReviews`)

---

## Improvement 2: Security Hardening

### 2A: SQL Injection Fix in performance.ts
**File:** `functions/api/questions/performance.ts`

- [ ] **2a-i.** Add enum validation: `sortBy: z.enum(['accuracy', 'attempts']).optional()`, `order: z.enum(['asc', 'desc']).optional()`, `limit: z.coerce.number().int().min(1).max(200).optional()`
- [ ] **2a-ii.** Verify the ternary for `order` only emits 'ASC' or 'DESC' (already does via `===` check, but now input is constrained)
- [ ] **2a-iii.** Add `parseInt` NaN guard for `limit` with fallback to 50

### 2B: Fix Wildcard CORS
**Files:** `functions/api/user/review-history.ts`, `functions/api/user/update-fsrs-params.ts`

- [ ] **2b-i.** Read `functions/api/_shared/cors.ts` to understand `getCorsHeaders` / `handleCorsPreflightSecure` API
- [ ] **2b-ii.** Replace hardcoded `'Access-Control-Allow-Origin': '*'` with `getCorsHeaders(request)` in `review-history.ts`
- [ ] **2b-iii.** Replace hardcoded CORS in `update-fsrs-params.ts`

### 2C: Sanitize Error Responses
**File:** `functions/api/drills/submit-review.ts`

- [ ] **2c-i.** Replace `details: error instanceof Error ? error.message : String(error)` with generic message at line ~228
- [ ] **2c-ii.** Add `console.error` for the full error before the generic response

---

## Improvement 3: Fix Hardcoded Zero Stats in derivedMetrics.ts

**File:** `lib/dashboard/derivedMetrics.ts`
**Risk:** High — every user sees "0" for today's stats

### Tasks
- [ ] **3a.** Read the full `deriveQuestionCounts` and `deriveStudyTime` functions to understand what data is available in their parameters
- [ ] **3b.** Write test: call `deriveQuestionCounts` with session data containing today's attempts, assert `today > 0`
- [ ] **3c.** Implement: compute `today` from the input data (filter attempts/sessions by today's date)
- [ ] **3d.** Implement: compute `todayMs` from the input data (sum session durations for today)
- [ ] **3e.** Run test, confirm pass

---

## Improvement 4: Add `select` to Hot-Path Prisma Queries

### 4A: sync.ts unbounded queries
**File:** `routes/sync.ts:47-50` (local dev route — check if also in `functions/api/`)

- [ ] **4a-i.** Locate the production sync endpoint (likely `functions/api/sync.ts`)
- [ ] **4a-ii.** Add `select` with only needed columns to all three `findMany` calls
- [ ] **4a-iii.** Add `take: 5000` safety limit

### 4B: Missing compound index
**File:** `prisma/schema.prisma`

- [ ] **4b-i.** Add `@@index([userId, questionId, createdAt(sort: Desc)])` to `QuestionAttempt` model
- [ ] **4b-ii.** Note: Do NOT run `prisma migrate` — just update the schema. Migration will be applied separately.

---

## Improvement 5: Re-enable Excluded Tests

**File:** `vitest.config.ts`

### Tasks
- [ ] **5a.** Remove test exclusions from vitest.config.ts (keep node_modules, e2e, temp_repos)
- [ ] **5b.** Run `npm test` and capture failures
- [ ] **5c.** Fix any test failures caused by React 19 / testing-library v16 compatibility
- [ ] **5d.** If a test is genuinely broken (not a compat issue), fix or skip with a specific reason comment
- [ ] **5e.** Final `npm test` — all tests pass

---

## Post-Implementation

- [ ] **6a.** Spawn review subagent to audit all changes
- [ ] **6b.** Update CLAUDE.md with any new patterns discovered
- [ ] **6c.** Delete AUDIT_HYPOTHESIS.md and PLAN.md
- [ ] **6d.** Create descriptive git commits
- [ ] **6e.** Push and deploy
