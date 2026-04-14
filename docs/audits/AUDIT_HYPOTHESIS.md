# Codebase Audit — Hypothesis (Phase 1)
> Generated 2026-04-01

## Evidence Summary

Three parallel audits (Security, Performance, Code Quality) identified **50+ findings** across the codebase. Below are the **top 5 most influential improvements** ranked by production impact.

---

## Ranked Hypothesis List

### 1. CRITICAL — Missing `await` + Serial DB Writes in drillReviewService (Data Loss)

**File:** `lib/services/drillReviewService.ts:339-364`

`updateReviewOutcome()` is called **without `await`** — it's fire-and-forget. On Cloudflare Workers, the request context can close before the microtask completes, causing **silent data loss** on every drill submission. Additionally, `applyAttemptToUserStatistics` and `updateTimingAggregates` are awaited sequentially but are independent — should use `Promise.all`.

**Impact:** Intermittent loss of FSRS review outcomes in production + ~50ms unnecessary latency per drill submit.
**Verification:** Unit test that mocks the three calls and asserts all resolve before the function returns.

---

### 2. HIGH — Security Hardening (SQL Injection + Wildcard CORS + Error Leakage)

Three related security gaps:

**a) SQL Injection in `functions/api/questions/performance.ts:33-51`**
- `sortBy` and `order` from query params are validated only as `z.string().optional()` — no enum constraint
- `order` ternary emits raw SQL keyword; `limit` has no NaN/upper-bound guard after `parseInt`

**b) Wildcard CORS (`Access-Control-Allow-Origin: *`) on authenticated endpoints:**
- `functions/api/user/review-history.ts` — returns sensitive telemetry data
- `functions/api/user/update-fsrs-params.ts` — writes FSRS parameters
- `functions/api/questions/seeds/[id]/assemble.ts`, `staging/[id]/check.ts` — admin endpoints
- All should use `getCorsHeaders(request)` from `_shared/cors.ts`

**c) Stack traces / error.message leaked to clients:**
- `functions/api/drills/submit-review.ts:228`
- `functions/api/gemini/stream.ts:473-474`
- `functions/api/study/session-summary.ts:188-190`
- `functions/api/study/resolve-blueprint.ts:65-67`

**Impact:** Authenticated users can probe SQL structure; cross-origin attackers can read telemetry; error messages reveal DB schema.
**Verification:** Targeted tests for each fix (enum validation, CORS header assertions, generic error response checks).

---

### 3. HIGH — `derivedMetrics.ts` Hardcoded Zeros (Visible Bug)

**File:** `lib/dashboard/derivedMetrics.ts:102,123`

`today = 0` and `todayMs = 0` are hardcoded. The "Today" column in the dashboard **always shows zero** for every user. This feeds `useUnifiedStats` → `MenuView`, `SettingsStatsModal`, `CommandCenterHub`.

**Impact:** Every user sees incorrect "today" statistics. High visibility, quick fix.
**Verification:** Unit test asserting `today` and `todayMs` reflect actual session data when provided.

---

### 4. HIGH — Missing `select` on Hot-Path Prisma Queries (Performance)

Multiple Prisma queries fetch entire rows including large JSON fields when only a few columns are needed:

| File | Query | Issue |
|------|-------|-------|
| `drillReviewService.ts:583-590` | `userProgress.findUnique` | Fetches unbounded `reviewHistory Json[]` on every drill review |
| `routes/sync.ts:47-50` | 3× `findMany` | No `select`, no `take` limit — MB-scale payloads for active users |
| `routes/questions.ts:450-453` | `preGeneratedQuestion.findMany` | Fetches `questionData Json` for 3× requested rows |
| `routes/drugs.ts:27-29` | `drug.findMany` | All 40+ columns including multiple large Json fields |

**Also:** Missing compound index `@@index([userId, questionId, createdAt(sort: Desc)])` on `QuestionAttempt` for the dedup query that runs on every drill submit.

**Impact:** Excess data transfer on every API call; potential Cloudflare 128MB memory limit breach on sync endpoint.
**Verification:** Before/after query payload size measurement; index existence check in schema.

---

### 5. HIGH — Re-enable Excluded Tests (Testing Gap)

**File:** `vitest.config.ts` excludes 8 test files:
- `tests/useDrillFSRS.test.ts` (core FSRS hook)
- `tests/components/admin/**` (4 admin component tests)
- `tests/components/Goals/GoalsDashboard.test.tsx`
- `tests/components/offline/OfflineSyncIndicator.test.tsx`
- `hooks/game/use-mini-lab-drill.test.ts`, `use-photo-drill.test.ts`

The exclude comment says "re-enable after upgrading to v16+" but `@testing-library/react@16.3.0` is already installed. The TODO is stale — these tests are silently skipped in CI.

**Impact:** Core FSRS hook and admin components have no test coverage in CI. Regressions go undetected.
**Verification:** Remove excludes, run `npm test`, fix any failures.

---

## Additional Notable Findings (Deferred)

- **Duplicate Gemini SDKs:** Both `@google/generative-ai` (old) and `@google/genai` (new) in dependencies (~400KB combined). Consolidation recommended but requires touching 20+ files.
- **studyGroupService.ts:** 12 TODO stubs for DB operations. UI allows creating groups that are never persisted.
- **PatientEncounterMode.tsx:** 3612 lines — largest React component, maintenance liability.
- **HTML sanitizer bypass:** `lib/sanitizeHtml.ts` doesn't block `data:` URIs or encoded `javascript:` schemes.
- **Rate limiting fails open:** `middleware.ts:542-545` returns "not rate-limited" when KV binding is missing.
- **QuizView.tsx React performance:** ref.current in useEffect deps, useEffect with no deps array, string comparison in useMemo.
- **Unused packages:** `fsrs-browser`, `fsrs.js`, `@open-spaced-repetition/binding` — all in dependencies but never imported.
