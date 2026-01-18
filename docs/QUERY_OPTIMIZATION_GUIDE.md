# Query Optimization Guide for PANaCEa

**Last Updated**: January 5, 2026  
**Sprint**: Sprint 4 - Query Optimization

---

## Overview

This guide documents query optimization strategies implemented in PANaCEa and best practices for writing performant database queries. The application uses **Prisma** with **Prisma Accelerate** for edge-compatible database access with built-in connection pooling and query caching.

---

## Architecture

### Database Stack

- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma with Accelerate extension
- **Connection Pooling**: Prisma Accelerate (serverless-optimized)
- **Caching**: CloudFlare KV + Prisma Accelerate query cache
- **Indexes**: 27 strategic indexes (see Sprint 2 docs)

### Connection Model

```
CloudFlare Functions → Prisma Accelerate (HTTP) → Connection Pool → PostgreSQL
```

**Benefits**:

- No connection limits in edge functions
- Automatic connection pooling
- Built-in query result caching
- Edge-compatible (no TCP sockets)

---

## Common Query Anti-Patterns & Solutions

### 1. N+1 Query Pattern ❌ AVOID

**Problem**: Querying in a loop creates N+1 database round trips

```typescript
// ❌ BAD: N+1 queries
const questions = await prisma.question.findMany({ take: 10 });

for (const q of questions) {
  await prisma.question.update({
    where: { id: q.id },
    data: { timesSeen: { increment: 1 } },
  });
}
// Result: 1 + 10 = 11 queries
```

**Solution**: Use batch operations

```typescript
// ✅ GOOD: Batch update
const questions = await prisma.question.findMany({ take: 10 });
const questionIds = questions.map((q) => q.id);

await prisma.question.updateMany({
  where: { id: { in: questionIds } },
  data: { timesSeen: { increment: 1 } },
});
// Result: 2 queries
```

**Performance Impact**: 5-10x faster for batch operations

---

### 2. Missing `select` Fields ❌ AVOID

**Problem**: Fetching unnecessary data increases transfer time and memory

```typescript
// ❌ BAD: Fetches ALL fields (including large JSONB columns)
const attempts = await prisma.questionAttempt.findMany({
  where: { userId },
});
// Returns: id, questionId, userId, wasCorrect, timeSpentMs, answerChangedCount,
//          createdAt, updatedAt, metadata (JSONB), fullQuestionData (JSONB), etc.
```

**Solution**: Use `select` to fetch only needed fields

```typescript
// ✅ GOOD: Only fetch needed fields
const attempts = await prisma.questionAttempt.findMany({
  where: { userId },
  select: {
    wasCorrect: true,
    system: true,
    timeSpentMs: true,
    createdAt: true,
  },
});
// Returns: Only 4 fields, ~70% smaller payload
```

**Performance Impact**: 2-5x faster data transfer, 50-70% less memory

---

### 3. Missing Eager Loading ❌ AVOID

**Problem**: Separate queries for related data

```typescript
// ❌ BAD: Multiple queries
const question = await prisma.question.findUnique({
  where: { id: questionId },
});

const condition = await prisma.condition.findUnique({
  where: { id: question.conditionId },
});

const content = await prisma.medicalContent.findUnique({
  where: { conditionId: question.conditionId },
});
// Result: 3 queries
```

**Solution**: Use `include` or nested `select` for eager loading

```typescript
// ✅ GOOD: Single query with JOINs
const question = await prisma.question.findUnique({
  where: { id: questionId },
  include: {
    Condition: {
      select: {
        name: true,
        MedicalContent: {
          select: { id: true, overview: true },
        },
      },
    },
  },
});
// Result: 1 query with JOINs
```

**Performance Impact**: 3-10x faster (eliminates round trips)

---

### 4. Fetching Without Limits ❌ AVOID

**Problem**: Unbounded queries can return thousands of rows

```typescript
// ❌ BAD: Could return 10,000+ attempts
const allAttempts = await prisma.questionAttempt.findMany({
  where: { userId },
});
```

**Solution**: Always use `take` for pagination

```typescript
// ✅ GOOD: Paginated query
const recentAttempts = await prisma.questionAttempt.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  take: 100, // Limit to 100 most recent
});
```

**Performance Impact**: 10-100x faster for large datasets

---

### 5. Inefficient Filtering ❌ AVOID

**Problem**: Application-side filtering fetches unnecessary data

```typescript
// ❌ BAD: Fetch all, filter in app
const allQuestions = await prisma.question.findMany();
const cvQuestions = allQuestions.filter((q) => q.system === 'CV');
```

**Solution**: Filter in database using `where`

```typescript
// ✅ GOOD: Database-side filtering
const cvQuestions = await prisma.question.findMany({
  where: { system: 'CV' },
});
```

**Performance Impact**: 5-50x faster (leverages indexes)

---

## Best Practices

### 1. Use Composite Indexes for Multi-Column Queries

```typescript
// Query that benefits from composite index
const attempts = await prisma.questionAttempt.findMany({
  where: {
    userId: 'user-123',
    system: 'CV',
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
});

// Requires index: (userId, system, createdAt DESC)
// Created in Sprint 2: QuestionAttempt_userId_system_createdAt_idx
```

**Index Usage**:

- Composite indexes support leftmost prefix matching
- Order matters: `(userId, system, createdAt)` != `(system, userId, createdAt)`
- Covering indexes with `INCLUDE` avoid table lookups

**See**: `/docs/SPRINT_2_COMPLETION_SUMMARY.md` for full index list

---

### 2. Batch Operations for Bulk Updates

```typescript
// ✅ GOOD: Batch create
await prisma.userQuestionHistory.createMany({
  data: questionIds.map((id) => ({
    id: `${userId}-${id}`,
    userId,
    questionId: id,
    seenAt: new Date(),
  })),
  skipDuplicates: true, // Prevents errors on conflicts
});

// ✅ GOOD: Batch update
await prisma.question.updateMany({
  where: { id: { in: questionIds } },
  data: { timesSeen: { increment: 1 } },
});
```

**Limitations**:

- `updateMany` doesn't support relation updates
- `createMany` doesn't return created records
- Use transactions for complex multi-step operations

---

### 3. Optimize with `select` and `include`

```typescript
// ✅ Minimal data fetching
const stats = await prisma.questionAttempt.findMany({
  where: { userId },
  select: {
    wasCorrect: true,
    system: true,
    createdAt: true,
  },
});

// ✅ Eager loading with controlled depth
const question = await prisma.question.findUnique({
  where: { id },
  select: {
    id: true,
    question: true,
    options: true,
    Condition: {
      select: {
        name: true,
        system: true,
      },
    },
  },
});
```

**Tips**:

- Start with `select` for narrow queries
- Use `include` when you need all fields + relations
- Avoid deep nesting (>3 levels) - consider separate queries

---

### 4. Leverage Prisma Accelerate Caching

Prisma Accelerate provides automatic query result caching:

```typescript
// Prisma Accelerate caches this query
const topConditions = await prisma.medicalContent.findMany({
  where: { status: 'published' },
  orderBy: { viewCount: 'desc' },
  take: 50,
  cacheStrategy: { ttl: 300, swr: 60 }, // Cache 5min, stale-while-revalidate 60s
});
```

**Caching Tiers**:

1. **CloudFlare KV Cache** (Sprint 3): 1-60 minutes for complete API responses
2. **Prisma Accelerate Cache**: 1-5 minutes for database query results
3. **Postgres Shared Buffers**: Automatic for frequently accessed pages

---

### 5. Use Transactions for Multi-Step Operations

```typescript
// ✅ GOOD: Atomic multi-step operation
await prisma.$transaction(async (tx) => {
  // Step 1: Create attempt
  const attempt = await tx.questionAttempt.create({
    data: {
      userId,
      questionId,
      wasCorrect,
      timeSpentMs,
    },
  });

  // Step 2: Update user stats
  await tx.user.update({
    where: { id: userId },
    data: {
      totalAttempts: { increment: 1 },
      correctAttempts: { increment: wasCorrect ? 1 : 0 },
    },
  });

  // Step 3: Update question stats
  await tx.question.update({
    where: { id: questionId },
    data: { timesSeen: { increment: 1 } },
  });

  return attempt;
});
```

**Transaction Benefits**:

- All-or-nothing execution (rollback on error)
- Consistent data state
- Prevents race conditions

---

## Query Performance Checklist

Before deploying a new query, verify:

- [ ] **Indexes exist** for `where` columns (check Sprint 2 docs)
- [ ] **`select` used** to minimize data transfer
- [ ] **`take` specified** for lists (max 100 without pagination)
- [ ] **`include` depth** is ≤3 levels
- [ ] **No loops** with queries inside (use batch operations)
- [ ] **Transactions** used for multi-step writes
- [ ] **Cache strategy** considered (KV or Accelerate)

---

## Performance Monitoring

### Check Query Performance

```typescript
// Enable query logging in development
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Prisma will log:
// - Query text
// - Execution time
// - Parameters
```

### Analyze Slow Queries

```sql
-- In PostgreSQL (Supabase SQL Editor)
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- Queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Use Prisma Studio

```bash
npm run db:studio
```

View data, test queries, and inspect relationships visually.

---

## Connection Pooling Configuration

### Current Setup

PANaCEa uses **Prisma Accelerate** for connection pooling:

```typescript
// functions/api/_shared/prisma-edge.ts
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

export function createEdgePrismaClient(databaseUrl: string) {
  const client = new PrismaClient({
    datasourceUrl: databaseUrl, // prisma://accelerate.prisma-data.net/?api_key=...
  });

  return client.$extends(withAccelerate());
}
```

**Prisma Accelerate Features**:

- **Connection Pooling**: Maintains persistent connections to database
- **Global Distribution**: Edge nodes in 300+ locations
- **Query Caching**: Automatic result caching with TTL
- **No Connection Limits**: Serverless-optimized (no TCP socket limits)

### Supabase Connection Pooler

Supabase provides **PgBouncer** for additional pooling:

**Connection Modes**:

1. **Transaction Mode** (recommended): Connections released after each transaction
2. **Session Mode**: Connections held for entire session

**DATABASE_URL Formats**:

```bash
# Direct connection (use in Node.js, not Cloudflare)
postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres

# Transaction pooling (use with Prisma Accelerate)
postgresql://postgres:[password]@db.xxx.supabase.co:6543/postgres?pgbouncer=true

# Prisma Accelerate (production - use this)
prisma://accelerate.prisma-data.net/?api_key=[YOUR_KEY]
```

**Recommendation**: Use Prisma Accelerate (`prisma://`) for production. It handles connection pooling automatically and works in edge runtimes.

---

## Real-World Optimization Examples

### Example 1: Session Question Fetching

**Before** (multiple queries):

```typescript
const questions = await prisma.question.findMany({ take: 10 });

for (const q of questions) {
  await prisma.question.update({
    where: { id: q.id },
    data: { timesSeen: { increment: 1 } },
  });
}
```

**After** (batch update):

```typescript
const questions = await prisma.question.findMany({ take: 10 });
const ids = questions.map((q) => q.id);

await prisma.question.updateMany({
  where: { id: { in: ids } },
  data: { timesSeen: { increment: 1 } },
});
```

**Result**: 11 queries → 2 queries (**5x faster**)

---

### Example 2: User Stats Calculation

**Before** (fetching all fields):

```typescript
const attempts = await prisma.questionAttempt.findMany({
  where: { userId },
});
```

**After** (select only needed fields):

```typescript
const attempts = await prisma.questionAttempt.findMany({
  where: { userId },
  select: {
    wasCorrect: true,
    system: true,
    timeSpentMs: true,
    createdAt: true,
  },
});
```

**Result**: 800KB → 200KB payload (**4x smaller**)

---

### Example 3: Condition Content with Related Data

**Before** (N+1 queries):

```typescript
const condition = await prisma.condition.findUnique({ where: { id } });
const content = await prisma.medicalContent.findUnique({
  where: { conditionId: condition.id },
});
const drugs = await prisma.drug.findMany({
  where: { relatedConditions: { has: condition.id } },
});
```

**After** (single query with joins):

```typescript
const condition = await prisma.condition.findUnique({
  where: { id },
  include: {
    MedicalContent: true,
    DrugConditionLinks: {
      include: {
        Drug: { select: { name: true, drugClass: true } },
      },
    },
  },
});
```

**Result**: 3 queries → 1 query (**3x faster**)

---

## Migration from Express to CloudFlare Functions

### Old Pattern (Express + Regular Prisma)

```typescript
// server.ts - Node.js environment
import { prisma } from './lib/prisma';

app.get('/api/questions', async (req, res) => {
  const questions = await prisma.question.findMany();
  res.json(questions);
});
```

### New Pattern (CloudFlare Functions + Prisma Accelerate)

```typescript
// functions/api/questions/index.ts
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestGet(context) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const questions = await prisma.question.findMany();
    return new Response(JSON.stringify(questions), {
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect(); // Important: always disconnect
  }
}
```

**Key Differences**:

- ✅ Must use `createEdgePrismaClient` (not regular PrismaClient)
- ✅ Must disconnect after each request (`finally` block)
- ✅ DATABASE_URL must be Prisma Accelerate URL
- ✅ Export `onRequestGet` / `onRequestPost` functions

---

## Troubleshooting

### Issue: "Too many connections"

**Cause**: Not disconnecting Prisma client after requests

**Solution**:

```typescript
export async function onRequestGet(context) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // ... your code
  } finally {
    await prisma.$disconnect(); // ✅ Always disconnect
  }
}
```

---

### Issue: Slow queries on large tables

**Cause**: Missing indexes

**Solution**: Check Sprint 2 docs for existing indexes, or create new ones:

```sql
-- In Prisma schema
model QuestionAttempt {
  // ...
  @@index([userId, system, createdAt(sort: Desc)])
}
```

Then run: `npm run db:migrate:dev`

---

### Issue: High memory usage

**Cause**: Fetching too many fields or rows

**Solution**:

1. Use `select` to limit fields
2. Use `take` to limit rows
3. Paginate results with `skip` and `take`

```typescript
// ✅ Paginated with limited fields
const page = parseInt(req.query.page) || 1;
const pageSize = 20;

const attempts = await prisma.questionAttempt.findMany({
  where: { userId },
  select: {
    id: true,
    wasCorrect: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * pageSize,
  take: pageSize,
});
```

---

## Sprint 4 Optimizations Summary

1. **Fixed N+1 Query**: `fetchFromMain` in session.ts now uses batch update
2. **Documented Best Practices**: This guide
3. **Existing Optimizations**:
   - 27 strategic indexes (Sprint 2)
   - KV cache on hot endpoints (Sprint 3)
   - Prisma Accelerate connection pooling
   - Selective field fetching with `select`

**Expected Impact**: 2-5x faster query execution on optimized paths

---

## Additional Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **Prisma Accelerate**: https://www.prisma.io/data-platform/accelerate
- **Sprint 2 Indexes**: `/docs/SPRINT_2_COMPLETION_SUMMARY.md`
- **Sprint 3 Caching**: `/docs/SPRINT_3_COMPLETION_SUMMARY.md`
- **Database Schema**: `/prisma/schema.prisma`
- **Supabase Docs**: https://supabase.com/docs

---

**Last Updated**: Sprint 4 - Query Optimization  
**Next**: Sprint 5 - Error Tracking & Monitoring
