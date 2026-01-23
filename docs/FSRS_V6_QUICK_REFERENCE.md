# FSRS v6 Quick Reference Guide

## For Developers: How to Use the New Schema

### 1. Working with Cards (FSRS v6 Compliant)

#### Create a New Card
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const card = await prisma.card.create({
  data: {
    userId: user.id,
    questionId: question.id,
    due: new Date(),
    stability: 0.0,
    difficulty: 0.0,
    state: 0, // 0=New
  }
});
```

#### Query Due Cards
```typescript
// Get all cards due today for a user
const dueCards = await prisma.card.findMany({
  where: {
    userId: user.id,
    due: {
      lte: new Date(),
    },
  },
  orderBy: {
    due: 'asc',
  },
});
```

#### Update Card After Review
```typescript
import { fsrs, Rating, State } from '@open-spaced-repetition/ts-fsrs';

const f = fsrs();
const scheduling = f.repeat(card, new Date());

// User selected "Good"
const updatedCard = await prisma.card.update({
  where: { id: card.id },
  data: scheduling[Rating.Good].card,
});
```

### 2. Recording Reviews (with Session Type)

#### Record a MAIN Session Review
```typescript
await prisma.reviewLog.create({
  data: {
    userId: user.id,
    questionId: question.id,
    conditionId: condition.id,
    sessionType: 'MAIN', // CRITICAL: Only MAIN affects FSRS weights
    grade: 3, // FSRS rating (1-4)
    state: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    wasCorrect: true,
    responseTimeMs: 12500,
    reviewedAt: new Date(),
  },
});
```

#### Record a CRAM Session (excluded from stats)
```typescript
await prisma.reviewLog.create({
  data: {
    userId: user.id,
    questionId: question.id,
    sessionType: 'CRAM', // Excluded from FSRS optimization
    grade: 4,
    state: 2,
    wasCorrect: true,
    // ...
  },
});
```

### 3. Querying Reviews for FSRS Optimization

#### Get MAIN Session Reviews Only
```typescript
// CRITICAL: Always filter by sessionType = 'MAIN'
const mainReviews = await prisma.reviewLog.findMany({
  where: {
    userId: user.id,
    sessionType: 'MAIN', // Enforces "Main Session Quarantine"
  },
  orderBy: {
    reviewedAt: 'asc',
  },
});
```

#### Export for Rust Optimizer
```typescript
const reviewData = mainReviews.map(r => ({
  rating: r.grade,
  elapsed_days: r.elapsedDays || 0,
  state: r.state,
}));

// Feed to @open-spaced-repetition/binding
// const optimizedWeights = await optimizer.optimize(reviewData);
```

### 4. Using PersonalizedFSRSParams

#### Store Optimized Weights
```typescript
await prisma.personalizedFSRSParams.upsert({
  where: { userId: user.id },
  update: {
    w: [0.4, 0.6, 2.4, 5.8, ...], // 21 Float values
    lastOptimizedAt: new Date(),
    sampleSize: mainReviews.length,
  },
  create: {
    userId: user.id,
    w: [0.4, 0.6, 2.4, 5.8, ...],
  },
});
```

#### Retrieve and Use Weights
```typescript
const params = await prisma.personalizedFSRSParams.findUnique({
  where: { userId: user.id },
});

const f = fsrs({
  w: params?.w || undefined, // Falls back to default
});
```

### 5. Global Content Search (ContentIndex)

#### Populate ContentIndex (Background Job)
```typescript
// Run this as a background job or cron
async function populateContentIndex() {
  const conditions = await prisma.medicalContent.findMany();
  
  for (const condition of conditions) {
    await prisma.contentIndex.upsert({
      where: { 
        entityType_entityId: {
          entityType: 'Condition',
          entityId: condition.id,
        }
      },
      update: {
        title: condition.name,
        body: `${condition.overview} ${condition.symptoms}`,
        panceYield: condition.panceYield,
        system: condition.system,
      },
      create: {
        entityId: condition.id,
        entityType: 'Condition',
        title: condition.name,
        body: `${condition.overview} ${condition.symptoms}`,
        panceYield: condition.panceYield,
        system: condition.system,
      },
    });
  }
}
```

#### Search Across All Content
```typescript
const results = await prisma.contentIndex.findMany({
  where: {
    OR: [
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { body: { contains: searchTerm, mode: 'insensitive' } },
    ],
  },
  orderBy: {
    panceYield: 'desc',
  },
  take: 20,
});
```

## Common Patterns

### Pattern 1: Complete Review Workflow
```typescript
async function reviewQuestion(userId: string, questionId: string, rating: Rating) {
  // 1. Get existing card
  const card = await prisma.card.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  
  // 2. Calculate next review (FSRS v6)
  const f = fsrs();
  const scheduling = f.repeat(card, new Date());
  const next = scheduling[rating];
  
  // 3. Update card
  await prisma.card.update({
    where: { id: card.id },
    data: next.card,
  });
  
  // 4. Log review (MAIN session only)
  await prisma.reviewLog.create({
    data: {
      userId,
      questionId,
      sessionType: 'MAIN',
      grade: rating,
      state: next.card.state,
      stability: next.card.stability,
      difficulty: next.card.difficulty,
      reviewedAt: new Date(),
    },
  });
}
```

### Pattern 2: Get Due Card Count
```typescript
const dueCount = await prisma.card.count({
  where: {
    userId: user.id,
    due: { lte: new Date() },
  },
});
```

### Pattern 3: System-Specific Stats (MAIN only)
```typescript
const cardioStats = await prisma.reviewLog.aggregate({
  where: {
    userId: user.id,
    system: 'CV',
    sessionType: 'MAIN', // Exclude cram/rapid
  },
  _avg: {
    difficulty: true,
    stability: true,
  },
  _count: true,
});
```

## Migration Checklist

- [ ] Run `npx prisma validate`
- [ ] Run `npx prisma format`
- [ ] Create migration: `npx prisma migrate dev --name fsrs_v6_improvements`
- [ ] Review generated SQL
- [ ] Test on staging database
- [ ] Create data migration script for SRSItem → Card
- [ ] Update `lib/fsrs.ts` to use Card model
- [ ] Update UI components
- [ ] Deploy to production
- [ ] Monitor performance improvements
- [ ] Remove legacy models after validation

## Anti-Patterns to Avoid

### ❌ DON'T: Include CRAM/RAPID_RECALL in stats
```typescript
// BAD - Pollutes FSRS statistics
const reviews = await prisma.reviewLog.findMany({
  where: { userId: user.id }, // Missing sessionType filter!
});
```

### ✅ DO: Filter by sessionType = 'MAIN'
```typescript
// GOOD - Only MAIN sessions affect weights
const reviews = await prisma.reviewLog.findMany({
  where: { 
    userId: user.id,
    sessionType: 'MAIN', // Enforces statistical quarantine
  },
});
```

### ❌ DON'T: Store clinical data in JSON files
```typescript
// BAD - Violates "Strict Database-First" rule
const conditions = [
  { name: 'MI', symptoms: [...] },
  // ...2,195 more items
];
```

### ✅ DO: Use database queries
```typescript
// GOOD - Database-first pattern
const conditions = await prisma.medicalContent.findMany({
  where: { isHighYield: true },
});
```

## Performance Tips

1. **Use indexes**: All critical Card/ReviewLog queries are indexed
2. **Batch updates**: Use `prisma.card.updateMany()` for bulk operations
3. **Async operations**: Use `Promise.all()` for parallel queries
4. **Limit results**: Always use `take` for large result sets
5. **Cache weights**: Store FSRS weights in memory, not per-query

## References

- **FSRS v6 Library**: `@open-spaced-repetition/ts-fsrs`
- **Optimizer**: `@open-spaced-repetition/binding`
- **Schema**: `prisma/schema.prisma`
- **Docs**: `docs/FSRS_V6_SCHEMA_IMPROVEMENTS.md`

---

**Last Updated**: January 23, 2026  
**Schema Version**: FSRS v6 Compliant