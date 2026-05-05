---
name: cf-edge-api
description: "Cloudflare Pages Functions API development for PANaCEa. Use for functions/api endpoints, auth/RBAC, validation, response envelopes, CORS preflight, rate limiting, Prisma lifecycle, env bindings, and debugging production API behavior."
---

# Cloudflare Edge API

`functions/api/` is production. `routes/` is legacy/local Express.

## First Files

- `functions/api/_shared/middleware.ts`
- `functions/api/_shared/endpoint.ts`
- `functions/api/_shared/api-response.ts`
- `functions/api/_shared/prisma-edge.ts`
- `functions/api/_shared/rateLimiter.ts`
- A nearby endpoint with the same auth level

## Stacks

- New simple endpoint: `withEndpoint()` from `_shared/endpoint.ts`.
- Existing explicit stacks: `authenticatedEndpoint`, `adminAuthenticatedEndpoint`, `aiEndpoint`, `publicEndpoint`, `cmsEndpoint`, `refineryEndpoint`.
- CORS preflight: export `onRequestOptions` with `handleCorsPreflightSecure`; do not wrap OPTIONS in auth.

## Rules

- Use `context.env` or wrapper-provided `env`, never `process.env` in deployed handlers.
- Use shared Zod schemas, often from `lib/api/schemas/*`, when client/server share the contract.
- Create Prisma with `createEdgePrismaClient(env.DATABASE_URL)` inside the request handler.
- Always `await safePrismaDisconnect(prisma)` in `finally` for handler-created clients.
- Do not trust client-supplied `userId`; resolve Clerk auth to internal user records with shared helpers.
- Public/AI/media/generation/search routes need explicit rate-limit review.
- Return wrapper-compatible envelopes unless streaming/raw `Response` is intentional.

## Tests

Cover auth, validation failures, missing env, CORS preflight, response envelope shape, Prisma disconnect, and idempotency for writes.

Useful references:

- `functions/api/_shared/__tests__/endpoint.test.ts`
- `functions/api/_shared/__tests__/middleware-auth.test.ts`
- `functions/api/_shared/__tests__/env-validation.test.ts`
- `functions/api/_shared/__tests__/submission-idempotency.test.ts`
