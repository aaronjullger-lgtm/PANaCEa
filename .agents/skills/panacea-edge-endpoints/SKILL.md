---
name: "panacea-edge-endpoints"
description: "Use this skill when adding, fixing, reviewing, or testing PANaCEa production API endpoints in Cloudflare Pages Functions under functions/api. It covers the current middleware stacks, withEndpoint, auth/RBAC, Prisma lifecycle, env access, validation schemas, response envelopes, CORS preflight, rate limiting, and legacy Express confusion."
---

# PANaCEa Edge Endpoints

Use for production API work in `functions/api/`. `routes/` and `server.ts` are local/legacy Express only.

## First Files

- `CLAUDE.md`
- `functions/api/_shared/middleware.ts`
- `functions/api/_shared/endpoint.ts`
- `functions/api/_shared/api-response.ts`
- `functions/api/_shared/prisma-edge.ts`
- `functions/api/_shared/rateLimiter.ts`
- `functions/api/_shared/requestLogger.ts`
- A nearby endpoint with the same auth level and method

## Current Endpoint Stacks

- Prefer `withEndpoint()` from `_shared/endpoint.ts` for new simple endpoints.
- Existing endpoints often use stacks from `_shared/middleware.ts`:
  - `authenticatedEndpoint`
  - `adminAuthenticatedEndpoint`
  - `aiEndpoint`
  - `publicEndpoint`
  - `cmsEndpoint`
  - `refineryEndpoint`
- Use `handleCorsPreflightSecure` for explicit `onRequestOptions`; preflight must not require auth.
- Request schemas usually live in `lib/api/schemas/*` when shared with SDK/client code.

## Build Rules

1. Put deployed handlers in `functions/api/<route>.ts`.
2. Use Cloudflare Pages `onRequestGet/Post/Put/Delete/Options` exports.
3. Validate inputs with Zod through the wrapper or existing shared schema.
4. Use wrapper-provided `context.env`/`env`; never use `process.env` in deployed handlers.
5. Create Prisma inside the handler with `createEdgePrismaClient(env.DATABASE_URL)`.
6. Always `await safePrismaDisconnect(prisma)` in `finally` for handler-created clients.
7. Return wrapper-compatible `{ data }`, `{ status, error, code, details }`, or a real `Response` only when the endpoint intentionally streams or needs raw response control.

## Auth/RBAC Rules

- Default user data and writes to `authenticatedEndpoint` or `withEndpoint({ auth: 'user' })`.
- Admin routes use `adminAuthenticatedEndpoint` or `withEndpoint({ auth: 'admin' })`.
- CMS/refinery work should use `cmsEndpoint`/`refineryEndpoint` when the existing folder does.
- Do not trust client-supplied `userId`; resolve Clerk auth to the internal user with shared resolver helpers.
- Public endpoints need explicit rate-limit and data-exposure review.

## Tests

Cover:

- unauthenticated/authenticated/admin access
- validation failures
- missing env/binding failures
- CORS preflight when cross-origin browser calls are possible
- success envelope shape
- Prisma disconnect on success and error paths
- idempotency for submissions and state-changing writes

Useful references:

- `functions/api/_shared/__tests__/endpoint.test.ts`
- `functions/api/_shared/__tests__/middleware-auth.test.ts`
- `functions/api/_shared/__tests__/env-validation.test.ts`
- `functions/api/_shared/__tests__/submission-idempotency.test.ts`
- endpoint-local `*.test.ts` files near the changed route

## Common Traps

- Editing `routes/` and thinking production changed
- Requiring auth on `OPTIONS`
- Importing browser/client code into Edge handlers
- Returning raw thrown errors instead of envelope errors
- Missing `safePrismaDisconnect`
- Adding AI, generation, media, or search endpoints without rate limiting
