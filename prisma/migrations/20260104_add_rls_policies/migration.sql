-- Enable Row Level Security on user-specific tables
-- This migration adds RLS policies to protect user data

-- ============================================================================
-- STEP 1: Enable RLS on all user-data tables
-- ============================================================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserQuestionHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSRSConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SRSItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAchievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserLearningProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGroupMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionFlag" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create policies for User table
-- Users can only read/update their own profile
-- ============================================================================

-- Users can read their own data
CREATE POLICY "users_select_own" ON "User"
  FOR SELECT
  USING (auth.uid()::text = "clerkId");

-- Users can update their own data  
CREATE POLICY "users_update_own" ON "User"
  FOR UPDATE
  USING (auth.uid()::text = "clerkId");

-- Service role (admin) can do everything
CREATE POLICY "users_admin_all" ON "User"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

-- ============================================================================
-- STEP 3: Create policies for UserQuestionHistory
-- ============================================================================

CREATE POLICY "user_question_history_select_own" ON "UserQuestionHistory"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_question_history_insert_own" ON "UserQuestionHistory"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_question_history_admin" ON "UserQuestionHistory"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 4: Create policies for QuestionAttempt
-- ============================================================================

CREATE POLICY "question_attempt_select_own" ON "QuestionAttempt"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "question_attempt_insert_own" ON "QuestionAttempt"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "question_attempt_admin" ON "QuestionAttempt"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 5: Create policies for SRSItem
-- ============================================================================

CREATE POLICY "srs_item_select_own" ON "SRSItem"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "srs_item_all_own" ON "SRSItem"
  FOR ALL
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "srs_item_admin" ON "SRSItem"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 6: Create policies for PerformanceRecord
-- ============================================================================

CREATE POLICY "performance_record_select_own" ON "PerformanceRecord"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "performance_record_insert_own" ON "PerformanceRecord"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "performance_record_admin" ON "PerformanceRecord"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 7: Create policies for StudySession
-- ============================================================================

CREATE POLICY "study_session_select_own" ON "StudySession"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "study_session_all_own" ON "StudySession"
  FOR ALL
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "study_session_admin" ON "StudySession"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 8: Create policies for UserAchievement
-- ============================================================================

CREATE POLICY "user_achievement_select_own" ON "UserAchievement"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_achievement_insert_own" ON "UserAchievement"
  FOR INSERT
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_achievement_admin" ON "UserAchievement"
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STEP 9: Create policies for Bookmark
-- ============================================================================

CREATE POLICY "bookmark_select_own" ON "Bookmark"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "bookmark_all_own" ON "Bookmark"
  FOR ALL
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

-- ============================================================================
-- STEP 10: Create policies for QuestionFlag (users can create, admins can view all)
-- ============================================================================

CREATE POLICY "question_flag_insert_own" ON "QuestionFlag"
  FOR INSERT
  WITH CHECK ("reportedBy" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "question_flag_select_own" ON "QuestionFlag"
  FOR SELECT
  USING ("reportedBy" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "question_flag_admin" ON "QuestionFlag"
  FOR ALL
  USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

-- ============================================================================
-- STEP 11: Create policies for SyncQueue
-- ============================================================================

CREATE POLICY "sync_queue_all_own" ON "SyncQueue"
  FOR ALL
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

-- ============================================================================
-- STEP 12: Create policies for study groups
-- Members can see group data, owners can manage
-- ============================================================================

CREATE POLICY "study_group_member_select_own" ON "StudyGroupMember"
  FOR SELECT
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "study_group_member_all_own" ON "StudyGroupMember"
  FOR ALL
  USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

-- ============================================================================
-- STEP 13: Public content tables - everyone can read
-- ============================================================================

-- These don't need RLS as they're public content
-- MedicalContent, Condition, Drug, LabTest, ImagingStudy, etc.
-- They remain accessible to all authenticated users

-- ============================================================================
-- NOTE: After running this migration, ensure your Supabase auth is configured
-- to pass the user's clerkId as auth.uid()
-- ============================================================================
