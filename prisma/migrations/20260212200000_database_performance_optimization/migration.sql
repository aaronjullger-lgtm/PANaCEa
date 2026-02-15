-- Database Performance Optimization Migration
-- Adds critical missing indexes and optimizes query performance

-- ============================================================================
-- 1. QUESTIONATTEMPT TABLE OPTIMIZATIONS
-- ============================================================================

-- 1.1 Add missing index for user timeline queries (critical for pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_userId_createdAt_desc_idx" 
ON "QuestionAttempt"("userId", "createdAt" DESC);

-- 1.2 Add covering index for system accuracy analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_system_wasCorrect_createdAt_idx" 
ON "QuestionAttempt"("system", "wasCorrect", "createdAt");

-- 1.3 Add index for mode-based analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_userId_mode_createdAt_idx" 
ON "QuestionAttempt"("userId", "mode", "createdAt");

-- 1.4 Add index for condition-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_userId_conditionId_createdAt_idx" 
ON "QuestionAttempt"("userId", "conditionId", "createdAt");

-- 1.5 Add partial index for main session queries only (reduces index size)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionAttempt_main_session_userId_createdAt_idx" 
ON "QuestionAttempt"("userId", "createdAt") 
WHERE "isMainSession" = true;

-- ============================================================================
-- 2. REVIEWLOG TABLE OPTIMIZATIONS
-- ============================================================================

-- 2.1 Add missing index for user review history (critical for FSRS calculations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewLog_userId_reviewedAt_desc_idx" 
ON "ReviewLog"("userId", "reviewedAt" DESC);

-- 2.2 Add covering index for condition-based review history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewLog_userId_conditionId_reviewedAt_idx" 
ON "ReviewLog"("userId", "conditionId", "reviewedAt");

-- 2.3 Add index for state-based queries (filtering by card state)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewLog_userId_state_reviewedAt_idx" 
ON "ReviewLog"("userId", "state", "reviewedAt");

-- 2.4 Add partial index for real reviews only (excludes simulated reviews)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewLog_real_reviews_userId_reviewedAt_idx" 
ON "ReviewLog"("userId", "reviewedAt") 
WHERE "review_type" = 'real';

-- ============================================================================
-- 3. USERPROGRESS TABLE OPTIMIZATIONS
-- ============================================================================

-- 3.1 Add index for due card queries (critical for session generation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProgress_userId_nextReviewAt_idx" 
ON "UserProgress"("userId", "nextReviewAt");

-- 3.2 Add covering index for system-level progress queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProgress_userId_system_nextReviewAt_idx" 
ON "UserProgress"("userId", "system", "nextReviewAt");

-- 3.3 Add partial index for active cards only (reduces index size)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProgress_active_cards_idx" 
ON "UserProgress"("userId", "nextReviewAt") 
WHERE "state" IN (2, 3); -- Review (2) and Relearning (3) states

-- 3.4 Add index for condition lookup in user progress
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProgress_conditionId_userId_idx" 
ON "UserProgress"("conditionId", "userId");

-- ============================================================================
-- 4. MEDICALCONTENT TABLE OPTIMIZATIONS
-- ============================================================================

-- 4.1 Add expression index for system + parent_category queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MedicalContent_system_parent_category_idx" 
ON "MedicalContent"("system", "parent_category");

-- 4.2 Add expression index for system + subcategory + parent_category queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MedicalContent_system_subcategory_parent_category_idx" 
ON "MedicalContent"("system", "subcategory", "parent_category");

-- 4.3 Add index for status-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MedicalContent_status_conditionId_idx" 
ON "MedicalContent"("status", "conditionId");

-- ============================================================================
-- 5. PREGENERATEDQUESTION TABLE OPTIMIZATIONS
-- ============================================================================

-- 5.1 Add covering index for unused question selection
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PreGeneratedQuestion_unused_selection_idx" 
ON "PreGeneratedQuestion"("system", "questionType", "validationStatus", "usedAt") 
WHERE "usedAt" IS NULL AND "validationStatus" = 'validated';

-- 5.2 Add index for system-based pool monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PreGeneratedQuestion_system_usedAt_idx" 
ON "PreGeneratedQuestion"("system", "usedAt");

-- ============================================================================
-- 6. USERQUESTIONSHISTORY TABLE OPTIMIZATIONS
-- ============================================================================

-- 6.1 Add index for user question history lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserQuestionSeen_userId_questionId_idx" 
ON "UserQuestionSeen"("userId", "questionId");

-- 6.2 Add index for last seen queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserQuestionSeen_userId_lastSeenAt_idx" 
ON "UserQuestionSeen"("userId", "lastSeenAt" DESC);

-- ============================================================================
-- 7. REMOVE REDUNDANT INDEXES (After verifying they're not used)
-- ============================================================================

-- Note: These indexes should be removed only after monitoring shows they're redundant
-- Run in separate migration after performance monitoring

-- 7.1 Check for redundant QuestionAttempt indexes
-- SELECT * FROM pg_stat_user_indexes WHERE relname = 'QuestionAttempt';
-- If index "QuestionAttempt_userId_isMainSession_createdAt_idx" exists and overlaps with
-- "QuestionAttempt_userId_isMainSession_createdAt_desc_idx", consider removing the non-desc version

-- ============================================================================
-- 8. CREATE MATERIALIZED VIEWS FOR ANALYTICS (Optional - for heavy analytics)
-- ============================================================================

-- 8.1 Daily user statistics (can be created separately if needed)
-- CREATE MATERIALIZED VIEW IF NOT EXISTS daily_user_stats AS
-- SELECT 
--   "userId" as user_id,
--   DATE("createdAt") as date,
--   COUNT(*) as total_attempts,
--   SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END) as correct_attempts,
--   AVG("timeSpentMs") as avg_time_spent,
--   COUNT(DISTINCT "system") as unique_systems
-- FROM "QuestionAttempt"
-- WHERE "createdAt" >= CURRENT_DATE - INTERVAL '90 days'
-- GROUP BY "userId", DATE("createdAt");

-- CREATE UNIQUE INDEX ON daily_user_stats(user_id, date);

-- ============================================================================
-- 9. ADD COMMENTARY FOR INDEX USAGE MONITORING
-- ============================================================================

COMMENT ON INDEX "QuestionAttempt_userId_createdAt_desc_idx" IS 'Critical: User timeline pagination and history queries';
COMMENT ON INDEX "ReviewLog_userId_reviewedAt_desc_idx" IS 'Critical: FSRS review history and optimization queries';
COMMENT ON INDEX "UserProgress_userId_nextReviewAt_idx" IS 'Critical: Due card selection for session generation';

-- ============================================================================
-- 10. UPDATE TABLE STATISTICS
-- ============================================================================

-- Run ANALYZE on critical tables to ensure query planner has accurate statistics
ANALYZE "QuestionAttempt";
ANALYZE "ReviewLog";
ANALYZE "UserProgress";
ANALYZE "MedicalContent";

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- 1. All indexes are created CONCURRENTLY to avoid locking tables during production
-- 2. Partial indexes are used where appropriate to reduce index size
-- 3. Covering indexes include frequently filtered columns in WHERE clauses
-- 4. DESC ordering is used for pagination queries (newest first)
-- 5. Materialized views are commented out - enable if analytics queries are slow
-- 6. Run VACUUM ANALYZE after migration completes for optimal performance