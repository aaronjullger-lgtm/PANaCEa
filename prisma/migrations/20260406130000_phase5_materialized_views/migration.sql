-- Phase 5 Migration: Materialized Views for Dashboard Performance
--
-- These views pre-aggregate expensive dashboard queries that currently
-- compute on every page load. Refresh via CONCURRENTLY (non-blocking)
-- every 2h in the reservoir-maintenance cron job.
--
-- Each view has a UNIQUE index to support REFRESH MATERIALIZED VIEW CONCURRENTLY.

-- ============================================================================
-- 1. USER BLUEPRINT COVERAGE
-- ============================================================================
-- Powers: Blueprint adherence dashboard, system breakdown on ProgressPage
-- Per-user, per-system: question count, correct count, accuracy, last reviewed

CREATE MATERIALIZED VIEW IF NOT EXISTS user_blueprint_coverage_mv AS
SELECT
  qa."userId",
  COALESCE(qa."systemNormalized", qa.system, 'Unknown') AS system,
  COUNT(*)::int                     AS question_count,
  SUM(CASE WHEN qa."wasCorrect" THEN 1 ELSE 0 END)::int AS correct_count,
  CASE
    WHEN COUNT(*) > 0
    THEN ROUND((SUM(CASE WHEN qa."wasCorrect" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 1)
    ELSE 0
  END                               AS accuracy_pct,
  MAX(qa."createdAt")               AS last_reviewed_at
FROM "QuestionAttempt" qa
WHERE qa."isMainSession" = true
GROUP BY qa."userId", COALESCE(qa."systemNormalized", qa.system, 'Unknown');

-- UNIQUE index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_ubc_mv_user_system
  ON user_blueprint_coverage_mv ("userId", system);

-- ============================================================================
-- 2. SYSTEM ACCURACY TREND (WEEKLY)
-- ============================================================================
-- Powers: System breakdown line charts on ProgressPage
-- Per-user, per-system, per-week: accuracy trend

CREATE MATERIALIZED VIEW IF NOT EXISTS system_accuracy_trend_mv AS
SELECT
  qa."userId",
  COALESCE(qa."systemNormalized", qa.system, 'Unknown') AS system,
  date_trunc('week', qa."createdAt")::date              AS week_start,
  COUNT(*)::int                     AS question_count,
  SUM(CASE WHEN qa."wasCorrect" THEN 1 ELSE 0 END)::int AS correct_count,
  CASE
    WHEN COUNT(*) > 0
    THEN ROUND((SUM(CASE WHEN qa."wasCorrect" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 1)
    ELSE 0
  END                               AS accuracy_pct
FROM "QuestionAttempt" qa
WHERE qa."isMainSession" = true
GROUP BY qa."userId", COALESCE(qa."systemNormalized", qa.system, 'Unknown'), date_trunc('week', qa."createdAt")::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sat_mv_user_system_week
  ON system_accuracy_trend_mv ("userId", system, week_start);

-- ============================================================================
-- 3. DAILY ACTIVITY SUMMARY
-- ============================================================================
-- Powers: ActivityHeatmap, streak calculations, study time analytics
-- Per-user, per-day: questions answered, time spent, systems touched

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_activity_summary_mv AS
SELECT
  qa."userId",
  qa."createdAt"::date              AS activity_date,
  COUNT(*)::int                     AS questions_answered,
  COALESCE(SUM(qa."timeSpentMs"), 0)::bigint AS total_time_ms,
  COUNT(DISTINCT COALESCE(qa."systemNormalized", qa.system))::int AS systems_touched,
  SUM(CASE WHEN qa."wasCorrect" THEN 1 ELSE 0 END)::int AS correct_count
FROM "QuestionAttempt" qa
GROUP BY qa."userId", qa."createdAt"::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_das_mv_user_date
  ON daily_activity_summary_mv ("userId", activity_date);
