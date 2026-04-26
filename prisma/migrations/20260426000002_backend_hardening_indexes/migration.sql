-- Backend production hardening hot-path indexes.
-- These support duplicate-submission checks, user progress dashboards,
-- review queue lookups, and persisted study plan reads.

CREATE INDEX IF NOT EXISTS "QuestionAttempt_user_question_created_desc_idx"
  ON "QuestionAttempt" ("userId", "questionId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ReviewLog_user_question_reviewed_desc_idx"
  ON "ReviewLog" ("userId", "questionId", "reviewedAt" DESC);

CREATE INDEX IF NOT EXISTS "UserProgress_user_system_next_review_idx"
  ON "UserProgress" ("userId", "system", "nextReviewAt");

CREATE INDEX IF NOT EXISTS "DailyStudyPlan_user_status_plan_date_idx"
  ON "DailyStudyPlan" ("userId", "status", "planDate");
