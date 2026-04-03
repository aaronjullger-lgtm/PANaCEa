---
name: cf-edge-api
description: "Cloudflare Pages Functions (Edge) API development patterns for PANaCEa. Use this skill whenever creating new API endpoints, modifying existing edge functions, debugging 500 errors on API routes, working with Prisma in edge runtime, handling CORS, rate limiting, authentication middleware, or any server-side code in the functions/api/ directory. Also trigger when the user mentions 'edge function', 'API endpoint', 'server route', 'Cloudflare worker', 'Pages Function', or asks about deploying backend code. If the user says 'create an endpoint' or 'add an API route', use this skill."
---

# Cloudflare Edge API Development

PANaCEa's production backend runs on Cloudflare Pages Functions — serverless edge functions with specific constraints that differ from Node.js servers. This skill covers the patterns, middleware, and gotchas for writing correct edge function endpoints.

## The Two-Backend Problem

The repo has TWO backend systems:

| Directory | Runtime | Purpose | Deployed? |
|-----------|---------|---------|-----------|
| `functions/api/` | Cloudflare Edge | Production API | YES |
| `routes/` | Express/Node.js | Local development | NO |

**All new endpoints go in `functions/api/`.** The `routes/` directory exists only for local development convenience with `npm run dev:server`.

## File-Based Routing

Cloudflare Pages Functions use file-based routing. The file path determines the URL:

```
functions/api/drills/submit-review.ts  →  POST /api/drills/submit-review
functions/api/user/delete.ts           →  DELETE /api/user, PUT /api/user
functions/api/questions/[id].ts        →  GET /api/questions/:id
```

Export named handlers matching HTTP methods:
```typescript
export const onRequestGet: PagesFunction<Env> = ...
export const onRequestPost: PagesFunction<Env> = ...
export const onRequestPut: PagesFunction<Env> = ...
export const onRequestDelete: PagesFunction<Env> = ...
```

## Endpoint Template

Every endpoint follows this structure:

```typescript
import { authenticatedEndpoint } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { withCors } from '../_shared/cors';
import { createEndpointLogger, secureLogger } from '../_shared/logging';
import { z } from 'zod';

// 1. Define request schema
const RequestSchema = z.object({
  questionId: z.string(),
  selectedAnswer: z.string(),
  telemetry: z.object({
    timeToFirstClick: z.number().optional(),
    answerSwitches: z.number().optional(),
    totalDwellTime: z.number().optional(),
  }).optional(),
});

// 2. Export handler with middleware chain
export const onRequestPost: PagesFunction<Env> = withCors(
  authenticatedEndpoint(async (context, auth) => {
    const prisma = createEdgePrismaClient(context.env);
    const logger = createEndpointLogger('endpoint-name');

    try {
      // 3. Parse and validate request body
      const body = await context.request.json();
      const parsed = RequestSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.issues }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { questionId, selectedAnswer, telemetry } = parsed.data;
      const userId = auth.userId; // From Clerk JWT

      // 4. Business logic with Prisma
      const result = await prisma.questionAttempt.create({
        data: {
          userId,
          questionId,
          selectedAnswer,
          // ...
        },
      });

      // 5. Return structured response
      return new Response(JSON.stringify({ success: true, data: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (error) {
      logger.error('Endpoint failed', { error, userId: auth.userId });
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });

    } finally {
      // 6. ALWAYS disconnect Prisma
      await safePrismaDisconnect(prisma);
    }
  })
);
```

## Edge Runtime Constraints

These are the things that will bite you if you're used to Node.js:

### No `process.env`
Edge functions don't have `process.env`. Environment variables come from the Cloudflare context:
```typescript
// WRONG
const apiKey = process.env.GEMINI_API_KEY;

// RIGHT
const apiKey = context.env.GEMINI_API_KEY;
```

### No `lib/` Imports
Edge functions in `functions/api/` cannot import from `lib/` or `components/` — different build targets. Shared logic must either:
- Live in `functions/api/_shared/` (for server-only code)
- Be duplicated with a mirror file: `functions/api/_shared/inferSystem.ts` + `lib/utils/inferSystem.ts`

### Prisma Edge Client
The Prisma client for edge runtime is different from the standard Node.js client:
```typescript
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

// Creates a singleton — don't instantiate PrismaClient directly
const prisma = createEdgePrismaClient(context.env);

// ALWAYS disconnect in finally block — edge functions have short lifetimes
try {
  // ... use prisma
} finally {
  await safePrismaDisconnect(prisma);
}
```

### No Long-Running Processes
Edge functions have execution time limits. For expensive operations:
- Use bounded queries (`take: 100`, `limit` clauses)
- Paginate large result sets
- Offload heavy computation to queued workers if possible

## Middleware Reference

### `authenticatedEndpoint`
Verifies Clerk JWT from the `Authorization` header. Passes `auth` object with `auth.userId` to the handler. Returns 401 if token is invalid or missing.

### `withCors`
Adds CORS headers for cross-origin requests. Handles OPTIONS preflight. Configured for the app's allowed origins.

### `withRateLimit`
KV-based rate limiting. Configure per-endpoint:
```typescript
import { withRateLimit } from '../_shared/rate-limit';

export const onRequestPost = withCors(
  withRateLimit({ limit: 30, windowMs: 60000 },
    authenticatedEndpoint(async (context, auth) => {
      // ...
    })
  )
);
```

### `validateSchema`
Zod-based request validation middleware (alternative to inline validation):
```typescript
import { validateSchema } from '../_shared/validation';

export const onRequestPost = withCors(
  authenticatedEndpoint(
    validateSchema(RequestSchema, async (context, auth, data) => {
      // data is already parsed and typed
    })
  )
);
```

## Common Patterns

### Query Parameter Parsing
```typescript
const url = new URL(context.request.url);
const system = url.searchParams.get('system');
const limit = parseInt(url.searchParams.get('limit') || '20', 10);
const force = url.searchParams.get('force') === 'true';
```

### Multi-Method Endpoints
For endpoints that handle multiple HTTP methods (like soft delete + cancel):
```typescript
// functions/api/user/delete.ts
export const onRequestDelete: PagesFunction<Env> = withCors(
  authenticatedEndpoint(async (context, auth) => {
    // Soft delete: set deletionScheduledAt to 30 days from now
  })
);

export const onRequestPut: PagesFunction<Env> = withCors(
  authenticatedEndpoint(async (context, auth) => {
    // Cancel deletion: clear deletionScheduledAt
  })
);
```

### Prisma Select Optimization
Don't fetch entire records when you only need a few fields:
```typescript
// GOOD — only fetch what you need
const sessions = await prisma.patientEncounterCase.findMany({
  where: { userId: auth.userId },
  select: {
    id: true,
    targetSystem: true,
    chiefComplaint: true,
    correctDiagnosis: true,
  },
  take: 50,
  orderBy: { createdAt: 'desc' },
});

// BAD — fetches all columns including large JSON blobs
const sessions = await prisma.patientEncounterCase.findMany({
  where: { userId: auth.userId },
});
```

## Debugging

1. **Local testing**: `npm run dev:wrangler` gives the most production-like local environment
2. **Logs**: Use `createEndpointLogger` for structured logging that works in edge runtime
3. **401 errors**: Usually means the Clerk token isn't being passed. Check that the client includes `Authorization: Bearer ${token}` header
4. **Prisma errors**: Check that the database URL in `context.env` is correctly configured in Cloudflare dashboard
5. **Import errors**: If you get "module not found" in production but not locally, you're probably importing from `lib/` — move the import to `functions/api/_shared/`
