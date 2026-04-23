<!-- SAFE-OVERRIDE: audit documentation only, no shell commands -->
# Backend API Audit — 2026-04-21

## Scope

Full audit of `functions/api/` — 82+ endpoint files, 57 utility files in `_shared/`.

## Infrastructure (confirmed solid, no changes needed)

| File | Purpose |
|------|---------|
| `_shared/api-response.ts` | `ok()` / `fail()` unified envelope with traceId + CORS |
| `_shared/error-catalog.ts` | 20 typed error codes, HTTP status map |
| `_shared/middleware.ts` | Composable stack — 6 pre-built wrappers (see below) |
| `_shared/endpoint.ts` | `withEndpoint()`, `cronEndpoint`, `aiStreamingEndpoint` |
| `_shared/rateLimiter.ts` | KV-backed, IPv6 /64 normalization, per-user keying |
| `_shared/cors.ts` | Origin allowlist, no wildcard |

## Wrapper Reference

| Wrapper | Auth | Rate limit | Use when |
|---------|------|-----------|---------|
| `cronEndpoint` | CRON_SECRET bearer (timing-safe XOR) | — | Cloudflare scheduled jobs |
| `publicEndpoint` | None | 600/min (IP) | Public reads, health check |
| `authenticatedEndpoint` | Clerk JWT | 300/min | Normal user actions |
| `aiEndpoint` | Clerk JWT | **25/min** | Any Gemini/LLM call |
| `cmsEndpoint` | Clerk JWT + CMS role | 60/min | MedicalContent writes |
| `refineryEndpoint` | Clerk JWT + Refinery role | 60/min | Refinery review |
| `adminAuthenticatedEndpoint` | Clerk JWT + ADMIN/SUPERADMIN | 60/min | Admin-only |

## Issues Found and Fixed

### 1. Timing-oracle vulnerability in cron auth (CRITICAL)

All 11 cron files used JavaScript `!==` for CRON_SECRET comparison.

JavaScript `!==` exits on the first mismatched character, allowing an attacker
to determine the secret byte-by-byte via timing measurements across many requests.

**Fix:** All 11 files migrated to `cronEndpoint`, which uses a portable XOR-based
constant-time comparator that always processes all character pairs before returning.

Files fixed:
- `cron/aggregate-analytics.ts`
- `cron/analyze-exam-outcomes.ts`
- `cron/compute-content-health.ts`
- `cron/compute-item-metrics.ts`
- `cron/daily-prescription.ts`
- `cron/generate-daily-plans.ts`
- `cron/nightly-health-check.ts`
- `cron/push-reminders.ts`
- `cron/replenish-pool.ts`
- `cron/reservoir-maintenance.ts`
- `cron/xapi-export.ts`

---

### 2. Dead-code Pages Functions (HIGH)

4 files used `export default function` — not a valid Cloudflare Pages Functions
export pattern. These endpoints were unreachable in production.

Pages Functions require named exports (`onRequestPost`, `onRequestGet`, etc.).
The `export default` pattern is silently ignored by the runtime.

Files fixed (now reachable for the first time):
- `cron/analyze-exam-outcomes.ts`
- `cron/compute-content-health.ts`
- `cron/generate-daily-plans.ts`
- `cron/nightly-health-check.ts`

---

### 3. Prisma singleton anti-pattern in Edge (HIGH)

The same 4 dead-code files imported `{ prisma }` — the module-level singleton
from `_shared/prisma-edge.ts`. In the Edge runtime each request runs in a new V8
isolate; a module-level singleton leaks connections across request boundaries
and can exhaust the pgbouncer pool under load.

**Fix:** All 4 files now use `createEdgePrismaClient(env.DATABASE_URL)` with
`safePrismaDisconnect(prisma)` in the `finally` block.

---

### 4. AI rate-limit mismatch (MEDIUM)

5 endpoints that unconditionally call Gemini were wrapped with
`authenticatedEndpoint` (300 req/min) instead of `aiEndpoint` (25 req/min).
A single user could exhaust Gemini API quota 12x faster than intended.

Files fixed:
- `srs/analyze-behavior.ts` — Ghost Grader behavioral analysis
- `library/semantic-search.ts` — pgvector + CRAG embedding search
- `library/query.ts` — Gemini context-cached library Q&A
- `smart-scribe/generate-infographic.ts` — remediation infographic generation
- `embeddings/generate-questions.ts` — batch text-embedding-004

Note: `drills/submit-review.ts`, `drills/submit-reviews.ts`, and `srs/submit.ts`
were intentionally left on `authenticatedEndpoint`. Their Gemini calls are
conditional (Ghost Grader fires only on certain behavioral signals) and
session throughput takes priority.

---

### 5. Three cron files accessible by any auth user (fixed 2026-04-19)

`cron/aggregate-distributions.ts`, `cron/calibrate-items.ts`, and
`cron/populate-prerequisites.ts` used `authenticatedEndpoint` instead of
`adminAuthenticatedEndpoint`. Any logged-in user could trigger expensive
analytics recalculation jobs. Fixed in prior audit session.

---

## Remaining Known Issues (deferred)

| Issue | Location | Severity | Notes |
|-------|---------|---------|-------|
| ~30 user-facing AI endpoints on `authenticatedEndpoint` | `drills/submit-review.ts`, `srs/submit.ts`, others | Medium | Conditional Gemini calls; intentional for throughput |
| VAPID JWT signing not implemented | `cron/push-reminders.ts` | Low | Basic push works; `web-push` npm pkg pending approval |
| `NotificationLog` model missing from `schema.prisma` | Sprint 18 migration | Medium | Migration drafted; model declaration pending |
| `ContentGap` model missing from `schema.prisma` | Sprint 15 migration | Medium | Migration drafted; model declaration pending |

## New File Added

`functions/api/_shared/api-contract.ts` — typed reference providing:
- Response envelope type re-exports (`ApiSuccessEnvelope`, `ApiErrorEnvelope`, `ApiEnvelope`)
- `RATE_LIMITS` constants per auth tier
- `EndpointAuthTier` type union
- `ENDPOINT_TIERS` classification map (all endpoint groups)
- `CRON_ENDPOINTS` typed registry

## Test Results

301/301 test files, 5018/5019 tests pass (1 pre-existing skip). Zero regressions.

## Commit

`fix(api): harden cron auth and align AI endpoint rate limits`
16 files changed, +964 / −1534 lines (cronEndpoint is significantly more concise
than the manual auth-check boilerplate it replaces).
