# Backend Optimization Plan — PANaCEa

**Date:** 2026-04-02
**Scope:** API performance, FSRS pipeline integrity, security hardening
**Approach:** 5 high-impact improvements, scoped to minimize risk

---

## Phase 1: FSRS Pipeline NaN Guard (Critical — Data Integrity)

**Problem:** `deriveContinuousRating()` in `lib/implicit-metrics.ts` (line 238) does not validate that `timeToFirstClick` or `totalDwellTime` are finite numbers. If the client sends `NaN`, `undefined` coerced to number, or negative values, `NaN` propagates through the entire penalty/bonus chain. `Math.max(1.0, Math.min(4.0, NaN))` returns `NaN` — the clamp does NOT catch it. This `NaN` grade flows into `fsrs.next()`, corrupting the card's stability and difficulty permanently.

**Fix:** Add input sanitization at the top of `deriveContinuousRating()`:
```typescript
// Sanitize inputs — NaN propagation would corrupt FSRS card state
const safeTimeToFirstClick = Number.isFinite(metrics.timeToFirstClick) && metrics.timeToFirstClick > 0
  ? metrics.timeToFirstClick : (metrics.parTimeMs ?? 30000);
const safeDwellTime = Number.isFinite(metrics.totalDwellTime) && metrics.totalDwellTime > 0
  ? metrics.totalDwellTime : safeTimeToFirstClick;
const safeSwitches = Number.isFinite(metrics.answerSwitches) && metrics.answerSwitches >= 0
  ? Math.floor(metrics.answerSwitches) : 0;
```
Also add a final NaN guard before returning:
```typescript
if (!Number.isFinite(grade)) grade = metrics.isCorrect ? 3.0 : 1.0;
```

**Files:** `lib/implicit-metrics.ts` (lines 238-314)
**Risk:** Minimal — adds guards without changing the happy-path math
**Verification:** Unit test with NaN, Infinity, negative, and 0 inputs

---

## Phase 2: FSRS Race Condition Guard (Critical — Data Integrity)

**Problem:** `drillReviewService.ts` (lines 734-741) calls `updateUserProgressWithHistory()` which does a read-then-write on `UserProgress`. If two submissions for the same condition arrive within milliseconds (e.g., rapid drill completion), the second read sees stale FSRS state and overwrites the first update's result.

**Fix:** Wrap the FSRS update block (lines 620-780) in a Prisma interactive transaction with serializable isolation:
```typescript
await prisma.$transaction(async (tx) => {
  // All FSRS reads and writes use tx instead of prisma
  const existingCard = await tx.userProgress.findUnique(...);
  // ... FSRS calculation ...
  await tx.userProgress.upsert(...);
  await tx.reviewLog.create(...);
  await tx.card.upsert(...);
}, { isolationLevel: 'Serializable', timeout: 10000 });
```

**Files:** `lib/services/drillReviewService.ts` (lines 620-780)
**Risk:** Medium — transactions add latency (~5-15ms). If Prisma Accelerate doesn't support interactive transactions, fall back to optimistic locking with a version column.
**Verification:** Load test: submit 10 concurrent reviews for the same condition, verify no state corruption

---

## Phase 3: Query Performance — Select Clauses & Bounded Fetches (High — Latency)

**Problem:** Multiple endpoints fetch full row data when only a few columns are needed, and several have unbounded or excessively large `findMany` calls:

| Endpoint | Issue | Line(s) |
|----------|-------|---------|
| `/api/user/stats.ts` | `take: 5000` with all columns | 145 |
| `/api/sync.ts` GET | 3 × unbounded `findMany` (no `take`) | 283-287 |
| `/api/intelligence/profile.ts` | `take: 2000` wrong attempts, then N+1 question lookups | 172-192 |
| `/api/questions/pool.ts` | Unbounded `userQuestionSeen.findMany` | ~167 |

**Fixes:**
1. **user/stats.ts line 145:** Add `select: { wasCorrect: true, system: true, timeSpentMs: true, mode: true, createdAt: true }`, reduce `take` to 1000
2. **sync.ts GET lines 283-287:** Add `take: 2000` to all three queries, add `select` to return only client-needed fields
3. **intelligence/profile.ts lines 172-192:** Reduce `take` to 500, add `select: { questionId: true, system: true, questionType: true }`, batch the two question lookups into a single `Promise.all` with a combined ID set
4. **questions/pool.ts ~167:** Add `select: { questionId: true }` and `take: 5000` to `userQuestionSeen.findMany`

**Files:** 4 files listed above
**Risk:** Low — adding `select` and `take` only reduces data, doesn't change logic
**Verification:** Compare response schemas before/after to ensure no client breakage

---

## Phase 4: KV Caching for Expensive Endpoints (High — Latency)

**Problem:** Two of the most expensive endpoints have no caching:
- `/api/intelligence/profile.ts` — runs 4+ heavy queries including N+1 pattern, called on every dashboard load
- `/api/sync.ts` GET — fetches 3 full tables, called on every app open and periodic sync

**Fix:** Add KV-backed response caching (same pattern already used by `/api/user/stats.ts`):
```typescript
// At top of handler:
const cacheKey = `profile:${userId}`;
const cached = await getFromCache(env.CACHE, cacheKey);
if (cached) return { status: 200, data: cached, headers: { 'X-Cache': 'HIT' } };

// After computing response:
await setInCache(env.CACHE, cacheKey, responseData, 300); // 5 min TTL
```

Cache configuration:
- `/api/intelligence/profile.ts` → 300s TTL (concept gaps change slowly)
- `/api/sync.ts` GET → 15s TTL (short, prevents rapid re-fetches on flaky connections)

**Files:** `functions/api/intelligence/profile.ts`, `functions/api/sync.ts`
**Risk:** Low — cache miss path is identical to current behavior. Invalidation not needed at these TTLs.
**Verification:** Hit endpoint twice, confirm second request returns `X-Cache: HIT` header

---

## Phase 5: Rate Limiting on Write Endpoints (Medium — Security)

**Problem:** Several POST endpoints that write to the database or call the Gemini API have no rate limiting:
- `/api/drills/submit-review` — FSRS submission (DB writes + optional Gemini call)
- `/api/authors/submit-question` — question submission
- `/api/sentry-tunnel` — unauthenticated error proxy

An attacker with a valid session could exhaust DB connections or Gemini API quota.

**Fix:** Add `withRateLimit` to these endpoints using existing rate limiter infrastructure:
```typescript
// submit-review: 120 submissions per 15 min (8/min sustained, allows burst)
export const onRequestPost = authenticatedEndpoint(schema, handler, {
  rateLimit: { tier: 'authenticated', maxRequests: 120, windowSec: 900 }
});

// submit-question: 10 per hour
// sentry-tunnel: 60 per minute per IP (anonymous tier)
```

**Files:** `functions/api/drills/submit-review.ts`, `functions/api/authors/submit-question.ts`, `functions/api/sentry-tunnel.ts`
**Risk:** Low — rate limits are generous enough for normal usage
**Verification:** Exceed rate limit in test, confirm 429 response with Retry-After header

---

## Implementation Order

1. **Phase 1** (NaN guard) — Smallest change, highest data-integrity impact
2. **Phase 3** (select/take) — Broad performance win, no behavioral change
3. **Phase 4** (KV caching) — Biggest latency reduction for dashboard/sync
4. **Phase 5** (rate limiting) — Security hardening
5. **Phase 2** (transaction) — Most complex, needs Prisma Accelerate compatibility check

## Out of Scope (Documented for Future)

- Response payload compression (gzip is handled by Cloudflare CDN automatically)
- Prisma schema index additions (already completed in prior commit)
- `process.env` usage in edge functions (confirmed safe with `nodejs_compat` + compat date 2025-12-15)
- Sentry integration for edge functions (separate initiative)
