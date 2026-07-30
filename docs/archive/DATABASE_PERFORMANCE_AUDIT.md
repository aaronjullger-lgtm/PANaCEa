# Database Performance Audit & Optimization Plan

## Executive Summary
This audit examines the current database schema, indexing strategy, and query patterns in the PANaCEa application. The system uses PostgreSQL with Prisma ORM and has extensive indexing but requires optimization for production-scale workloads.

## Current Schema Analysis

### Critical Tables & Indexing Status

#### 1. QuestionAttempt (Core Learning Data)
- **Rows**: Expected to grow rapidly (millions+)
- **Current Indexes**: 12 composite indexes
- **Key Issues**:
  - Missing index on `userId, createdAt` for user timeline queries
  - Redundant indexes: `[userId, isMainSession, createdAt(sort: Desc)]` and `[userId, isMainSession, createdAt]`
  - No covering indexes for common analytics queries

#### 2. ReviewLog (FSRS Optimization Data)
- **Rows**: High volume (every review creates a record)
- **Current Indexes**: 9 composite indexes
- **Key Issues**:
  - Missing index on `userId, reviewedAt` for user review history
  - No partial indexes for active reviews only
  - Missing index on `userId, state` for filtering by card state

#### 3. MedicalContent (Content Repository)
- **Rows**: Large but relatively static
- **Current Indexes**: 14 indexes including full-text search
- **Key Issues**:
  - Good coverage but could benefit from expression indexes

#### 4. UserProgress (User Learning State)
- **Rows**: Moderate (users × conditions)
- **Current Indexes**: Limited (needs improvement)
- **Key Issues**:
  - Missing indexes for due card queries
  - No composite indexes for system-level queries

## Performance Issues Identified

### 1. Missing Critical Indexes
- **User timeline queries**: No efficient index for `userId, createdAt DESC`
- **Due card calculations**: Missing indexes on `nextReviewAt` fields
- **System analytics**: Inefficient grouping queries

### 2. Redundant Indexes
- Multiple overlapping composite indexes
- Single-column indexes that could be combined

### 3. Query Pattern Issues
- **N+1 queries**: Common in user progress calculations
- **Large result sets**: Analytics queries scanning entire tables
- **Missing query optimization**: No query hints or materialized views

### 4. Data Growth Concerns
- **QuestionAttempt**: Expected to grow at ~100K rows/day with 1000 active users
- **ReviewLog**: Similar growth pattern
- **No partitioning or archiving strategy**

## Optimization Recommendations

### Phase 1: Immediate Index Improvements (1-2 days)

#### 1.1 Add Missing Critical Indexes
```sql
-- QuestionAttempt: User timeline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_userId_createdAt_desc_idx" 
ON "QuestionAttempt"("userId", "createdAt" DESC);

-- ReviewLog: User review history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewLog_userId_reviewedAt_desc_idx" 
ON "ReviewLog"("userId", "reviewedAt" DESC);

-- UserProgress: Due card queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProgress_userId_nextReviewAt_idx" 
ON "UserProgress"("userId", "nextReviewAt");

-- Partial index for active cards only
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProgress_active_cards_idx" 
ON "UserProgress"("userId", "nextReviewAt") 
WHERE "state" IN (2, 3); -- Review and Relearning states
```

#### 1.2 Remove Redundant Indexes
```sql
-- Remove overlapping indexes after verifying usage
DROP INDEX IF EXISTS "QuestionAttempt_userId_isMainSession_createdAt_idx";
-- Keep only the descending version for pagination
```

#### 1.3 Add Expression Indexes for Common Queries
```sql
-- For system accuracy calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_system_accuracy_idx" 
ON "QuestionAttempt"("system", "wasCorrect", "createdAt");

-- For time-based analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_date_accuracy_idx" 
ON "QuestionAttempt"(DATE("createdAt"), "wasCorrect");
```

### Phase 2: Query Optimization (2-3 days)

#### 2.1 Implement Materialized Views for Analytics
```sql
-- Daily user statistics
CREATE MATERIALIZED VIEW daily_user_stats AS
SELECT 
  user_id,
  DATE(created_at) as date,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) as correct_attempts,
  AVG(time_spent_ms) as avg_time_spent
FROM "QuestionAttempt"
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY user_id, DATE(created_at);

-- Refresh strategy: Incremental updates
CREATE UNIQUE INDEX ON daily_user_stats(user_id, date);
```

#### 2.2 Add Query Hints and Optimizations
- Use `/*+ Leading() */` hints for complex joins
- Implement CTEs for recursive queries
- Add query timeouts for analytics queries

#### 2.3 Batch Processing Improvements
- Implement cursor-based pagination for large datasets
- Add rate limiting to prevent query storms
- Use `FOR UPDATE SKIP LOCKED` for job processing

### Phase 3: Schema Refactoring (3-5 days)

#### 3.1 Partition Critical Tables
```sql
-- Partition QuestionAttempt by created_at monthly
CREATE TABLE "QuestionAttempt_2025_01" PARTITION OF "QuestionAttempt"
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Partition ReviewLog by reviewed_at
CREATE TABLE "ReviewLog_2025_01" PARTITION OF "ReviewLog"
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

#### 3.2 Add Archiving Strategy
- Move old data (>6 months) to archive tables
- Implement data lifecycle management
- Add retention policies

#### 3.3 Normalize Telemetry Data
- Extract `telemetry_json` to separate table
- Add proper indexing on telemetry fields
- Implement JSONB indexing for common paths

### Phase 4: Monitoring & Maintenance (Ongoing)

#### 4.1 Query Performance Monitoring
- Implement pg_stat_statements for query analysis
- Set up alerts for slow queries (>100ms)
- Regular index usage analysis

#### 4.2 Vacuum & Analyze Strategy
- Configure aggressive autovacuum for high-churn tables
- Schedule regular ANALYZE for statistics
- Monitor bloat and table growth

#### 4.3 Connection Pool Optimization
- Configure PgBouncer for connection pooling
- Implement statement timeout (30s)
- Set idle transaction timeout (10m)

## Implementation Priority

### Critical (Week 1)
1. Add missing indexes on `userId, createdAt DESC`
2. Implement materialized views for dashboard queries
3. Add query timeouts and rate limiting

### High Priority (Week 2)
1. Partition QuestionAttempt table
2. Optimize N+1 queries in user progress service
3. Implement cursor-based pagination

### Medium Priority (Week 3)
1. Archive old data strategy
2. Normalize telemetry data
3. Add comprehensive monitoring

### Low Priority (Week 4+)
1. Advanced partitioning strategies
2. Read replicas for analytics
3. Query result caching

## Expected Performance Improvements

| Query Type | Current Performance | Target Performance | Improvement |
|------------|-------------------|-------------------|-------------|
| User timeline | 500-1000ms | 10-50ms | 10-20x |
| Due cards | 200-500ms | 5-20ms | 10-25x |
| System analytics | 1000-5000ms | 50-200ms | 20-25x |
| Review history | 300-800ms | 15-60ms | 20x |

## Risk Assessment

### Low Risk
- Adding new indexes (concurrent creation)
- Implementing materialized views
- Adding query timeouts

### Medium Risk
- Removing redundant indexes (verify usage first)
- Partitioning tables (requires careful planning)
- Schema changes to telemetry data

### High Risk
- Changing primary key structures
- Major data migrations
- Changing core query patterns

## Success Metrics

1. **Query Performance**: 95% of queries < 100ms
2. **Index Coverage**: 100% of WHERE clauses indexed
3. **Data Growth**: Manageable partition sizes (<10GB each)
4. **Monitoring**: All slow queries identified and optimized
5. **User Experience**: No perceptible delays in core flows

## Next Steps

1. **Immediate**: Create missing indexes (Phase 1.1)
2. **Short-term**: Implement materialized views (Phase 2.1)
3. **Medium-term**: Partition tables (Phase 3.1)
4. **Long-term**: Comprehensive monitoring (Phase 4)

This plan provides a structured approach to database performance optimization, addressing both immediate issues and long-term scalability concerns.