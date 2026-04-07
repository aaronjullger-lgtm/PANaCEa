# Prisma Edge Client Generation Workflow

PANaCEa uses Prisma 7 with the `/edge` client for Cloudflare Pages Functions. This document covers the non-standard workflow required for edge deployment.

## Why edge is different

Standard Prisma generates a Node.js binary client (~15MB Rust engine). Cloudflare Workers can't run native binaries. The edge client uses a lightweight JS/WASM wrapper instead, communicating with the database through Prisma Accelerate (HTTP-based connection pooler).

## Setup chain

```
prisma/schema.prisma → prisma generate → @prisma/client/edge → Prisma Accelerate → PostgreSQL
```

### 1. Generate the edge client

```bash
npx prisma generate
```

This generates the standard client. The edge import (`@prisma/client/edge`) is available automatically in Prisma 7+. No `--no-engine` flag needed (that was Prisma 5/6).

### 2. Configure Accelerate

Prisma Accelerate provides the HTTP bridge between edge runtime and PostgreSQL.

**Required env var** (Cloudflare Pages → Settings → Environment Variables):
```
DATABASE_URL=prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_KEY
```

Get your key: https://www.prisma.io/data-platform/accelerate

### 3. Import pattern in edge functions

```typescript
// In functions/api/_shared/prisma-edge.ts:
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

const client = new PrismaClient({ accelerateUrl: databaseUrl });
const extendedClient = client.$extends(withAccelerate());
```

### 4. Use in endpoint handlers

```typescript
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

export const onRequestGet = authenticatedEndpoint(schema, async (context) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    const result = await prisma.user.findUnique({ where: { id: auth.userId } });
    return { data: result };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
```

## Singleton pattern

`createEdgePrismaClient()` returns a global singleton per isolate (keyed by DATABASE_URL). This means:
- One client per Cloudflare Worker isolate, reused across requests
- `safePrismaDisconnect()` is a no-op for singletons (they live as long as the isolate)
- Actual connection pooling happens on Accelerate's side, not per-worker

## Cache strategies

Prisma Accelerate supports query-level caching via `cacheStrategy`:

| Strategy | TTL | SWR | Use for |
|----------|-----|-----|---------|
| STATIC | 1h | 24h | Conditions, medical content, anatomy |
| QUESTIONS | 5m | 1h | Pre-generated question pools |
| USER_DATA | 1m | 5m | SRS items, saved questions, progress |
| AGGREGATE | 30m | 2h | System lists, counts |
| REALTIME | none | none | Sync operations, writes |

## Data isolation layers

PANaCEa uses a **defense-in-depth** approach with two ORM-level isolation layers and one database-level layer:

### Layer 1: User-scoped Prisma client (ORM — active)

`prisma-user-scope.ts` auto-injects `where: { userId }` into queries on 62+ user-scoped models. This is the **primary** data isolation mechanism.

```typescript
import { createScopedPrismaClient } from '../_shared/prisma-user-scope';
const scopedPrisma = createScopedPrismaClient(env.DATABASE_URL, auth.userId);
// All queries on user-scoped models auto-filter by userId
```

Use `createScopedPrismaClient` in all authenticated user-facing endpoints. Use unscoped `createEdgePrismaClient` only for cron jobs, admin endpoints, and cross-user aggregation.

### Layer 2: Mutation audit extension (ORM — opt-in)

`prisma-audit-extension.ts` logs all create/update/delete operations. Apply it in sensitive endpoints:

```typescript
import { withMutationAudit } from '../_shared/prisma-audit-extension';
const auditedPrisma = baseClient.$extends(withMutationAudit({
  userId: auth.userId,
  endpoint: '/api/drills/submit-review',
}));
```

### Layer 3: PostgreSQL RLS policies (DB — future)

RLS migrations exist for UserProgress, QuestionAttempt, ReviewLog, BehaviorLog, SessionAnalytics, and UserStatistics. **These policies use `auth.uid()`/`auth.jwt()` which require Supabase PostgREST auth context.** Since PANaCEa routes queries through Prisma Accelerate (not Supabase PostgREST), RLS policies are **not currently enforced**. They serve as future-proofing for a potential Supabase migration or custom auth function bridge.

> **Current protection:** Layers 1 + 2 (ORM-level) are the active guards. RLS is defense-in-depth for when DB-level auth context is available.

## Schema changes workflow

1. Edit `prisma/schema.prisma`
2. `npx prisma migrate dev --name descriptive_name` (local dev)
3. `npx prisma generate` (regenerate client)
4. Test locally with `npm run dev:wrangler`
5. Commit migration files to git
6. On deploy, Prisma Accelerate picks up schema changes automatically

## Common issues

| Issue | Fix |
|-------|-----|
| `module not found: @prisma/client/edge` | Run `npx prisma generate` |
| `DATABASE_URL must be Prisma Accelerate URL` | Use `prisma://accelerate...` format, not `postgresql://` |
| `Cannot import from lib/` in edge functions | Move shared code to `functions/api/_shared/` |
| Connection timeout | Check Accelerate dashboard; may need to warm up |
| `Unknown field` after schema change | Regenerate client + redeploy |
