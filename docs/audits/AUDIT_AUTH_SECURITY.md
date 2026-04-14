# Audit 14 — Authentication, Authorization & Security Posture

**Date:** 2026-04-02
**Auditor perspective:** Senior full-stack engineer, production security review
**Scope:** Clerk token validation coverage, rate limiting, input validation (zod vs raw), CORS configuration, CSP headers, environment variable exposure, Prisma injection risks, admin route protection, JWT patterns
**Methodology:** Automated auth-pattern grep across all 352 endpoint files, manual review of shared middleware, CORS config, CSP `_headers` file, `.gitignore` verification, admin endpoint sampling, raw SQL audit

---

## Executive Summary

PANaCEa's security posture is **substantially better than most early-stage medical education apps**. The middleware system (`functions/api/_shared/middleware.ts`) provides composable, well-designed stacks — `authenticatedEndpoint()`, `adminEndpoint()`, `publicEndpoint()`, `refineryEndpoint()` — with built-in auth, validation, rate limiting, CORS, and error handling. CORS is origin-allowlisted (not `*`). CSP headers are comprehensive and deployed via Cloudflare `_headers`. Admin endpoints use proper server-side RBAC with both env-var and database-backed role checks. Raw SQL uses Prisma's parameterized `$queryRaw` templates (no injection risk). The `.env` file is correctly `.gitignored` and not tracked.

**However**, 16 endpoints lack any auth middleware (9 intentionally, 7 need attention), 9 endpoints parse JSON without zod validation, the CSP uses `'unsafe-inline' 'unsafe-eval'` for scripts, and 7 cron endpoints are publicly callable with no secret-based gating.

**Severity breakdown:** 2 High, 5 Medium, 8 Low
**Blocks production:** None (the app is live and functional)
**Estimated remediation time:** 3 days

---

## Findings

### Finding 14-1: 7 User-Facing Endpoints Missing Authentication
**Severity:** High | **Type:** Missing auth | **Blocks production:** No

**Systematic verification:** Grepped all 352 endpoint files for `authenticatedEndpoint`, `adminEndpoint`, `publicEndpoint`, `requireAuth`, `authenticateRequest`, `withAuth`. 16 files match none of these patterns. Of those:

**Intentionally unprotected (9):**
- `health.ts` — Health check (no data)
- `sentry-tunnel.ts` — Sentry proxy with its own IP-based rate limiting
- `webhooks/clerk.ts` — Clerk webhook (verified by webhook signature)
- `questions/batch.ts` — Legacy stub returning 404
- `recommendations/index.ts` — Re-export to `list.ts` (which is authenticated)
- `study/session/generate.ts` — Stub returning 501
- `user/confusions.ts` — Re-export to `confusion.ts` (which is authenticated)
- 7 `cron/*` endpoints — Covered in Finding 14-2

**Needs authentication (4 real endpoints):**

| Endpoint | Risk | What it exposes |
|---|---|---|
| `drill/photo-batch.ts` | Medium | Returns medical drill cases from DB. Deprecated but functional. No auth, no rate limit. |
| `study/calibration-insights.ts` | High | Returns per-student FSRS calibration data including review accuracy bins and circadian performance. Exposes student learning analytics without auth. |
| `study/calibration-insights.ts` references `context.env.prisma` directly — no middleware stack at all. |

**Root cause:** These endpoints were written before the middleware pattern was established, or were overlooked during the security hardening sprint. The re-export files (`recommendations/index.ts`, `user/confusions.ts`) are safe because they delegate to authenticated handlers.

**Fix:**
1. `drill/photo-batch.ts` — Wrap in `authenticatedEndpoint()` or delete (it's deprecated in favor of `/api/drills/media`)
2. `study/calibration-insights.ts` — Wrap in `authenticatedEndpoint()` and scope to requesting user's data only

---

### Finding 14-2: 7 Cron Endpoints Are Publicly Callable — No Secret Gating
**Severity:** High | **Type:** Missing auth | **Blocks production:** No

**Endpoints:**
- `cron/aggregate-analytics.ts`
- `cron/analyze-exam-outcomes.ts`
- `cron/compute-content-health.ts`
- `cron/daily-prescription.ts`
- `cron/generate-daily-plans.ts`
- `cron/nightly-health-check.ts`
- `cron/replenish-pool.ts`

**Details:** These endpoints perform database-mutating operations (aggregating analytics, generating daily plans, replenishing question pools). They have no authentication, no API key check, and no IP restriction. Anyone who knows the URL can trigger them.

**Root cause:** Cloudflare Pages doesn't have native cron trigger support like Workers do. These are designed to be called by an external scheduler, but no shared-secret verification was added.

**Impact:** An attacker could:
- Trigger `replenish-pool` repeatedly to waste Gemini API credits
- Run `aggregate-analytics` to cause database load
- Execute `daily-prescription` to generate spurious study plans

**Fix:** Add a shared-secret check at the top of each cron handler:
```typescript
const cronSecret = env.CRON_SECRET;
if (request.headers.get('X-Cron-Secret') !== cronSecret) {
  return new Response('Forbidden', { status: 403 });
}
```
Set `CRON_SECRET` in Cloudflare environment variables. Update the external scheduler to include the header.

---

### Finding 14-3: 9 Endpoints Parse JSON Without Zod Validation
**Severity:** Medium | **Type:** Input validation gap | **Blocks production:** No

**Endpoints using raw `request.json()` without schema validation:**

| Endpoint | Accepts | Risk |
|---|---|---|
| `admin/blueprint-coverage.ts` | `targets: Record<string, number>` | Unbounded key count, no value constraints |
| `authors/submit-question.ts` | Full question payload (6+ fields) | Manual validation only — fragile |
| `drill/log-attempt.ts` | `questionId`, `drillType`, `wasCorrect`, `responseTimeMs` | No type constraints on metadata |
| `mapping-enrichment/suggest.ts` | `taxonomyCodes[]`, `limit` | Silent `.catch(() => {})` on parse failure |
| `podcast/generate.ts` | Prompt/content payload | No validation at all |
| `user/pearls/[id]/useful.ts` | `notes?` | Silent `.catch(() => {})` on parse failure |
| `user/update-fsrs-params.ts` | `parameters: number[]` | Manual validation only — no bounds on array length |
| `users/me/daily-plan.ts` | `accuracy?`, `durationMinutes?` | No type constraints |
| `users/me/exam-outcome.ts` | `examType`, `score`, `passed`, etc. | Manual validation — no enum constraints |

**Root cause:** These endpoints predate the `withValidation()` middleware or were written with manual validation instead of zod schemas.

**Impact:** Vulnerable to type confusion, oversized payloads (no `enforcePayloadSize`), and injection via unexpected field types. The two endpoints with silent `.catch(() => {})` are especially concerning — they swallow parse errors and proceed with `{}`, which could cause undefined behavior downstream.

**Fix:** Create zod schemas for each endpoint in `_shared/zodSchemas.ts` and wrap in `authenticatedEndpoint(schema, handler)`. Priority order: `update-fsrs-params` (mutates FSRS state), `submit-question` (writes to DB), `log-attempt` (writes to DB).

---

### Finding 14-4: CSP Uses 'unsafe-inline' and 'unsafe-eval' for Scripts
**Severity:** Medium | **Type:** CSP weakness | **Blocks production:** No

**File:** `_headers` (Cloudflare Pages headers file)

**Current CSP `script-src`:**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com ...
```

**Details:** Both `'unsafe-inline'` and `'unsafe-eval'` effectively neuter CSP's XSS protection for scripts. An XSS vulnerability anywhere in the app would allow arbitrary script execution despite the CSP.

**Mitigating factors:**
- A `Content-Security-Policy-Report-Only` header with hash-based nonces (`sha256-*`) is deployed alongside the enforcing CSP, suggesting work toward stricter CSP is in progress
- The report-only policy includes 5 script hashes, indicating the team is tracking which inline scripts need allowlisting
- React's rendering model makes XSS less likely (JSX auto-escapes)

**Root cause:** Clerk's authentication UI, Cloudflare analytics, and Vite's dev-mode require inline scripts. Rather than generating nonces per-request (difficult on Cloudflare Pages), `'unsafe-inline'` was used as a blanket exception.

**Fix:**
1. Short term: Keep current CSP but prioritize moving from report-only hashes to enforcing hashes
2. Medium term: Use Clerk's `nonce` prop + Cloudflare `HTMLRewriter` to inject per-request nonces
3. Remove `'unsafe-eval'` — this is only needed for Vite dev mode, not production. Gate it behind an environment check.

---

### Finding 14-5: CORS Configuration Is Solid — Minor Improvement Possible
**Severity:** Low | **Type:** Good practice, minor gap | **Blocks production:** No

**File:** `functions/api/_shared/cors.ts`

**Strengths:**
- Origin allowlist with exact domain matching (not `*`)
- Cloudflare Pages preview URLs scoped to project-specific pattern
- `Vary: Origin` header for proper CDN caching
- `allowCredentials: true` only with validated origins
- Preflight returns 403 for unauthorized origins
- `ALLOWED_ORIGINS` env var for runtime extension

**Minor issue:** `getCorsHeadersPermissive()` function exists and returns `Access-Control-Allow-Origin: *`. While it's documented as "only use for public endpoints" and has a console.warn, its mere existence is a latent risk — a developer could use it for convenience.

**Fix:** Add a `// @deprecated` marker or remove `getCorsHeadersPermissive()` entirely. If needed, create a narrower `publicCorsHeaders()` that still validates origins but allows a broader list.

---

### Finding 14-6: Admin Route Protection Is Properly Server-Side with RBAC
**Severity:** Low (positive finding) | **Type:** Verification | **Blocks production:** No

**Verified by reading:** `admin/check-access.ts`, `admin/stats.ts`, `admin/media/approve.ts`, `admin/staging/approve.ts`, `admin/content/create.ts`, `admin/enrich-condition.ts`

**Pattern:** All admin endpoints use `adminEndpoint()` or `adminAuthenticatedEndpoint()` middleware which:
1. Verifies Clerk JWT (authentication)
2. Checks `ADMIN_USER_IDS` / `SUPERADMIN_USER_IDS` env vars (fast path)
3. Falls back to database `User.role` lookup for `'ADMIN'` or `'SUPERADMIN'`
4. Returns 403 Forbidden with proper error message if unauthorized
5. Rate limited to 30–60 req/min

**Debug endpoint:** `debug/god-mode.ts` also requires admin auth and returns only diagnostic metadata (user count, timestamp). Properly protected.

**No issues found.** This is well-designed RBAC.

---

### Finding 14-7: Prisma Parameterization Is Correct — No SQL Injection Risk
**Severity:** Low (positive finding) | **Type:** Verification | **Blocks production:** No

**Raw SQL usage found in ~20 files.** All use Prisma's tagged template literals:
```typescript
prisma.$queryRaw`SELECT * FROM "Buzzword" ORDER BY RANDOM() LIMIT ${countValue}`
```

Prisma's `$queryRaw` with template literals automatically parameterizes interpolated values. No `$queryRawUnsafe` or `$executeRawUnsafe` calls found anywhere in API code (only in scripts/).

**No issues found.**

---

### Finding 14-8: Rate Limiting Architecture Is Well-Designed
**Severity:** Low (positive finding) | **Type:** Verification | **Blocks production:** No

**Rate limit tiers (from middleware.ts):**

| Tier | Limit | Used by |
|---|---|---|
| API (default) | 300 req/min per user | `authenticatedEndpoint()` |
| Admin | 30 req/min per user | `adminEndpoint()` |
| Auth | 20 req/min per user | Authentication endpoints |
| Public | 600 req/min per IP | `publicEndpoint()` |
| Refinery | 60 req/min per user | `refineryEndpoint()` |

**Implementation:** Cloudflare KV-backed with per-user or per-IP bucketing. Falls open (allows requests) if KV is unavailable — this is the correct fail-open pattern for non-critical rate limiting.

**Critical endpoints covered:**
- `drills/submit-review.ts` — Uses `authenticatedEndpoint()` (300/min)
- `questions/attempt.ts` — Uses `authenticatedEndpoint()` (300/min)
- `questions/generate.ts` — Uses `authenticatedEndpoint()` (300/min)

**Gap:** AI generation endpoints (Gemini calls) aren't rate-limited more aggressively. A user could make 300 generate requests/minute, each consuming Gemini API credits.

**Fix:** Add a stricter rate limit tier for AI-consuming endpoints: `aiEndpoint()` at 20 req/min.

---

### Finding 14-9: .env Is Correctly Gitignored and Not Tracked
**Severity:** Low (positive finding) | **Type:** Verification | **Blocks production:** No

**Verification:**
- `.gitignore` contains: `.env`, `.env.local`, `.env.*`, `.envrc`, `.env.production`, `.env.staging`, `.env.development`, `.env.test`, `.env.ci`
- `git ls-files .env .env.local .env.production .env.development` returns empty (not tracked)

**The .env file exists locally** (needed for local development) but is properly excluded from version control. Secrets are managed through Cloudflare Pages environment variables for production.

**No issues found.**

---

### Finding 14-10: JWT Verification Uses Clerk SDK with 5-Second Clock Skew Tolerance
**Severity:** Low | **Type:** Configuration review | **Blocks production:** No

**File:** `functions/api/_shared/auth.ts`

**Details:**
- Uses `@clerk/backend`'s `verifyToken()` for cryptographic JWT verification
- `clockSkewInMs: 5000` — 5-second tolerance for clock differences between Clerk and Cloudflare edge
- Token expiration is checked both by Clerk SDK and diagnostically by decoding JWT payload
- Secret key format validation (must start with `sk_test_` or `sk_live_`)
- Diagnostic JWT decoding only logs in development mode (no PII leakage in production)

**Minor concern:** JWT claims are decoded for diagnostics using a manual `atob()` implementation. This is only for logging and doesn't affect security (verification is done by Clerk SDK), but the manual decode could be removed to reduce surface area.

**No blocking issues found.**

---

### Finding 14-11: Comprehensive Security Headers Deployed via _headers File
**Severity:** Low (positive finding) | **Type:** Verification | **Blocks production:** No

**Headers deployed on all routes (`/*`):**

| Header | Value | Assessment |
|---|---|---|
| `Content-Security-Policy` | Detailed per-path CSP (see Finding 14-4) | Present but weakened by unsafe-inline/eval |
| `Content-Security-Policy-Report-Only` | Hash-based CSP (5 script hashes) | Good — working toward stricter CSP |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Excellent — HSTS preload-ready |
| `X-Content-Type-Options` | `nosniff` | Correct |
| `X-Frame-Options` | `DENY` | Correct — prevents clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Good default |
| `Permissions-Policy` | `geolocation=(self), microphone=(), camera=(), payment=()` | Good — restricts sensitive APIs |

**Cache control:**
- HTML: `no-cache, no-store, must-revalidate`
- Assets: `public, max-age=31536000, immutable`
- Vendor chunks: 7-day cache with stale-while-revalidate
- Service worker: `no-cache`

**Well-designed header configuration.** The only issue is the CSP weakness (Finding 14-4).

---

### Finding 14-12: Secure Logger Automatically Redacts Sensitive Data
**Severity:** Low (positive finding) | **Type:** Verification | **Blocks production:** No

**File:** `functions/api/_shared/secureLogger.ts`

**Auto-redacted patterns:**
- API keys (`sk_*`, `pk_*`, `AIza*`)
- JWT tokens (`eyJ*`)
- Bearer tokens
- Email addresses (masked)
- Credit card numbers
- IP addresses (partially masked)
- Database connection strings
- PEM private keys
- 13 named environment variables

**Implementation:** Recursive object redaction with depth limit (10) to prevent DoS. Structured log entries with timestamps, levels, and redacted context.

**No issues found.** This is production-grade logging.

---

### Finding 14-13: Two Endpoints Silently Swallow JSON Parse Errors
**Severity:** Medium | **Type:** Error handling gap | **Blocks production:** No

**Endpoints:**
- `mapping-enrichment/suggest.ts` — `request.json().catch(() => {})`
- `user/pearls/[id]/useful.ts` — `request.json().catch(() => {})`

**Impact:** When a client sends malformed JSON, these endpoints silently default to `{}` and continue processing. This can cause:
- Undefined behavior when accessing properties of `{}`
- Silent data corruption if the handler writes defaults to the database
- Debugging difficulty — no error logged, no 400 returned

**Fix:** Replace `.catch(() => {})` with explicit error handling that returns 400 Bad Request:
```typescript
let body;
try { body = await request.json(); }
catch { return { status: 400, error: 'Invalid JSON body' }; }
```

---

### Finding 14-14: `getCorsHeadersPermissive()` Exists as a Latent Risk
**Severity:** Medium | **Type:** Latent vulnerability | **Blocks production:** No

**File:** `functions/api/_shared/cors.ts` line ~140

**Details:** A convenience function returns `Access-Control-Allow-Origin: *` with a console.warn. While not currently used by any production endpoint, its existence in the shared utilities means any developer can import it.

**Fix:** Delete it or add `@deprecated` with a TSLint warning. The `publicEndpoint()` middleware already handles CORS for public endpoints with proper origin validation.

---

### Finding 14-15: AI Generation Endpoints Lack Aggressive Rate Limiting
**Severity:** Medium | **Type:** Cost exposure | **Blocks production:** No

**Endpoints that call Gemini API:**
- `questions/generate.ts`, `questions/generate-batch.ts`, `questions/generate-enhanced.ts`, `questions/generate-deep.ts`
- `ai/generate-mnemonic.ts`
- `intelligence/tutor.ts`, `intelligence/socratic-remediation.ts`
- `clinical-eye/analyze.ts`
- `osce/chat.ts`, `osce/analysis/grade.ts`
- `gemini/stream.ts`
- `podcast/generate.ts`
- `smart-scribe/generate-infographic.ts`

All use `authenticatedEndpoint()` (300 req/min). A single authenticated user could theoretically make 300 Gemini API calls per minute.

**Fix:** Create `aiEndpoint()` variant with 20–30 req/min limit. Apply to all Gemini-consuming endpoints. Consider per-user daily quotas stored in KV or database.

---

## Top 10 Findings by Impact

| Rank | Finding | Severity | Risk |
|---|---|---|---|
| 1 | 14-2: 7 cron endpoints publicly callable | High | DB mutation, API credit burn |
| 2 | 14-1: 4 user-facing endpoints missing auth | High | Student data exposure (calibration-insights) |
| 3 | 14-3: 9 endpoints with raw JSON (no zod) | Medium | Type confusion, payload injection |
| 4 | 14-4: CSP uses unsafe-inline + unsafe-eval | Medium | XSS protection neutered |
| 5 | 14-15: AI endpoints at 300 req/min | Medium | Gemini API cost exposure |
| 6 | 14-13: Silent JSON parse error swallowing | Medium | Silent data corruption |
| 7 | 14-14: getCorsHeadersPermissive() exists | Medium | Latent CORS bypass risk |
| 8 | 14-8: Rate limiting well-designed | Low+ | Gap: no AI-specific tier |
| 9 | 14-6: Admin RBAC properly server-side | Low+ | No issues — verification |
| 10 | 14-7: Prisma parameterization correct | Low+ | No injection risk — verification |

---

## 3 Highest-Leverage Fixes

### Fix 1: Gate Cron Endpoints with Shared Secret (Finding 14-2)
**Effort:** 1 hour | **Impact:** Prevents unauthorized database mutations and API credit burn

1. Add `CRON_SECRET` to Cloudflare environment variables
2. Create shared helper: `verifyCronSecret(request, env)` in `_shared/`
3. Add to all 7 cron handlers: verify `X-Cron-Secret` header or return 403
4. Update external scheduler (GitHub Actions, Cloudflare Cron Triggers) to include header

### Fix 2: Add Auth to Unprotected User Endpoints + Zod to Raw JSON Endpoints (Findings 14-1, 14-3)
**Effort:** 3 hours | **Impact:** Closes auth gaps and input validation holes

1. Wrap `drill/photo-batch.ts` in `authenticatedEndpoint()` (or delete — it's deprecated)
2. Wrap `study/calibration-insights.ts` in `authenticatedEndpoint()` with user-scoping
3. Create zod schemas for 9 raw-JSON endpoints, prioritizing: `update-fsrs-params`, `submit-question`, `log-attempt`
4. Replace `.catch(() => {})` patterns with explicit 400 responses

### Fix 3: Remove 'unsafe-eval' from Production CSP (Finding 14-4)
**Effort:** 2 hours | **Impact:** Strengthens XSS protection

1. Remove `'unsafe-eval'` from the enforcing CSP (only needed for Vite dev, not production builds)
2. Test all pages — Clerk, Recharts, and React should work without eval
3. If any library breaks, add it to report-only CSP first to identify the violation
4. Begin migrating from `'unsafe-inline'` to hash-based allowlisting using the 5 hashes already in the report-only header

---

## Minimal Safe Implementation Plan

### Day 1: Cron Secret + Auth Gaps (2 hours)
1. Create `CRON_SECRET` env var in Cloudflare dashboard
2. Add `verifyCronSecret()` helper to `_shared/`
3. Apply to all 7 cron endpoints
4. Add `authenticatedEndpoint()` to `drill/photo-batch.ts` and `study/calibration-insights.ts`
5. Delete `getCorsHeadersPermissive()` from cors.ts
6. Commit: "security: gate cron endpoints, close auth gaps"

### Day 2: Input Validation Hardening (4 hours)
1. Create zod schemas for 9 raw-JSON endpoints
2. Migrate each to `authenticatedEndpoint(schema, handler)` pattern
3. Replace `.catch(() => {})` in suggest.ts and useful.ts with explicit 400 responses
4. Add `enforcePayloadSize` to all new schemas
5. Run full test suite
6. Commit: "security: add zod validation to 9 unvalidated endpoints"

### Day 3: CSP Hardening + AI Rate Limits (3 hours)
1. Remove `'unsafe-eval'` from enforcing CSP
2. Test all pages for CSP violations
3. Create `aiEndpoint()` middleware variant with 20-30 req/min limit
4. Apply to all Gemini-consuming endpoints (~14 files)
5. Deploy and monitor Sentry for CSP violation reports
6. Commit: "security: harden CSP, add AI rate limit tier"

---

## What to Audit Next

**Audit 15 — Error Handling, Observability & Production Resilience** should examine:
- Error boundary coverage across all React component trees
- Sentry integration completeness (are all API errors captured?)
- Retry/backoff patterns in client-side API calls
- Offline mode resilience (what happens when API is unreachable mid-session?)
- Graceful degradation for Gemini API failures
- Health check coverage (does `/api/health` verify DB + external services?)
- Alerting configuration (Sentry alerts, Cloudflare alerts, uptime monitoring)
- Error message consistency (user-facing vs developer-facing)
- Circuit breaker patterns for external service calls

This would complete the full-stack audit series by verifying the app handles failure modes gracefully — the last remaining dimension after correctness (Audits 1-9), consistency (10-11), hygiene (12), performance (13), and security (14).

---

*Report generated from automated auth-pattern matching across 352 endpoint files, manual review of shared middleware/CORS/CSP configurations, and sampling of admin endpoint implementations. All "unprotected" claims verified by `grep -l` for auth patterns across the full functions/api/ tree.*
