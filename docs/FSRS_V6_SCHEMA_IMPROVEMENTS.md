# FSRS v6 Schema Improvements - Implementation Summary

## Overview
This document summarizes the critical schema improvements implemented to align PANaCEa with **FSRS v6** specifications and eliminate architectural drift.

## Changes Implemented

### 1. ✅ SessionType Enum (Already Present)
**Purpose**: Strict statistical quarantine for FSRS optimization

```prisma
enum SessionType {
  MAIN          // Only these count for FSRS optimization
  CRAM          // Practice mode - excluded from stats
  RAPID_RECALL  // Quick review - excluded from stats
}
```

**Impact**: 
- Ensures only MAIN session reviews affect long-term memory weights
- Prevents "Cram Mode" and "Rapid Recall" from polluting statistics

### 2. ✅ ReviewLog.sessionType Field (Already Present)
**Purpose**: Enable filtering of review data for FSRS optimizer

```prisma
model ReviewLog {
  // ...existing fields...
  sessionType    SessionType @default(MAIN) // CRITICAL: Only MAIN sessions affect FSRS weights
  // ...remaining fields...
  
  @@index([userId, sessionType, reviewedAt]) // Fast filtering of MAIN sessions
}
```

**Impact**:
- Fast queries: `WHERE sessionType = 'MAIN'`
- Supports the "Main Session Quarantine" Hook
- Critical for FSRS parameter optimization

### 3. ✅ Card Model (Already Present)
**Purpose**: Replace SRSItem with FSRS v6 compliant model

```prisma
model Card {
  id             String    @id @default(cuid())
  userId         String
  questionId     String
  
  // FSRS v6 State (matches ts-fsrs Card interface)
  due            DateTime  // Next review date
  stability      Float     @default(0.0) // S - memory stability in days
  difficulty     Float     @default(0.0) // D - item difficulty [0-10]
  elapsed_days   Float     @default(0.0)
  scheduled_days Float     @default(0.0)
  reps           Int       @default(0)
  lapses         Int       @default(0)
  state          Int       @default(0)   // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review    DateTime?
  
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, questionId])
  @@index([userId, due])        // CRITICAL: Fast "Due Today" queries
  @@index([userId, state])
  @@index([questionId])
}
```

**Impact**:
- Direct compatibility with `@open-spaced-repetition/ts-fsrs`
- Eliminates SM-2/FSRS hybrid confusion
- Optimized indexes for "Due Today" queries

### 4. ✅ PersonalizedFSRSParams.w as Float[] (Already Present)
**Purpose**: Direct Rust optimizer compatibility

```prisma
model PersonalizedFSRSParams {
  w Float[] // The 21 FSRS weights (v6) - Postgres array for performance
  // ...other fields...
}
```

**Impact**:
- Faster ingestion by `@open-spaced-repetition/binding` (Rust/WASM)
- Eliminates JSON parsing overhead
- Native Postgres array operations

### 5. ✅ Deprecated Models Marked
**Purpose**: Clear migration path for legacy code

**Deprecated Models**:
- `SRSItem` → Use `Card` instead
- `UserProgress` → Use `ReviewLog` instead
- `UserSRSConfig` → Use `PersonalizedFSRSParams` instead

**Impact**:
- Clear signals to developers
- Prevents accidental use of legacy patterns
- Guides migration efforts

### 6. ✅ User.Card Relation Added
**Purpose**: Enable Card queries from User model

```prisma
model User {
  // ...existing relations...
  Card                    Card[]  // FSRS v6 compliant cards
  // ...remaining relations...
}
```

**Impact**:
- Enables queries like `user.cards.where({ due: { lte: now } })`
- Supports FSRS dashboard features

## Migration Path

### Phase 1: Data Migration (TODO)
1. Create migration script to copy `SRSItem` data to `Card` format
2. Transform SM-2 fields to FSRS v6 equivalents:
   - `interval` → `scheduled_days`
   - `easiness` → calculate initial `difficulty`
   - `dueDate` → `due`
   - `fsrsStability` → `stability`

### Phase 2: Code Updates (TODO)
1. Update `lib/fsrs.ts` to use `Card` model
2. Update UI components to query `Card` instead of `SRSItem`
3. Update FSRS scheduler to write to both `Card` and `ReviewLog`

### Phase 3: Deprecation (TODO)
1. Remove references to `SRSItem`, `UserProgress`, `UserSRSConfig`
2. Drop deprecated tables after confirming migration success

## Validation Checklist

Before running migrations:
- [ ] Run `npx prisma validate` to check schema syntax
- [ ] Review indexes for query performance
- [ ] Backup production database
- [ ] Test migration on staging environment
- [ ] Verify FSRS calculations match expected behavior

## FSRS v6 Compliance Verification

### Alignment with ts-fsrs
The `Card` model matches the interface from `@open-spaced-repetition/ts-fsrs`:

```typescript
interface Card {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State; // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review?: Date;
}
```

### Statistical Quarantine
The `sessionType` field enforces:
- Only `MAIN` sessions contribute to FSRS weight optimization
- `CRAM` and `RAPID_RECALL` sessions are excluded from long-term stats
- Aligns with the "Main Session Quarantine" Hook in `.clinerules`

### Performance Optimization
- `Float[]` for weights: Direct Rust optimizer ingestion
- Indexed queries: `userId + due`, `userId + sessionType + reviewedAt`
- Time-series optimized: `ReviewLog` replaces JSON array anti-pattern

## References

- FSRS v6 Specification: `open-spaced-repetition/fsrs.js`
- Rust Optimizer: `@open-spaced-repetition/binding`
- TypeScript Library: `@open-spaced-repetition/ts-fsrs`
- Project Documentation: `MASTER_DOCUMENTATION.md`

## Next Steps

1. **Test Schema**: Run `npx prisma validate` and `npx prisma db push` to staging
2. **Create Migration**: Generate Prisma migration for new `Card` model
3. **Data Migration Script**: Create script to copy `SRSItem` → `Card`
4. **Update FSRS Logic**: Modify `lib/fsrs.ts` to use `Card` model
5. **Deploy to Production**: Follow production deployment checklist

---

**Status**: Schema improvements complete ✅  
**Next Action**: Create data migration script  
**Owner**: Development Team  
**Priority**: High (Critical for FSRS v6 compliance)