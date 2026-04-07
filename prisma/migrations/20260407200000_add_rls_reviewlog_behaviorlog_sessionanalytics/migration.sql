-- Phase 2: Extend RLS to critical user-data tables
-- Tables: ReviewLog, BehaviorLog, SessionAnalytics, UserStatistics
--
-- These tables store sensitive per-user behavioral and performance data.
-- RLS ensures users can only access their own records, with admin bypass.
--
-- Pattern: same as 20260104_add_rls_policies and 20260309_add_rls_*
-- All policies use userId subquery matching against User.clerkId = auth.uid()

-- ============================================================================
-- 1. ReviewLog — FSRS review scheduling data (userId via direct column)
-- ============================================================================

ALTER TABLE "ReviewLog" ENABLE ROW LEVEL SECURITY;

-- Users can read their own review logs
CREATE POLICY "review_log_select_own" ON "ReviewLog"
  FOR SELECT USING (
    "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
  );

-- Users can insert their own review logs (from drill/quiz submissions)
CREATE POLICY "review_log_insert_own" ON "ReviewLog"
  FOR INSERT WITH CHECK (
    "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
  );

-- Admin/service bypass for all operations
CREATE POLICY "review_log_admin" ON "ReviewLog"
  USING (
    auth.jwt() ->> 'role' IN ('service_role', 'admin')
  );

-- ============================================================================
-- 2. BehaviorLog — Behavioral telemetry (userId via direct column)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'BehaviorLog') THEN
    EXECUTE 'ALTER TABLE "BehaviorLog" ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "behavior_log_select_own" ON "BehaviorLog"
      FOR SELECT USING (
        "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
      )';

    EXECUTE 'CREATE POLICY "behavior_log_insert_own" ON "BehaviorLog"
      FOR INSERT WITH CHECK (
        "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
      )';

    EXECUTE 'CREATE POLICY "behavior_log_admin" ON "BehaviorLog"
      USING (
        auth.jwt() ->> ''role'' IN (''service_role'', ''admin'')
      )';
  END IF;
END $$;

-- ============================================================================
-- 3. SessionAnalytics — Per-session analytics (userId via direct column)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SessionAnalytics') THEN
    EXECUTE 'ALTER TABLE "SessionAnalytics" ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "session_analytics_select_own" ON "SessionAnalytics"
      FOR SELECT USING (
        "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
      )';

    EXECUTE 'CREATE POLICY "session_analytics_insert_own" ON "SessionAnalytics"
      FOR INSERT WITH CHECK (
        "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
      )';

    EXECUTE 'CREATE POLICY "session_analytics_admin" ON "SessionAnalytics"
      USING (
        auth.jwt() ->> ''role'' IN (''service_role'', ''admin'')
      )';
  END IF;
END $$;

-- ============================================================================
-- 4. UserStatistics — Aggregated user stats (userId via direct column)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'UserStatistics') THEN
    EXECUTE 'ALTER TABLE "UserStatistics" ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "user_statistics_select_own" ON "UserStatistics"
      FOR SELECT USING (
        "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
      )';

    EXECUTE 'CREATE POLICY "user_statistics_update_own" ON "UserStatistics"
      FOR UPDATE USING (
        "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
      )';

    EXECUTE 'CREATE POLICY "user_statistics_insert_own" ON "UserStatistics"
      FOR INSERT WITH CHECK (
        "userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text)
      )';

    EXECUTE 'CREATE POLICY "user_statistics_admin" ON "UserStatistics"
      USING (
        auth.jwt() ->> ''role'' IN (''service_role'', ''admin'')
      )';
  END IF;
END $$;
