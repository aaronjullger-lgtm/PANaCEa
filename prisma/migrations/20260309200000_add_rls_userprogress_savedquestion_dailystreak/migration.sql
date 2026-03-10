-- Sprint 2: Add RLS for UserProgress, SavedQuestion, DailyStreak
-- Complements 20260104_add_rls_policies (User, SRSItem, StudySession, etc.)

-- ============================================================================
-- Enable RLS on additional user-specific tables
-- ============================================================================

ALTER TABLE "UserProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyStreak" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- UserProgress: users can only access their own progress
-- ============================================================================

CREATE POLICY "user_progress_select_own" ON "UserProgress"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_progress_insert_own" ON "UserProgress"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_progress_update_own" ON "UserProgress"
  FOR UPDATE
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_progress_admin" ON "UserProgress"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- SavedQuestion: users can only access their own saved questions
-- ============================================================================

CREATE POLICY "saved_question_select_own" ON "SavedQuestion"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "saved_question_insert_own" ON "SavedQuestion"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "saved_question_update_own" ON "SavedQuestion"
  FOR UPDATE
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "saved_question_delete_own" ON "SavedQuestion"
  FOR DELETE
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "saved_question_admin" ON "SavedQuestion"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- DailyStreak: users can only access their own streaks
-- ============================================================================

CREATE POLICY "daily_streak_select_own" ON "DailyStreak"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "daily_streak_insert_own" ON "DailyStreak"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "daily_streak_update_own" ON "DailyStreak"
  FOR UPDATE
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "daily_streak_admin" ON "DailyStreak"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
