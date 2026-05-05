-- Normalized study schema layer.
--
-- Adds relational course/topic, question answer/explanation, study plan item,
-- and session-question tables while preserving current JSON/string columns for
-- backward-compatible reads during the cutover.

DO $$
BEGIN
  CREATE TYPE "CoursePhase" AS ENUM ('DIDACTIC', 'CLINICAL', 'PANCE_PREP', 'CME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CourseEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudyTopicQuestionRole" AS ENUM ('PRIMARY', 'SECONDARY', 'PREREQUISITE', 'REMEDIATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "QuestionExplanationType" AS ENUM ('CORRECT_RATIONALE', 'INCORRECT_RATIONALE', 'TEACHING_POINT', 'PEARL', 'SOURCE_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudyPlanType" AS ENUM ('DAILY', 'WEEKLY', 'EXAM_REVIEW', 'ROTATION_REVIEW', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudyPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudyPlanItemType" AS ENUM ('QUESTION_BLOCK', 'REVIEW_BLOCK', 'CONTENT_REVIEW', 'PRACTICE_CASE', 'REST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "StudyPlanItemStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'RESCHEDULED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "courses" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "phase" "CoursePhase" NOT NULL,
  "description" TEXT,
  "semester" INTEGER,
  "rotationWeeks" INTEGER,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "study_topics" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "system" TEXT,
  "subcategory" TEXT,
  "parentId" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "study_topics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "study_topics_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "study_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "course_study_topics" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "course_study_topics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_study_topics_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "course_study_topics_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "study_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "study_topic_conditions" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL DEFAULT 'core',
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "study_topic_conditions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "study_topic_conditions_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "study_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_topic_conditions_conditionId_fkey"
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_course_enrollments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "status" "CourseEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "targetExamDate" TIMESTAMP(3),
  "retentionTarget" DOUBLE PRECISION,
  "personalizationFlags" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_course_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_course_enrollments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_course_enrollments_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_course_enrollments_retentionTarget_check"
    CHECK ("retentionTarget" IS NULL OR ("retentionTarget" >= 0.80 AND "retentionTarget" <= 0.95))
);

CREATE TABLE IF NOT EXISTS "question_answer_choices" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "choiceKey" TEXT NOT NULL,
  "choiceText" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "rationale" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "question_answer_choices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_answer_choices_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_answer_choices_displayOrder_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE IF NOT EXISTS "question_explanations" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "explanationType" "QuestionExplanationType" NOT NULL DEFAULT 'CORRECT_RATIONALE',
  "title" TEXT,
  "body" TEXT NOT NULL,
  "sourceCitation" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "question_explanations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_explanations_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_explanations_version_check" CHECK ("version" >= 1)
);

CREATE TABLE IF NOT EXISTS "question_explanation_citations" (
  "id" TEXT NOT NULL,
  "questionExplanationId" TEXT NOT NULL,
  "medicalContentId" TEXT,
  "contentChunkId" TEXT,
  "educationalResourceId" TEXT,
  "textbookChunkId" TEXT,
  "citationText" TEXT,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "question_explanation_citations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_explanation_citations_questionExplanationId_fkey"
    FOREIGN KEY ("questionExplanationId") REFERENCES "question_explanations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_explanation_citations_medicalContentId_fkey"
    FOREIGN KEY ("medicalContentId") REFERENCES "MedicalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_explanation_citations_contentChunkId_fkey"
    FOREIGN KEY ("contentChunkId") REFERENCES "ContentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_explanation_citations_educationalResourceId_fkey"
    FOREIGN KEY ("educationalResourceId") REFERENCES "EducationalResource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_explanation_citations_textbookChunkId_fkey"
    FOREIGN KEY ("textbookChunkId") REFERENCES "TextbookChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_explanation_citations_rank_check" CHECK ("rank" >= 0),
  CONSTRAINT "question_explanation_citations_source_check"
    CHECK ((("medicalContentId" IS NOT NULL)::integer + ("contentChunkId" IS NOT NULL)::integer + ("educationalResourceId" IS NOT NULL)::integer + ("textbookChunkId" IS NOT NULL)::integer) >= 1)
);

CREATE TABLE IF NOT EXISTS "question_study_topics" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "role" "StudyTopicQuestionRole" NOT NULL DEFAULT 'PRIMARY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "question_study_topics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_study_topics_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "question_study_topics_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "study_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "study_plans" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT,
  "name" TEXT NOT NULL,
  "planType" "StudyPlanType" NOT NULL DEFAULT 'DAILY',
  "planDate" DATE NOT NULL,
  "startsOn" DATE,
  "endsOn" DATE,
  "status" "StudyPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "targetQuestionsCount" INTEGER NOT NULL DEFAULT 0,
  "estimatedTimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "personalizationSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "study_plans_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_plans_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "study_plans_targetQuestionsCount_check" CHECK ("targetQuestionsCount" >= 0),
  CONSTRAINT "study_plans_estimatedTimeMinutes_check" CHECK ("estimatedTimeMinutes" >= 0)
);

CREATE TABLE IF NOT EXISTS "study_plan_items" (
  "id" TEXT NOT NULL,
  "studyPlanId" TEXT NOT NULL,
  "taskKey" TEXT NOT NULL,
  "topicId" TEXT,
  "conditionId" TEXT,
  "questionId" TEXT,
  "cardId" TEXT,
  "mode" TEXT NOT NULL,
  "itemType" "StudyPlanItemType" NOT NULL DEFAULT 'QUESTION_BLOCK',
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
  "priority" INTEGER NOT NULL DEFAULT 5,
  "rationale" TEXT,
  "status" "StudyPlanItemStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "study_plan_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "study_plan_items_studyPlanId_fkey"
    FOREIGN KEY ("studyPlanId") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_plan_items_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "study_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "study_plan_items_conditionId_fkey"
    FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "study_plan_items_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "study_plan_items_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "study_plan_items_targetCount_check" CHECK ("targetCount" >= 0),
  CONSTRAINT "study_plan_items_estimatedMinutes_check" CHECK ("estimatedMinutes" >= 0),
  CONSTRAINT "study_plan_items_priority_check" CHECK ("priority" BETWEEN 1 AND 10)
);

CREATE TABLE IF NOT EXISTS "study_session_questions" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "questionId" TEXT,
  "preGeneratedQuestionId" TEXT,
  "sequenceIndex" INTEGER NOT NULL,
  "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  "attemptId" TEXT,
  "source" TEXT,
  "metadata" JSONB,

  CONSTRAINT "study_session_questions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "study_session_questions_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_session_questions_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_session_questions_preGeneratedQuestionId_fkey"
    FOREIGN KEY ("preGeneratedQuestionId") REFERENCES "PreGeneratedQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_session_questions_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "QuestionAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "study_session_questions_source_check"
    CHECK ((("questionId" IS NOT NULL)::integer + ("preGeneratedQuestionId" IS NOT NULL)::integer) >= 1),
  CONSTRAINT "study_session_questions_sequenceIndex_check" CHECK ("sequenceIndex" >= 0)
);

ALTER TABLE "DailyStudyPlan" ADD COLUMN IF NOT EXISTS "studyPlanId" TEXT;
ALTER TABLE "StudySession" ADD COLUMN IF NOT EXISTS "studyPlanItemId" TEXT;

-- Existing QuestionSeed condition references already use ON DELETE SET NULL;
-- the scalar column must be nullable for that referential action to succeed.
ALTER TABLE "QuestionSeed" ALTER COLUMN "conditionId" DROP NOT NULL;

ALTER TABLE "DailyStudyPlan"
  ADD CONSTRAINT "DailyStudyPlan_studyPlanId_fkey"
  FOREIGN KEY ("studyPlanId") REFERENCES "study_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudySession"
  ADD CONSTRAINT "StudySession_studyPlanItemId_fkey"
  FOREIGN KEY ("studyPlanItemId") REFERENCES "study_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Harden existing scheduler/audit soft references before adding FKs.
UPDATE "ReviewLog" rl
SET "attemptId" = NULL
WHERE rl."attemptId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "QuestionAttempt" qa WHERE qa.id = rl."attemptId");

UPDATE "CalibrationLog" cl
SET "reviewLogId" = NULL
WHERE cl."reviewLogId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ReviewLog" rl WHERE rl.id = cl."reviewLogId");

UPDATE "CalibrationLog" cl
SET "outcomeReviewLogId" = NULL
WHERE cl."outcomeReviewLogId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ReviewLog" rl WHERE rl.id = cl."outcomeReviewLogId");

ALTER TABLE "ReviewLog"
  ADD CONSTRAINT "ReviewLog_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "QuestionAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalibrationLog"
  ADD CONSTRAINT "CalibrationLog_reviewLogId_fkey"
  FOREIGN KEY ("reviewLogId") REFERENCES "ReviewLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalibrationLog"
  ADD CONSTRAINT "CalibrationLog_outcomeReviewLogId_fkey"
  FOREIGN KEY ("outcomeReviewLogId") REFERENCES "ReviewLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "courses_code_key" ON "courses"("code");
CREATE INDEX IF NOT EXISTS "courses_phase_idx" ON "courses"("phase");
CREATE INDEX IF NOT EXISTS "courses_isActive_idx" ON "courses"("isActive");
CREATE INDEX IF NOT EXISTS "courses_title_idx" ON "courses"("title");

CREATE INDEX IF NOT EXISTS "Card_userId_progressContext_state_due_idx" ON "Card"("userId", "progressContext", "state", "due");

CREATE UNIQUE INDEX IF NOT EXISTS "study_topics_slug_key" ON "study_topics"("slug");
CREATE INDEX IF NOT EXISTS "study_topics_system_idx" ON "study_topics"("system");
CREATE INDEX IF NOT EXISTS "study_topics_system_subcategory_idx" ON "study_topics"("system", "subcategory");
CREATE INDEX IF NOT EXISTS "study_topics_parentId_idx" ON "study_topics"("parentId");

CREATE UNIQUE INDEX IF NOT EXISTS "course_study_topics_courseId_topicId_key" ON "course_study_topics"("courseId", "topicId");
CREATE INDEX IF NOT EXISTS "course_study_topics_courseId_displayOrder_idx" ON "course_study_topics"("courseId", "displayOrder");
CREATE INDEX IF NOT EXISTS "course_study_topics_topicId_idx" ON "course_study_topics"("topicId");

CREATE UNIQUE INDEX IF NOT EXISTS "study_topic_conditions_topicId_conditionId_relationshipType_key" ON "study_topic_conditions"("topicId", "conditionId", "relationshipType");
CREATE INDEX IF NOT EXISTS "study_topic_conditions_conditionId_idx" ON "study_topic_conditions"("conditionId");
CREATE INDEX IF NOT EXISTS "study_topic_conditions_topicId_weight_idx" ON "study_topic_conditions"("topicId", "weight");

CREATE UNIQUE INDEX IF NOT EXISTS "user_course_enrollments_userId_courseId_key" ON "user_course_enrollments"("userId", "courseId");
CREATE INDEX IF NOT EXISTS "user_course_enrollments_courseId_status_idx" ON "user_course_enrollments"("courseId", "status");
CREATE INDEX IF NOT EXISTS "user_course_enrollments_targetExamDate_idx" ON "user_course_enrollments"("targetExamDate");
CREATE INDEX IF NOT EXISTS "user_course_enrollments_userId_status_idx" ON "user_course_enrollments"("userId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "question_answer_choices_questionId_choiceKey_key" ON "question_answer_choices"("questionId", "choiceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "question_answer_choices_one_correct_idx" ON "question_answer_choices"("questionId") WHERE "isCorrect" = true;
CREATE INDEX IF NOT EXISTS "question_answer_choices_questionId_displayOrder_idx" ON "question_answer_choices"("questionId", "displayOrder");
CREATE INDEX IF NOT EXISTS "question_answer_choices_isCorrect_idx" ON "question_answer_choices"("isCorrect");

CREATE UNIQUE INDEX IF NOT EXISTS "question_explanations_questionId_explanationType_version_key" ON "question_explanations"("questionId", "explanationType", "version");
CREATE INDEX IF NOT EXISTS "question_explanations_explanationType_idx" ON "question_explanations"("explanationType");
CREATE INDEX IF NOT EXISTS "question_explanations_questionId_isActive_idx" ON "question_explanations"("questionId", "isActive");

CREATE INDEX IF NOT EXISTS "question_explanation_citations_contentChunkId_idx" ON "question_explanation_citations"("contentChunkId");
CREATE INDEX IF NOT EXISTS "question_explanation_citations_educationalResourceId_idx" ON "question_explanation_citations"("educationalResourceId");
CREATE INDEX IF NOT EXISTS "question_explanation_citations_medicalContentId_idx" ON "question_explanation_citations"("medicalContentId");
CREATE INDEX IF NOT EXISTS "question_explanation_citations_questionExplanationId_rank_idx" ON "question_explanation_citations"("questionExplanationId", "rank");
CREATE INDEX IF NOT EXISTS "question_explanation_citations_textbookChunkId_idx" ON "question_explanation_citations"("textbookChunkId");

CREATE UNIQUE INDEX IF NOT EXISTS "question_study_topics_questionId_topicId_role_key" ON "question_study_topics"("questionId", "topicId", "role");
CREATE INDEX IF NOT EXISTS "question_study_topics_questionId_idx" ON "question_study_topics"("questionId");
CREATE INDEX IF NOT EXISTS "question_study_topics_topicId_role_idx" ON "question_study_topics"("topicId", "role");

CREATE UNIQUE INDEX IF NOT EXISTS "study_plans_userId_planType_planDate_key" ON "study_plans"("userId", "planType", "planDate");
CREATE INDEX IF NOT EXISTS "study_plans_courseId_idx" ON "study_plans"("courseId");
CREATE INDEX IF NOT EXISTS "study_plans_userId_planDate_idx" ON "study_plans"("userId", "planDate");
CREATE INDEX IF NOT EXISTS "study_plans_userId_status_planDate_idx" ON "study_plans"("userId", "status", "planDate");

CREATE UNIQUE INDEX IF NOT EXISTS "study_plan_items_studyPlanId_taskKey_key" ON "study_plan_items"("studyPlanId", "taskKey");
CREATE INDEX IF NOT EXISTS "study_plan_items_cardId_idx" ON "study_plan_items"("cardId");
CREATE INDEX IF NOT EXISTS "study_plan_items_conditionId_idx" ON "study_plan_items"("conditionId");
CREATE INDEX IF NOT EXISTS "study_plan_items_questionId_idx" ON "study_plan_items"("questionId");
CREATE INDEX IF NOT EXISTS "study_plan_items_status_dueAt_idx" ON "study_plan_items"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "study_plan_items_studyPlanId_priority_idx" ON "study_plan_items"("studyPlanId", "priority");
CREATE INDEX IF NOT EXISTS "study_plan_items_topicId_idx" ON "study_plan_items"("topicId");

CREATE UNIQUE INDEX IF NOT EXISTS "study_session_questions_attemptId_key" ON "study_session_questions"("attemptId");
CREATE UNIQUE INDEX IF NOT EXISTS "study_session_questions_sessionId_preGeneratedQuestionId_key" ON "study_session_questions"("sessionId", "preGeneratedQuestionId");
CREATE UNIQUE INDEX IF NOT EXISTS "study_session_questions_sessionId_questionId_key" ON "study_session_questions"("sessionId", "questionId");
CREATE INDEX IF NOT EXISTS "study_session_questions_attemptId_idx" ON "study_session_questions"("attemptId");
CREATE INDEX IF NOT EXISTS "study_session_questions_preGeneratedQuestionId_idx" ON "study_session_questions"("preGeneratedQuestionId");
CREATE INDEX IF NOT EXISTS "study_session_questions_questionId_idx" ON "study_session_questions"("questionId");
CREATE INDEX IF NOT EXISTS "study_session_questions_sessionId_sequenceIndex_idx" ON "study_session_questions"("sessionId", "sequenceIndex");

CREATE UNIQUE INDEX IF NOT EXISTS "DailyStudyPlan_studyPlanId_key" ON "DailyStudyPlan"("studyPlanId");
CREATE INDEX IF NOT EXISTS "DailyStudyPlan_studyPlanId_idx" ON "DailyStudyPlan"("studyPlanId");
CREATE INDEX IF NOT EXISTS "StudySession_studyPlanItemId_idx" ON "StudySession"("studyPlanItemId");

CREATE INDEX IF NOT EXISTS "ReviewLog_attemptId_idx" ON "ReviewLog"("attemptId");
CREATE INDEX IF NOT EXISTS "ReviewLog_userId_sessionType_review_type_reviewedAt_idx"
  ON "ReviewLog"("userId", "sessionType", "review_type", "reviewedAt" DESC);
CREATE INDEX IF NOT EXISTS "ReviewLog_userId_system_sessionType_reviewedAt_idx"
  ON "ReviewLog"("userId", "system", "sessionType", "reviewedAt" DESC);

CREATE INDEX IF NOT EXISTS "CalibrationLog_outcomeReviewLogId_idx" ON "CalibrationLog"("outcomeReviewLogId");
CREATE INDEX IF NOT EXISTS "CalibrationLog_reviewLogId_idx" ON "CalibrationLog"("reviewLogId");

CREATE INDEX IF NOT EXISTS "UserProgress_userId_progressContext_system_nextReviewAt_idx"
  ON "UserProgress"("userId", "progressContext", "system", "nextReviewAt");

-- RLS for user-owned additions. Public curriculum and question content tables
-- remain readable through existing service/auth paths; only per-user records are
-- locked to the owning Clerk subject.
ALTER TABLE "user_course_enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_plan_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_session_questions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_course_enrollments_select_own" ON "user_course_enrollments"
  FOR SELECT USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_course_enrollments_insert_own" ON "user_course_enrollments"
  FOR INSERT WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_course_enrollments_update_own" ON "user_course_enrollments"
  FOR UPDATE USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text))
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "user_course_enrollments_admin" ON "user_course_enrollments"
  USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

CREATE POLICY "study_plans_select_own" ON "study_plans"
  FOR SELECT USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "study_plans_insert_own" ON "study_plans"
  FOR INSERT WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "study_plans_update_own" ON "study_plans"
  FOR UPDATE USING ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text))
  WITH CHECK ("userId" IN (SELECT id FROM "User" WHERE "clerkId" = auth.uid()::text));

CREATE POLICY "study_plans_admin" ON "study_plans"
  USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

CREATE POLICY "study_plan_items_select_own" ON "study_plan_items"
  FOR SELECT USING (
    "studyPlanId" IN (
      SELECT sp.id FROM "study_plans" sp
      JOIN "User" u ON sp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

CREATE POLICY "study_plan_items_insert_own" ON "study_plan_items"
  FOR INSERT WITH CHECK (
    "studyPlanId" IN (
      SELECT sp.id FROM "study_plans" sp
      JOIN "User" u ON sp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

CREATE POLICY "study_plan_items_update_own" ON "study_plan_items"
  FOR UPDATE USING (
    "studyPlanId" IN (
      SELECT sp.id FROM "study_plans" sp
      JOIN "User" u ON sp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "studyPlanId" IN (
      SELECT sp.id FROM "study_plans" sp
      JOIN "User" u ON sp."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

CREATE POLICY "study_plan_items_admin" ON "study_plan_items"
  USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));

CREATE POLICY "study_session_questions_select_own" ON "study_session_questions"
  FOR SELECT USING (
    "sessionId" IN (
      SELECT ss.id FROM "StudySession" ss
      JOIN "User" u ON ss."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

CREATE POLICY "study_session_questions_insert_own" ON "study_session_questions"
  FOR INSERT WITH CHECK (
    "sessionId" IN (
      SELECT ss.id FROM "StudySession" ss
      JOIN "User" u ON ss."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

CREATE POLICY "study_session_questions_update_own" ON "study_session_questions"
  FOR UPDATE USING (
    "sessionId" IN (
      SELECT ss.id FROM "StudySession" ss
      JOIN "User" u ON ss."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "sessionId" IN (
      SELECT ss.id FROM "StudySession" ss
      JOIN "User" u ON ss."userId" = u.id
      WHERE u."clerkId" = auth.uid()::text
    )
  );

CREATE POLICY "study_session_questions_admin" ON "study_session_questions"
  USING (auth.jwt() ->> 'role' IN ('service_role', 'admin'));
