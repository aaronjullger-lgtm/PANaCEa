
-- ============================================================================
-- PANaCEa Orphan & Integrity Scan (read-only)
-- Generated: 2026-04-17
-- Run against: DATABASE_URL (prod) or a recent backup
-- All queries are SELECT COUNT(*); no rows are modified.
-- ============================================================================

-- 1. QuestionAttempt.userId -> User.id (NO FK declared; orphans possible)
SELECT 'QuestionAttempt.userId' AS reference, COUNT(*) AS orphans
FROM "QuestionAttempt" qa
LEFT JOIN "User" u ON qa."userId" = u.id
WHERE u.id IS NULL;

-- 2. QuestionAttempt.questionId -> Question.id
SELECT 'QuestionAttempt.questionId' AS reference, COUNT(*) AS orphans
FROM "QuestionAttempt" qa
LEFT JOIN "Question" q ON qa."questionId" = q.id
WHERE q.id IS NULL;

-- 3. QuestionAttempt.conditionId -> Condition.id (nullable)
SELECT 'QuestionAttempt.conditionId' AS reference, COUNT(*) AS orphans
FROM "QuestionAttempt" qa
LEFT JOIN "Condition" c ON qa."conditionId" = c.id
WHERE qa."conditionId" IS NOT NULL AND c.id IS NULL;

-- 4. QuestionAttempt.medicalContentId -> MedicalContent.id (nullable)
SELECT 'QuestionAttempt.medicalContentId' AS reference, COUNT(*) AS orphans
FROM "QuestionAttempt" qa
LEFT JOIN "MedicalContent" mc ON qa."medicalContentId" = mc.id
WHERE qa."medicalContentId" IS NOT NULL AND mc.id IS NULL;

-- 5. ReviewLog.userId -> User.id (NO FK declared; hottest table for FSRS writes)
SELECT 'ReviewLog.userId' AS reference, COUNT(*) AS orphans
FROM "ReviewLog" rl
LEFT JOIN "User" u ON rl."userId" = u.id
WHERE u.id IS NULL;

-- 6. ReviewLog.questionId -> Question.id (nullable, legacy)
SELECT 'ReviewLog.questionId (no FK)' AS reference, COUNT(*) AS orphans
FROM "ReviewLog" rl
LEFT JOIN "Question" q ON rl."questionId" = q.id
WHERE rl."questionId" IS NOT NULL AND q.id IS NULL;

-- 7. ReviewLog.questionFkId vs questionId divergence (dual-field split)
SELECT 'ReviewLog split questionId<>questionFkId' AS reference,
       COUNT(*) FILTER (WHERE "questionId" IS NOT NULL AND "questionFkId" IS NULL) AS only_old_field,
       COUNT(*) FILTER (WHERE "questionFkId" IS NOT NULL AND "questionId" IS NULL) AS only_new_field,
       COUNT(*) FILTER (WHERE "questionId" IS NOT NULL AND "questionFkId" IS NOT NULL AND "questionId" <> "questionFkId") AS disagreeing,
       COUNT(*) AS total
FROM "ReviewLog";

-- 8. ReviewLog.conditionId -> Condition.id
SELECT 'ReviewLog.conditionId' AS reference, COUNT(*) AS orphans
FROM "ReviewLog" rl
LEFT JOIN "Condition" c ON rl."conditionId" = c.id
WHERE rl."conditionId" IS NOT NULL AND c.id IS NULL;

-- 9. UserProgress.conditionId -> MedicalContent.id (NOTE: named conditionId but FKs MedicalContent)
SELECT 'UserProgress.conditionId -> MedicalContent' AS reference, COUNT(*) AS orphans
FROM "UserProgress" up
LEFT JOIN "MedicalContent" mc ON up."conditionId" = mc.id
WHERE mc.id IS NULL;

-- 10. Card.questionId -> Question.id (no @relation)
SELECT 'Card.questionId' AS reference, COUNT(*) AS orphans
FROM "Card" c
LEFT JOIN "Question" q ON c."questionId" = q.id
WHERE q.id IS NULL;

-- 11. StudentReservoirItem.questionId -> PreGeneratedQuestion.id (or Question.id?)
SELECT 'StudentReservoirItem.questionId -> PreGeneratedQuestion' AS reference, COUNT(*) AS orphans_if_preGen
FROM "StudentReservoirItem" sri
LEFT JOIN "PreGeneratedQuestion" pgq ON sri."questionId" = pgq.id
WHERE pgq.id IS NULL;

-- 12. StudentReservoirItem.questionId -> Question.id (alternate target)
SELECT 'StudentReservoirItem.questionId -> Question' AS reference, COUNT(*) AS orphans_if_question
FROM "StudentReservoirItem" sri
LEFT JOIN "Question" q ON sri."questionId" = q.id
WHERE q.id IS NULL;

-- 13. StudentReservoirItem.userId -> User.id
SELECT 'StudentReservoirItem.userId' AS reference, COUNT(*) AS orphans
FROM "StudentReservoirItem" sri
LEFT JOIN "User" u ON sri."userId" = u.id
WHERE u.id IS NULL;

-- 14. AITokenUsage.userId -> User.id (nullable)
SELECT 'AITokenUsage.userId' AS reference, COUNT(*) AS orphans
FROM "AITokenUsage" at
LEFT JOIN "User" u ON at."userId" = u.id
WHERE at."userId" IS NOT NULL AND u.id IS NULL;

-- 15. BaselineAssessment.userId -> User.id
SELECT 'BaselineAssessment.userId' AS reference, COUNT(*) AS orphans
FROM "BaselineAssessment" ba
LEFT JOIN "User" u ON ba."userId" = u.id
WHERE u.id IS NULL;

-- 16. ItemDifficulty.cardId -> Card.id
SELECT 'ItemDifficulty.cardId' AS reference, COUNT(*) AS orphans
FROM "ItemDifficulty" id
LEFT JOIN "Card" c ON id."cardId" = c.id
WHERE c.id IS NULL;

-- 17. MedicalContent.conditionId -> Condition.id (no @relation in schema)
SELECT 'MedicalContent.conditionId' AS reference, COUNT(*) AS orphans
FROM "MedicalContent" mc
LEFT JOIN "Condition" c ON mc."conditionId" = c.id
WHERE mc."conditionId" IS NOT NULL AND c.id IS NULL;

-- 18. QuestionSubmission.questionId -> Question.id
SELECT 'QuestionSubmission.questionId' AS reference, COUNT(*) AS orphans
FROM "QuestionSubmission" qs
LEFT JOIN "Question" q ON qs."questionId" = q.id
WHERE qs."questionId" IS NOT NULL AND q.id IS NULL;

-- ============================================================================
-- Dead-column audit: userId_fk was added by migration 20260102 but is NOT in schema.prisma
-- These should be dropped (after verifying no code references them).
-- ============================================================================

-- 19. Check population of the orphan columns (if any were backfilled)
SELECT 'QuestionAttempt.userId_fk populated' AS probe, COUNT(*) AS non_null_rows
FROM "QuestionAttempt" WHERE "userId_fk" IS NOT NULL;

SELECT 'ConfusionPair.userId_fk populated' AS probe, COUNT(*) AS non_null_rows
FROM "ConfusionPair" WHERE "userId_fk" IS NOT NULL;

-- ============================================================================
-- QuestionEmbedding vs PreGeneratedQuestion coverage
-- ============================================================================

-- 20. Questions without embeddings (new table from 20260407)
SELECT 'PreGeneratedQuestion missing QuestionEmbedding' AS probe,
       COUNT(*) FILTER (WHERE qe.id IS NULL) AS missing,
       COUNT(*) AS total_preGen
FROM "PreGeneratedQuestion" pgq
LEFT JOIN "QuestionEmbedding" qe ON qe."questionId" = pgq.id
WHERE pgq."validationStatus" = 'APPROVED';

-- ============================================================================
-- Index bloat / duplicate detection (Postgres catalog)
-- ============================================================================

-- 21. Duplicate indexes by key columns (same table + same key columns = redundant)
SELECT indrelid::regclass AS table_name,
       array_agg(indexrelid::regclass) AS duplicate_indexes,
       COUNT(*) AS n
FROM pg_index
GROUP BY indrelid, indkey, indexprs, indpred
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- 22. Unused indexes (require pg_stat_user_indexes; run once prod has traffic)
SELECT schemaname, relname, indexrelname,
       idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelname::regclass) DESC
LIMIT 40;

-- 23. Materialized view staleness check
SELECT relname,
       pg_size_pretty(pg_relation_size(oid)) AS size,
       pg_xact_commit_timestamp(xmin) AS last_refresh_txn_commit
FROM pg_class
WHERE relkind = 'm'
  AND relname IN ('user_blueprint_coverage_mv', 'system_accuracy_trend_mv', 'daily_activity_summary_mv');

-- 24. RLS enabled check
SELECT relname AS table_name,
       relrowsecurity AS rls_enabled,
       relforcerowsecurity AS force_rls
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = 'public'::regnamespace
  AND relname IN (
    'User', 'UserProgress', 'UserPreferences', 'Card', 'ReviewLog',
    'QuestionAttempt', 'BehaviorLog', 'SessionAnalytics', 'UserStatistics',
    'ConfusionPair', 'UserConditionAccuracy', 'UserLearningProfile',
    'UserCircadianProfile', 'PersonalizedFSRSParams', 'SavedQuestion',
    'DailyStreak', 'StudentReservoirItem', 'DailyUserAnalytics',
    'PushSubscription', 'UserGoal'
  )
ORDER BY relrowsecurity, relname;
