# Audit 8 — Backend Endpoints, Service Layer Wiring, and API Correctness

**Date:** 2026-04-01
**Auditor:** Claude (Senior Full-Stack Engineer perspective)
**Scope:** Server entry points, API routes/endpoints, service modules, request validation, response schemas, auth checks, error handling, retries/timeouts, integration points with AI/DB/external services.
**Files Inspected:** ~35 files across `functions/api/`, `services/`, `hooks/`, `lib/services/`

---

## Executive Summary

PANaCEa's backend is a ~200-endpoint Cloudflare Pages Functions API. The middleware stack (`authenticatedEndpoint`, `publicEndpoint`, `adminEndpoint`) is well-composed and handles most cross-cutting concerns (auth, CORS, validation, rate limiting, error handling) correctly. However, several critical issues were found at audit time: an O(N)-unbounded aggregate query inside a transaction on every attempt submission, a user-ID type mismatch in the FSRS optimizer that silently produces null lookups, non-atomic sync operations with a data-loss window, and hard-cascading deletes on the Clerk webhook. The `questions/fetch` IDOR noted below has since been resolved (server-side user resolution). The middleware inconsistency between `authenticatedEndpoint` and `publicEndpoint` across content routes (flagged in Audit 7) extends across the full API surface and represents a systemic auth policy gap.

---

## Key Endpoint Table

| Endpoint | Method | Purpose | Caller | Validation | Auth | Failure Risk |
|---|---|---|---|---|---|---|
| `/api/questions/attempt` | POST | Record main-session answer + FSRS | `syncManager`, `attemptService` | Zod (body-wrapped) | `authenticatedEndpoint` | **HIGH** — O(N) aggregate |
| `/api/drills/submit-review` | POST | Record drill answer + FSRS | `useDrillFSRS` hook | Zod (body-wrapped) | `authenticatedEndpoint` | MEDIUM — OPTIONS bug |
| `/api/srs/submit` | POST | Legacy+FSRS SRS review | `srsService`, `SrsFlashcardView` | Zod (body-wrapped) | `authenticatedEndpoint` | MEDIUM — dual Prisma client |
| `/api/srs/due` | GET | Fetch due SRS items | `SmartReviewMode` | Zod (query-wrapped) | `authenticatedEndpoint` | LOW |
| `/api/questions/fetch` | POST | Fetch pre-generated questions | `questionApi`, `sessionService` | Zod (flat) | `authenticatedEndpoint` | LOW — IDOR resolved; production/linkage filters |
| `/api/study/session/generate` | POST | Generate study session | `useSessionGenerator`, SDK | Zod (body-wrapped) | `authenticatedEndpoint` | MEDIUM — reservoir fallback |
| `/api/drills/smart-review` | GET | Due FSRS items + question hydration | `QuickReviewMode` | Zod (empty) | `authenticatedEndpoint` | LOW |
| `/api/questions/session` | GET | Session question setup | `QuizView` | Zod | `authenticatedEndpoint` | MEDIUM — user retry loop |
| `/api/questions/generate` | POST | AI question generation | `sessionService` | Zod | `authenticatedEndpoint` | MEDIUM — Gemini dependency |
| `/api/sync` | POST | 3-way merge sync | `syncManager` | Zod (body-wrapped) | `authenticatedEndpoint` | **HIGH** — non-atomic |
| `/api/user/profile` | GET/PUT | User profile CRUD | `ProfilePage` | Zod | `authenticatedEndpoint` | LOW |
| `/api/user/preferences` | GET/POST/PATCH/DELETE | Preferences CRUD | `SettingsPage` | Zod | `authenticatedEndpoint` | LOW |
| `/api/user/progress-map` | GET | FSRS retrievability map | `ClinicalReferenceLibrary` | Zod (query) | `authenticatedEndpoint` | LOW |
| `/api/user/fsrs-params` | GET/POST | FSRS optimizer | `SettingsPage` | Manual | Raw auth | **HIGH** — ID mismatch |
| `/api/content/library` | GET | Clinical library browse | `ClinicalReferenceLibrary` | Zod (query) | `authenticatedEndpoint` | LOW |
| `/api/content/condition/[id]/details` | GET | Condition detail | `SmartConditionView` | Zod (params) | **`publicEndpoint`** ⚠️ | MEDIUM — auth gap |
| `/api/content/condition/[id]/summary` | GET | Condition summary | `ConditionCard` | Zod (params) | **`publicEndpoint`** ⚠️ | MEDIUM — auth gap |
| `/api/content/search` | GET | Unified search | `SearchBar` | Zod (query) | **`publicEndpoint`** ⚠️ | LOW |
| `/api/drugs/library` | GET | Drug library browse | `DrugReferenceLibrary` | Zod (query) | `authenticatedEndpoint` | MEDIUM — hasSome bug |
| `/api/osce/session` | POST | Create OSCE session | `OSCEMode` | Zod (body) | `authenticatedEndpoint` | LOW |
| `/api/osce/chat` | POST | Save OSCE messages | `OSCEChat` | Zod (body) | `authenticatedEndpoint` | LOW |
| `/api/osce/complete` | POST | Complete OSCE session | `OSCEComplete` | Zod (body) | `authenticatedEndpoint` | LOW |
| `/api/gemini/stream` | POST | AI streaming (SSE) | `useGeminiStream` | Zod + size check | Raw auth | LOW — well-handled |
| `/api/dashboard/stats` | GET | Dashboard metrics | `DashboardPage` | Zod | `authenticatedEndpoint` | MEDIUM — mixed IDs |
| `/api/webhooks/clerk` | POST | User lifecycle | Clerk | Svix signature | Webhook verify | **HIGH** — cascade delete |
| `/api/debug/god-mode` | GET | Admin diagnostics | Admin panel | None | Raw auth (no RL) | MEDIUM — no rate limit |
| `/api/cron/replenish-pool` | POST | Question pool check | Scheduler | Bearer CRON_SECRET | Cron secret | LOW |
| `/api/cron/aggregate-analytics` | POST | Daily stats rollup | Scheduler | Bearer CRON_SECRET | Cron secret | LOW |
| `/api/cron/nightly-health-check` | POST | Content health | Scheduler | Bearer token | Cron secret | LOW |

---

## Top 15 Findings

### Finding 1 — IDOR in `questions/fetch` (client-supplied userId) — **RESOLVED**
- **Severity:** CRITICAL (at time of audit)
- **Type:** Security
- **File:** `functions/api/questions/fetch.ts`
- **Original root cause:** The schema accepted a client-supplied `userId` and used it to query `UserQuestionSeen` without comparing against `auth.userId`.
- **Resolution (2026-06):** `userId` was removed from `QuestionFetchSchema`. The handler resolves the internal user ID from the Clerk JWT via `resolveUserByClerkId()`. See `docs/api/API_OVERVIEW.md` for the current contract.
- **Blocks Production:** No — fixed.

### Finding 2 — O(N) Unbounded Aggregate Query per Attempt Submission
- **Severity:** HIGH
- **Type:** Performance / Scalability
- **File:** `functions/api/questions/attempt.ts` (inside `$transaction`)
- **Root Cause:** Every call to `/api/questions/attempt` runs a `findMany({ where: { userId } })` inside a Prisma `$transaction` to compute aggregate stats (total attempts, correct count, accuracy). This fetches **every attempt the user has ever made**. For a student who has answered 5,000 questions, this is 5,000 rows loaded into memory on every single answer submission.
- **User Impact:** Response latency grows linearly with user history. After months of study, submissions could take 2–5 seconds. On Cloudflare Edge with CPU time limits, this risks timeouts at scale.
- **Recommended Fix:** Replace the `findMany` + client-side aggregation with a `prisma.$queryRaw` using `COUNT(*)` and `SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END)`. Or maintain a rolling aggregate table (UserSystemStats) updated via increment operations.
- **Blocks Production:** Not immediately, but degrades rapidly with usage.

### Finding 3 — User ID Type Mismatch in FSRS Optimizer
- **Severity:** HIGH
- **Type:** Bug
- **File:** `functions/api/user/fsrs-params.ts:323–326, 390–417`
- **Root Cause:** The POST handler correctly resolves `userId` (internal UUID) via `resolveUserByClerkId()` and uses it for review queries and the upsert `where` clause. However, line 323 fetches `previousParams` using `auth.userId` (Clerk ID like `user_2abc...`), not the internal UUID. Since `PersonalizedFSRSParams.userId` stores the internal UUID, this lookup **always returns null**. The upsert on line 390 also uses `auth.userId` in the `where` clause — which means the first optimization creates a record keyed to the Clerk ID, and subsequent optimizations may create duplicates or fail silently depending on unique constraints.
- **User Impact:** Previous params comparison always shows no prior optimization. The upsert may write to the wrong key, causing the GET handler (which correctly uses internal UUID) to never find the optimized params.
- **Recommended Fix:** Replace `auth.userId` with `userId` (the resolved internal ID) on lines 323 and 390–417.
- **Blocks Production:** YES — FSRS optimization results may be silently lost.

### Finding 4 — Non-Atomic Sync with Data Loss Window
- **Severity:** HIGH
- **Type:** Data Integrity
- **File:** `functions/api/sync.ts` (SRS items merge logic)
- **Root Cause:** The sync endpoint uses a delete-then-insert pattern: `deleteMany` existing SRS items, then `createMany` new items. These are separate Prisma operations, not wrapped in a `$transaction`. If the `createMany` fails (Accelerate timeout, connection drop, Edge CPU limit), the user's SRS items are deleted but not recreated — permanent data loss.
- **User Impact:** On transient failure during sync, a user's entire SRS deck can be wiped. The sync endpoint has retry logic for the overall operation, but the individual delete-then-insert is not atomic.
- **Recommended Fix:** Wrap the `deleteMany` + `createMany` in a `prisma.$transaction([...])`. Alternatively, use `upsert` in a loop (slower but atomic per item). The `BATCH_SIZE = 25` is already well-chosen for Cloudflare's 50-subrequest limit, so the transaction should fit.
- **Blocks Production:** Not daily, but a single Accelerate hiccup during sync could be catastrophic.

### Finding 5 — Hard Cascade Delete on Clerk Webhook
- **Severity:** HIGH
- **Type:** Data Integrity
- **File:** `functions/api/webhooks/clerk.ts:~130–150`
- **Root Cause:** The `user.deleted` webhook event calls `prisma.user.delete({ where: { clerkId } })`. If the Prisma schema has `onDelete: Cascade` on relations, this deletes all QuestionAttempts, ReviewLogs, UserProgress, SRSItems, OSCE sessions, etc. — the user's entire learning history.
- **User Impact:** If a user accidentally deletes their Clerk account (or an admin purges), all study data is irrecoverably lost. There is no soft-delete, no grace period, no backup.
- **Recommended Fix:** Replace hard delete with soft delete: `prisma.user.update({ where: { clerkId }, data: { deletedAt: new Date(), status: 'deleted' } })`. Add a 30-day retention cron that permanently deletes soft-deleted users. Alternatively, check if cascade is even configured — if not, the delete may fail silently (which the endpoint already catches).
- **Blocks Production:** Not blocking daily operation, but one event away from catastrophic data loss.

### Finding 6 — `drills/submit-review` OPTIONS Handler Bug
- **Severity:** MEDIUM
- **Type:** Bug
- **File:** `functions/api/drills/submit-review.ts` (OPTIONS export)
- **Root Cause:** The `onRequestOptions` export wraps the OPTIONS handler inside `authenticatedEndpoint`, which requires a valid JWT. Browser CORS preflight requests (OPTIONS) do not include auth headers. This means **every cross-origin POST to `/api/drills/submit-review` will fail on preflight** unless the browser is same-origin.
- **User Impact:** If the frontend is ever served from a different origin (e.g., staging subdomain, preview deploy), all drill submissions fail silently.
- **Recommended Fix:** Change to `export const onRequestOptions = withCors();` — the same pattern used by every other endpoint.
- **Blocks Production:** Only affects cross-origin scenarios (staging, preview deploys).

### Finding 7 — Dual FSRS + Leitner Scheduling in `questions/attempt`
- **Severity:** MEDIUM
- **Type:** Technical Debt / Redundancy
- **File:** `functions/api/questions/attempt.ts`
- **Root Cause:** The attempt endpoint runs both `scheduleConceptReview()` (legacy Leitner-based scheduling via SRSItem table) AND FSRS v6 updates (via UserTopicProgress). Both write scheduling data to different tables for the same question. The CLAUDE.md states Leitner is deprecated, but the code still runs both paths.
- **User Impact:** No direct user impact, but doubles the write load per submission and creates confusion about which scheduling data is authoritative. If a question appears in both the SRS due list and the FSRS review queue, the user may review it twice.
- **Recommended Fix:** Remove the `scheduleConceptReview()` call from `questions/attempt.ts`. If Leitner is still needed as a fallback, gate it behind `if (!fsrsEnabled)`.
- **Blocks Production:** No.

### Finding 8 — `srs/submit` Creates Duplicate Prisma Client
- **Severity:** MEDIUM
- **Type:** Resource Leak
- **File:** `functions/api/srs/submit.ts:87–99`
- **Root Cause:** When `attemptId` is provided, the handler creates a **second** Prisma client (`prismaForAttempt`) to look up the attempt, then disconnects it immediately. This is unnecessary — the handler already has a Prisma client (`prisma`). Creating a second instance on every Ghost Grader path wastes a connection pool slot and increases Accelerate subrequest count.
- **User Impact:** Increased latency and potential connection exhaustion under load.
- **Recommended Fix:** Reuse the existing `prisma` client for the attempt lookup.
- **Blocks Production:** No.

### Finding 9 — Rate Limiting Fails Open
- **Severity:** MEDIUM
- **Type:** Security / Resilience
- **File:** `functions/api/_shared/middleware.ts` (`withRateLimit`)
- **Root Cause:** When the `RATE_LIMIT_KV` namespace is unavailable (not bound, KV outage), the rate limiter returns `{ allowed: true }` — all requests pass through. This is a deliberate design choice for development, but in production it means a KV outage removes all rate limiting.
- **User Impact:** During a KV outage, the API is unprotected against abuse. The Gemini streaming endpoint (`/api/gemini/stream`) has its own rate limiter that also fails open.
- **Recommended Fix:** Add an in-memory fallback rate limiter (simple token bucket per isolate) that activates when KV is unavailable. This won't be distributed but provides basic protection.
- **Blocks Production:** No, but leaves the system vulnerable during KV outages.

### Finding 10 — `fsrs-params` Uses Raw Auth Instead of Middleware Stack
- **Severity:** MEDIUM
- **Type:** Inconsistency / Security
- **File:** `functions/api/user/fsrs-params.ts`
- **Root Cause:** Unlike most endpoints that use `authenticatedEndpoint()`, this file manually calls `authenticateRequest()`, `validateFunctionEnv()`, and `createSuccessResponse()` / `createErrorResponse()`. It bypasses the middleware stack's rate limiting, error handling wrapper, env check, and structured logging.
- **User Impact:** No rate limiting on the POST endpoint (FSRS optimization is CPU-intensive). No structured error logging. Inconsistent response shape (uses `createSuccessResponse` wrapper vs `{ data: ... }` pattern).
- **Recommended Fix:** Migrate to `authenticatedEndpoint()` with a lower rate limit (e.g., 10/min for POST). Use the standard `{ data: ... }` response shape.
- **Blocks Production:** No.

### Finding 11 — `toResponse` Serialization Ambiguity
- **Severity:** MEDIUM
- **Type:** Architecture
- **File:** `functions/api/_shared/middleware.ts` (`toResponse` function)
- **Root Cause:** The `toResponse` serializer extracts `result.data ?? result` as the JSON body. When an error handler returns `{ error: 'msg', status: 500, data: { content: [], count: 0 } }`, the serializer sends `{ content: [], count: 0 }` as the body with status 500. The `error` field is lost. Conversely, when a handler returns `{ data: { error: 'msg' }, status: 404 }`, the client receives `{ error: 'msg' }` — ambiguous between success-with-error-field and actual error.
- **User Impact:** Frontend code must defensively check both `response.error` and `response.data.error`, leading to inconsistent error handling across the codebase.
- **Recommended Fix:** Standardize error responses: always return `{ success: false, error: string, error_code: string }` for errors, `{ success: true, data: ... }` for success. Add a `isError` flag to the middleware result type.
- **Blocks Production:** No.

### Finding 12 — OSCE Session ID is Predictable
- **Severity:** LOW
- **Type:** Security
- **File:** `functions/api/osce/session.ts:81`
- **Root Cause:** Session IDs are generated as `osce-${user.id.slice(0, 8)}-${Date.now()}`. This is a concatenation of the first 8 chars of the user's internal UUID and a millisecond timestamp — both are low-entropy and guessable.
- **User Impact:** An attacker who knows a user's ID prefix and approximate session creation time could guess session IDs. The ownership check on `chat` and `complete` endpoints mitigates this, but it's defense in depth.
- **Recommended Fix:** Use `crypto.randomUUID()` for session IDs.
- **Blocks Production:** No.

### Finding 13 — Cron Endpoints Use Inconsistent Auth Patterns
- **Severity:** LOW
- **Type:** Inconsistency
- **File:** `functions/api/cron/*.ts`
- **Root Cause:** Cron endpoints authenticate via `Bearer ${env.CRON_SECRET}` header comparison. The `nightly-health-check.ts` only checks `authHeader.includes('Bearer')` without comparing the actual token value — any `Bearer` token would pass.
- **User Impact:** The health check cron could be triggered by anyone who can reach the endpoint with a Bearer header.
- **Recommended Fix:** Use the same `auth !== Bearer ${env.CRON_SECRET}` pattern across all cron endpoints.
- **Blocks Production:** No.

### Finding 14 — `preferences` POST/PATCH Schema Duplication
- **Severity:** LOW
- **Type:** Technical Debt
- **File:** `functions/api/user/preferences.ts:23–121`
- **Root Cause:** `UserPreferencesSchema` and `PartialPreferencesSchema` are near-identical copies (~100 lines each). The POST schema has all fields optional (same as PATCH). There is no behavioral difference between POST and PATCH in terms of validation.
- **User Impact:** None directly, but schema drift risk — if a new preference field is added to one schema and forgotten in the other.
- **Recommended Fix:** Define one `PreferencesFieldsSchema` with all optional fields. Use `.required()` on specific fields for POST if needed, or just use one schema for both.
- **Blocks Production:** No.

### Finding 15 — `questions/session` Dead Code and User Retry Loop
- **Severity:** LOW
- **Type:** Code Quality
- **File:** `functions/api/questions/session.ts`
- **Root Cause:** After returning a 503 for user-not-found, there is dead code `placeholderUserId = -1` that was commented out but the retry loop (3 attempts with `1s * attempt` backoff) still runs. The retry is well-intentioned (Clerk webhook may not have fired yet) but the 3-second max wait is on the Edge CPU clock.
- **User Impact:** First-time users may experience 1–3 second latency on their first session request while the retry loop waits for the Clerk webhook to create their user record.
- **Recommended Fix:** Clean up dead code. Consider a synchronous user auto-creation fallback (like `sync.ts`'s `resolveUserId`) instead of polling.
- **Blocks Production:** No.

---

## 3 Highest-Leverage Fixes

### Fix 1: Patch the IDOR in `questions/fetch` — **DONE (2026-06)**

**Status:** Implemented. `userId` removed from schema; handler uses `resolveUserByClerkId(prisma, auth.userId)`. Current contract documented in `docs/api/API_OVERVIEW.md`.

### Fix 2: Fix the FSRS Optimizer ID Mismatch (15 minutes)

**Why:** FSRS parameter optimization results are silently lost — the optimizer writes to the wrong key and the reader never finds it.

**Steps:**
1. In `functions/api/user/fsrs-params.ts`, line 323: change `where: { userId: auth.userId }` to `where: { userId }` (the resolved internal ID).
2. Line 390 (upsert): change `where: { userId: auth.userId }` to `where: { userId }`.
3. Line 362 (in-process optimizer call): already passes `auth.userId` but should pass `userId`. Verify `runFullOptimization` uses this as a key.

### Fix 3: Replace O(N) Aggregate with SQL Count (45 minutes)

**Why:** Every answer submission gets slower as the user studies more. This is the #1 scalability bottleneck in the hot path.

**Steps:**
1. In `functions/api/questions/attempt.ts`, locate the `findMany({ where: { userId } })` inside the transaction.
2. Replace with:
   ```typescript
   const [stats] = await prisma.$queryRaw<[{ total: bigint; correct: bigint }]>`
     SELECT COUNT(*) as total,
            SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END) as correct
     FROM "QuestionAttempt"
     WHERE "userId" = ${userId}
   `;
   ```
3. If system-level stats are needed, add `GROUP BY "system"` and adjust accordingly.
4. Remove the JavaScript-side aggregation loop.

---

## Minimal Safe Implementation Plan

### Day 1 (Critical Security + Data Integrity)
1. **Patch IDOR** in `questions/fetch.ts` (Fix 1)
2. **Fix ID mismatch** in `fsrs-params.ts` (Fix 2)
3. **Fix OPTIONS handler** in `drills/submit-review.ts` — change to `withCors()`
4. **Fix nightly-health-check auth** — add actual token comparison

### Day 2 (Performance + Resilience)
5. **Replace O(N) aggregate** in `questions/attempt.ts` (Fix 3)
6. **Wrap sync delete+insert** in `$transaction` in `sync.ts`
7. **Remove duplicate Prisma client** in `srs/submit.ts`

### Day 3 (Safety + Cleanup)
8. **Soft-delete webhook** — replace `user.delete` with `user.update({ deletedAt })` in `webhooks/clerk.ts`
9. **Remove dual Leitner scheduling** from `questions/attempt.ts`
10. **Migrate `fsrs-params.ts`** to `authenticatedEndpoint()` middleware stack

### Day 4 (Polish)
11. **Deduplicate preferences schemas** in `user/preferences.ts`
12. **Use `crypto.randomUUID()`** for OSCE session IDs
13. **Add in-memory fallback rate limiter** for KV outage resilience
14. **Standardize error response shape** across middleware

---

## Architecture Notes

### Middleware Stack — Well Designed
The `withMiddleware()` composition pattern is solid. The convenience stacks (`authenticatedEndpoint`, `publicEndpoint`, `adminEndpoint`, `refineryEndpoint`) correctly layer: CORS → ErrorHandling → EnvCheck → Auth → RateLimit → Validation → Logging → Handler. The `toResponse` serializer is the main rough edge — its `result.data ?? result` extraction creates ambiguity.

### Prisma Edge Singleton — Correct but Fragile
The singleton pattern keyed by normalized DATABASE_URL is the right approach for Cloudflare isolate reuse. However, `safePrismaDisconnect()` is called in `finally` blocks everywhere despite the singleton being reused — this is harmless (Prisma Accelerate handles reconnection) but misleading. The real concern is the singleton cache using a module-level Map that grows unbounded if DATABASE_URL ever varies per-request (unlikely but possible with env overrides).

### Auth Patterns — Three Incompatible Approaches
1. **Middleware stack** (`authenticatedEndpoint`) — correct, used by ~90% of endpoints
2. **Raw auth** (`authenticateRequest` directly) — used by `fsrs-params.ts`, `gemini/stream.ts`, `debug/god-mode.ts` — bypasses rate limiting and structured error handling
3. **Webhook auth** (Svix signature) — correct for webhooks

The raw auth pattern should be eliminated in favor of the middleware stack.

### Response Shape — Inconsistent
Three response patterns coexist:
1. `{ data: { success: true, ... } }` → serialized as `{ success: true, ... }`
2. `{ error: 'msg', status: 404 }` → serialized as `"msg"` (string body)
3. `{ data: { error: 'msg' }, status: 500 }` → serialized as `{ error: 'msg' }`

Frontend callers must handle all three, which they do inconsistently.

---

## What to Audit Next

**Audit 9 — Admin Panel, Content Refinery, and Internal Tooling**
- The `admin/`, `refinery/`, and `debug/` endpoints represent the content management surface. These endpoints have elevated privileges and modify production data. Key concerns: authorization checks, bulk operation safety, audit logging of admin actions, content validation before publish.
- Files: `functions/api/admin/**`, `functions/api/debug/**`, `functions/api/compliance/**`, admin React components.
