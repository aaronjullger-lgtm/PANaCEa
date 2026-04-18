# PANaCEa Backend Endpoint Audit

**Generated:** 2026-04-17
**Total endpoints scanned:** 406 `.ts` files under `functions/api/` (excluding `_shared/` and tests)

---

## Wrapper Coverage

| Wrapper | Count | Response shape | Auth | Rate limit | Notes |
|---|---:|---|---|---|---|
| `authenticatedEndpoint` | 269 | legacy flat `{ data }` / `{ error }` | Clerk | 300/min | Canonical stack |
| `adminAuthenticatedEndpoint` | 25 | same | Clerk + admin role | 60/min | |
| `aiEndpoint` | 15 | same | Clerk | **25/min** | Gemini hot paths |
| `publicEndpoint` | 33 | same | none | 600/min by IP | |
| `cmsEndpoint` | 5 | same | editor+ role | 60/min | |
| `refineryEndpoint` | 3 | same | approver+ role | 60/min | |
| raw `withAuth` | 8 | **divergent** | Clerk (inline) | none | Migrate |
| raw `authenticateRequest` | 3 | **divergent** | Clerk (inline) | none | Migrate |
| **None** | 22 | **divergent** | — | — | Includes cron, webhooks |

---

## Gaps (prioritized)

### P0 — Response envelope drift
Five helpers produce three shapes:
- `response.ts` → `{ success, data, timestamp }` / `{ success, error, message, timestamp, code?, details? }`
- `types.ts` → `{ success, data, timestamp }` / `{ success, error, details?, timestamp }`
- `error-handler.ts` → `{ error, message, statusCode, requestId, timestamp }`
- `middleware.ts toResponse()` → raw flat `data` or `{ error }`
- `auth.ts createErrorResponse/createSuccessResponse` → mimics a fourth variant

**Resolution:** Introduce `functions/api/_shared/api-response.ts` as single source of truth. Rewire `middleware.ts toResponse()` to use it. Deprecate (but keep as aliases) the others.

### P1 — Error codes scattered
`error-handler.ts` has class hierarchy (`APIError`, `AuthenticationError`, `ValidationError`, `NotFoundError`, `RateLimitError`) with codes. `enhancedMiddleware.ts` uses `@/lib/errors/appError`. Most handlers return ad-hoc strings.

**Resolution:** Publish stable error catalog (`error-catalog.ts`) with frozen code enum. Map existing classes to catalog.

### P1 — Trace ID not in body
`middleware.ts` generates `requestId` and sets `X-Request-ID` header but never propagates into JSON body. Consumers cannot correlate client-side errors with server logs without header introspection.

**Resolution:** Unified envelope must include `traceId` in body.

### P2 — Cron endpoints (15) have no shared auth layer
Cron endpoints accept external triggers but each implements its own bearer-check (or none at all). Two use Gemini. All use Prisma.

**Resolution:** Add `cronEndpoint(schema, handler)` stack that verifies `CRON_SECRET` header, has narrow rate limit, and uses unified envelope.

### P2 — 3 endpoints need auth, currently `wrappers=none`
- `functions/api/user/confusions.ts`
- `functions/api/recommendations/index.ts`
- `functions/api/questions/batch.ts`

### P3 — 8 endpoints using raw `withAuth`
Should migrate to `authenticatedEndpoint`:
`authors/dashboard.ts`, `knowledge/upload.ts`, `users/me/exam-readiness.ts`, `users/me/ab-assignments.ts`, `osce/history.ts`, `podcast/generate.ts`, `technique-check/analyze.ts`, `spark/instant-calc.ts`

### P3 — 3 endpoints using raw `authenticateRequest`
`ddx/smart-suggest.ts`, `user/pearls/daily.ts`, `ai/chat/stream.ts` (last is streaming — intentional).

### P3 — Three parallel rate-limit systems
- `rateLimiter.ts` (canonical, IPv6-aware, KV-aware) — 0 consumers of `withRateLimit()` from this file
- `middleware.ts` inline `checkRateLimit()` — 100% of `authenticatedEndpoint`-derived stacks
- `@/services/security/enhancedRateLimiter` (frontend-imported!) — used only by `enhancedMiddleware.ts`, which has **0 consumers**

**Resolution:** Mark `enhancedMiddleware.ts` deprecated. Consolidate on `rateLimiter.ts` + `middleware.ts` inline check backed by the same KV namespace.

---

## What's working well (do not touch)

- `auth.ts verifyAuthToken` — handles Clerk JWT, 5s clock skew, dual-signature, good diagnostics
- `cors.ts` — centralized allowlist, IPv6-safe preview URL regex, env override
- `env-validation.ts` — `validateFunctionEnv` preset system (DATABASE, FULL_STACK)
- `prisma-edge.ts` — singleton + `safePrismaDisconnect`
- `structuredLogger.ts` — `withStructuredLogging`, spans, Sentry fallback
- Endpoint stack composition (`withMiddleware` + composable middleware) is clean

---

## Deliverables from this sprint

- [x] `functions/api/_shared/api-response.ts` — unified envelope
- [x] `functions/api/_shared/error-catalog.ts` — stable error codes
- [x] `middleware.ts toResponse()` rewired through `api-response.ts`
- [x] Trace ID propagation into body
- [x] Tests in `functions/api/_shared/__tests__/`

## Follow-up sprints

- Migrate 22+8+3 endpoints to standard wrappers (~33 edits)
- Add `cronEndpoint()` stack + migrate 15 cron files
- Emit typed contracts from Zod schemas; generate `lib/apiClient.ts`
- Retire `enhancedMiddleware.ts` and its `@/services/security/*` imports (frontend path used server-side)
