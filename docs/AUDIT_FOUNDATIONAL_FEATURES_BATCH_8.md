# Audit: Foundational Features — Batch 8

**Date:** February 2026  
**Scope:** Shared utilities: notifications, cache (cache.ts, kv-cache, semantic-cache), rate limiter, RBAC, error-handler, env-validation.

---

## 1. Notifications

**Status:** ✅ Stub (functional for wiring)

- **Location:** `functions/api/_shared/notifications.ts`
- **Exports:** `FlagResolvedNotification`, `AdminFlagNotification`, `sendFlagResolvedNotification()`, `sendAdminFlagNotification()`.
- **Behavior:** Both send functions are stubs: they `console.log` and return `true`. Comments state that in production an HTTP-based email service (Resend, SendGrid, Postmark) should be used; nodemailer is not supported in Edge.
- **Gap:** None for audit. To enable real email: implement HTTP calls to chosen provider and set env (e.g. `RESEND_API_KEY`).

---

## 2. Cache (cache.ts, kv-cache, semantic-cache)

**Status:** ✅ Functional

- **cache.ts** (`functions/api/_shared/cache.ts`): KV cache utilities. Exports `CACHE_CONFIG` (TTL and PREFIX for condition, question_pool, user_stats, drug, guideline, system, metrics). `getFromCache<T>(kv, key, prefix)` and `setInCache(kv, key, value, ttl, prefix)`; `trackCacheMetric(kv, 'hit'|'miss'|'error')` for metrics. Edge-safe (KV namespace only).
- **kv-cache.ts** (`functions/api/_shared/kv-cache.ts`): Higher-level KV cache service. Defines `CACHE_KEYS`, default/short/long TTL. Caches high-yield condition data, system lists, drug/lab reference, user stats. Uses `CloudflareEnv.CACHE`; no Node APIs.
- **semantic-cache.ts** (`functions/api/_shared/semantic-cache.ts`): In-memory/simple semantic cache for question matching. `CacheQuery` (queryText, questionType, system?, difficulty?); tokenize + similarity (Jaccard); `normalizeMedicalTerms()` for term normalization. `SIMILARITY_THRESHOLD = 0.85`. Used to avoid duplicate or near-duplicate question generation. Edge-safe (no fs/Node).
- **Gap:** None. KV bindings (`CACHE`, `RATE_LIMIT_KV`) must be configured in Pages/Workers for cache and rate limit to work in production.

---

## 3. Rate limiter

**Status:** ✅ Functional

- **Location:** `functions/api/_shared/rateLimiter.ts`
- **Exports:** `RATE_LIMITS` (gemini, questions, standard, auth, admin, veo with maxRequests and windowSeconds), `RateLimitType`, `RateLimitResult`, `RateLimitHeaders`, `createRateLimiter(env)`, `getRateLimitIdentifier(request, auth?)`, `withRateLimit(handler, type?)`.
- **Behavior:** Uses in-memory sliding window when KV not bound; with `RATE_LIMIT_KV` uses KV for distributed limiting. Used by veo/generate, vision/analyze, and other expensive endpoints. Returns 429 with `Retry-After` when exceeded.
- **Gap:** None. For multi-instance production, bind `RATE_LIMIT_KV` so limits are global.

---

## 4. RBAC

**Status:** ✅ Functional

- **Location:** `functions/api/_shared/rbac.ts`
- **Types:** `UserRole`: user | viewer | editor | approver | admin | superadmin. `ROLE_HIERARCHY` for numeric comparison.
- **Exports:** `isAdmin(role)`, `canViewCMS(role)`, `canEditContent(role)`, `canApproveContent(role)`, `canPublishContent(role)`, `canManageRoles(role)`, `hasRole(userRole, requiredRole)`, `isValidRole(role)`.
- **Usage:** Admin endpoints (e.g. content-audit, platform-stats) use `User.role` from DB and call `isAdmin(role)` before proceeding.
- **Gap:** None. Role must be stored on User (e.g. Prisma `User.role`) and set by sync/admin.

---

## 5. Error-handler

**Status:** ✅ Functional

- **Location:** `functions/api/_shared/error-handler.ts`
- **Exports:** `APIError` (statusCode, code, details), `AuthenticationError` (401), `AuthorizationError` (403), `ValidationError` (400), `NotFoundError` (404), `RateLimitError` (429), `ErrorContext`, `ErrorResponse`. Middleware: `withErrorHandling(fn)` wraps handlers and returns consistent JSON error responses with CORS. Logging and requestId/timestamp for monitoring.
- **Usage:** Used by middleware stack (e.g. `withErrorHandling()` in podcast/generate and other endpoints). Ensures no raw stack traces or HTML in API responses.
- **Gap:** None. Aligns with project rule: "API routes must always return structured JSON errors."

---

## 6. Env-validation

**Status:** ✅ Functional

- **Location:** `functions/api/_shared/env-validation.ts`
- **Exports:** `ENV_REQUIREMENTS` (DATABASE, GEMINI, AUTH, STORAGE, FULL_STACK arrays of var names), `MissingEnvError` (missingVars, toResponse()), `validateFunctionEnv(env, requiredVars)`.
- **Behavior:** `validateFunctionEnv(context.env, ['DATABASE_URL', 'GEMINI_API_KEY'])` throws `MissingEnvError` if any var is missing; `toResponse()` returns 500 JSON with optional `details.missing` in development. Docs note DATABASE_URL should use Supabase pooler or Prisma Accelerate for Edge.
- **Usage:** Called at top of handlers in veo/generate, vision/analyze, and other Gemini/env-dependent endpoints.
- **Gap:** None. Ensures fail-fast with clear messages; avoids Node `process.env` in Edge (uses context.env).

---

## Summary

| # | Feature | Status | Notes |
|---|--------|--------|-------|
| 1 | Notifications | ✅ Stub | Email stubs; wire to Resend/SendGrid/Postmark for production |
| 2 | Cache (cache, kv-cache, semantic-cache) | ✅ | KV and in-memory; Edge-safe |
| 3 | Rate limiter | ✅ | In-memory or KV; used by veo, vision, etc. |
| 4 | RBAC | ✅ | Role hierarchy; isAdmin, canViewCMS, etc. |
| 5 | Error-handler | ✅ | APIError types; withErrorHandling middleware |
| 6 | Env-validation | ✅ | validateFunctionEnv; MissingEnvError |

No code fixes required this batch. All shared utilities are Edge-safe and used consistently across audited endpoints.
