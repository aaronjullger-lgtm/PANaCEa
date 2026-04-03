---
name: prisma-data-integrity
description: "Review and fix database schema, migrations, query patterns, RLS policies, and data integrity in PANaCEa's Prisma/PostgreSQL layer. Use this skill whenever writing migrations, debugging data inconsistencies, optimizing queries, reviewing RLS policies, or investigating 'the data is wrong' issues — even if the user just says 'the database is slow' or 'records are missing'. Also use when adding new models, reviewing index coverage, or auditing edge-safe Prisma usage patterns."
---

# Prisma Data Integrity Skill

## Purpose
The database is the source of truth. Schema must be correct, queries must be efficient, and data must be consistent. This skill audits and fixes the Prisma/PostgreSQL layer — including migrations, RLS policies, query patterns, edge-safe client usage, and atomic operations.

## Migration Safety Checklist

- [ ] **Backward compatibility:** Can old clients still work with the new schema? Can you roll back without data loss?
- [ ] **RLS awareness:** Does this table store user-sensitive data? If yes, add RLS before migrations touch any rows.
- [ ] **Index impact:** Will the new column be queried? Add a computed index now. Will removing a column break queries elsewhere?
- [ ] **Data backfill:** If adding a NOT NULL column, backfill before adding the constraint. Use raw SQL `UPDATE ... WHERE ... IS NULL SET ... = ...`.
- [ ] **Enum safety:** Renaming or removing enums breaks existing rows. Add the new value, migrate data, then deprecate old.
- [ ] **Foreign key cascade:** Verify ON DELETE behavior. Missing CASCADE can block writes; wrong CASCADE can silently delete related data.
- [ ] **Default values:** New columns need sensible defaults. Client code must handle optional fields until data migrates.

## Edge-Safe Prisma Patterns

```typescript
// ✓ Create singleton edge client (connection pooling via Accelerate)
import { createEdgePrismaClient } from './_shared/prisma-edge';
const prisma = createEdgePrismaClient();

// ✗ Never: new PrismaClient() on edge, or keeping client open across requests
// ✗ Never: process.env in edge — use context.env.* from Cloudflare Functions

// ✓ Always disconnect in finally (prevents connection leak)
try {
  const result = await prisma.user.findUnique({ where: { id: userId } });
} finally {
  await safePrismaDisconnect(prisma);
}

// ✓ Select only needed fields (reduce payload, improve latency)
await prisma.question.findMany({
  select: { id: true, stem: true, images: true },  // NOT: select: { ... }
  where: { courseId },
  take: 20,
});

// ✓ Use cursor pagination (avoid offset, supports real-time changes)
await prisma.questionAttempt.findMany({
  cursor: lastCursor ? { id: lastCursor } : undefined,
  skip: lastCursor ? 1 : 0,
  take: 50,
});
```

## RLS Audit

Tables with RLS (verified via migration 20260104, 20260309):
- **User** — users see only their own row
- **UserProgress** — users see only progress for their own reviews
- **SavedQuestion** — users see only their own saves
- **DailyStreak** — users see only their own streak

Tables that **should** have RLS but may not:
- **Session, SessionAnalytics** — if storing user-specific drill/quiz state
- **BehaviorLog, ReviewLog** — if storing per-user telemetry
- **PreGeneratedQuestion** — if reserving per-user, check ownership via join

**Verify RLS:**
```sql
SELECT schemaname, tablename FROM pg_tables 
WHERE tablename IN ('User', 'UserProgress', 'SavedQuestion', 'DailyStreak');
SELECT * FROM pg_policy WHERE relname = 'Question'; -- Should be empty (public)
```

## Query Optimization for Edge

1. **Avoid N+1:** Batch queries or use `include`/`select` with relations. Edge latency × N calls = slow.
   - ✗ `for (q of questions) await prisma.card.findMany({ where: { questionId: q.id } })`
   - ✓ `await prisma.question.findMany({ select: { cards: true } })`

2. **Cursor pagination:** Offset + limit breaks with real-time changes; cursor pagination is deterministic.
3. **Partial selects:** Edge bandwidth is precious. `select: { id, title }` not `select: { ... }`.
4. **Index coverage:** Check `schema.prisma` for `@db.Indexed` and `@@unique`. Missing indexes on WHERE clauses = full table scans.

## Atomic Reservation Pattern

Reservoir uses `FOR UPDATE SKIP LOCKED` for lock-free atomic pickup:
```sql
SELECT id FROM PreGeneratedQuestion 
WHERE userId = $1 AND state = 'queued'
ORDER BY priority DESC, createdAt ASC
LIMIT $2
FOR UPDATE SKIP LOCKED;
```
Model for other atomic operations. Apply when: multiple workers race for same rows, or soft constraints (e.g., "only one active session per user").

## Common Failure Modes

| Failure | Root Cause | Fix |
|---------|-----------|-----|
| Migration drift | Schema comment doesn't match schema.prisma | Run `prisma migrate resolve --rolled-back <name>` |
| Missing RLS on new table | Forgot to add policy before migration | Add policy in new migration; backfill data safely |
| Connection leak on edge | Didn't call safePrismaDisconnect | Wrap in try/finally; verify with connection pool metrics |
| N+1 in list endpoint | Fetching child records in loop | Use `include` or batch queries |
| 'Prisma error: unknown field' | Enum renamed; old values still in DB | Add new enum, migrate data, deprecate old |
| Slow reservoir pickup | Missing index on (userId, state, priority) | Add `@@index([userId, state, priority])` |

## Files to Inspect First

1. **prisma/schema.prisma** — source of truth for schema. Look for `@db.Indexed`, `@@unique`, enum definitions, RLS comments.
2. **prisma/migrations/** — 65 migrations (ordered by timestamp). Scan for RLS policies, enums, index changes.
3. **functions/api/_shared/prisma-edge.ts** — singleton client & safePrismaDisconnect pattern. Verify Accelerate config.
4. **functions/api/drills/submit-review.ts** — atomic FSRS update + reservation pattern (model for transactions).
5. **lib/services/drillReviewService.ts** — query patterns (selectivity, batching, N+1 risk).

## Composes With

- **cf-edge-api** — Client instantiation & context.env handling
- **auth-policy-review** — RLS policy syntax & Clerk integration
- **session-orchestration** — QuestionAttempt, Session mutation patterns
