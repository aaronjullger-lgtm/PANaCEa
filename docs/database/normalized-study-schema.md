# Normalized Study Schema

Updated: 2026-05-17

## Scope

This design adds a normalized relational layer for curriculum, study planning, question answer/explanation structure, durable session membership, and scheduler auditability. It is intentionally additive so existing API paths can continue to read legacy JSON/string fields while new code migrates toward relational joins.

Migrations:

- `prisma/migrations/20260502000000_normalized_study_schema/migration.sql`
- `prisma/migrations/20260517000000_add_question_identity_contract/migration.sql`

Prisma source: `prisma/schema.prisma`

## Requirements Covered

- Link users to courses through `UserCourseEnrollment`.
- Link courses to normalized study topics through `CourseStudyTopic`.
- Link topics to canonical clinical content through `StudyTopicCondition`.
- Link questions to topics through `QuestionStudyTopic`.
- Normalize answer choices and explanations through `QuestionAnswerChoice`, `QuestionExplanation`, and `QuestionExplanationCitation`.
- Preserve ordered session membership through `StudySessionQuestion` instead of relying only on `StudySession.questionIds String[]`.
- Normalize study plan tasks through `StudyPlan` and `StudyPlanItem` while keeping `DailyStudyPlan.recommendedSessions` as a backward-compatible cache.
- Harden FSRS/scheduling auditability with FKs and indexes for `ReviewLog.attemptId`, `CalibrationLog.reviewLogId`, and `CalibrationLog.outcomeReviewLogId`.
- Add a durable `QuestionIdentity` contract so canonical `Question`, `PreGeneratedQuestion`, `StagingQuestion`, and `QuestionSeed` rows can be linked to session membership, attempts, review logs, saved questions, and FSRS cards without overloading polymorphic string IDs.

## Entity Map

```mermaid
erDiagram
  User ||--o{ UserCourseEnrollment : enrolls
  Course ||--o{ UserCourseEnrollment : has
  Course ||--o{ CourseStudyTopic : covers
  StudyTopic ||--o{ CourseStudyTopic : appears_in
  StudyTopic ||--o{ StudyTopicCondition : maps_to
  Condition ||--o{ StudyTopicCondition : anchors
  Question ||--o{ QuestionStudyTopic : tests
  StudyTopic ||--o{ QuestionStudyTopic : tagged_by
  Question ||--o{ QuestionAnswerChoice : has
  Question ||--o{ QuestionExplanation : explains
  QuestionExplanation ||--o{ QuestionExplanationCitation : cites
  MedicalContent ||--o{ QuestionExplanationCitation : source
  ContentChunk ||--o{ QuestionExplanationCitation : source
  EducationalResource ||--o{ QuestionExplanationCitation : source
  TextbookChunk ||--o{ QuestionExplanationCitation : source
  User ||--o{ StudyPlan : owns
  Course ||--o{ StudyPlan : scopes
  StudyPlan ||--o{ StudyPlanItem : contains
  StudyTopic ||--o{ StudyPlanItem : targets
  Condition ||--o{ StudyPlanItem : targets
  Question ||--o{ StudyPlanItem : targets
  Card ||--o{ StudyPlanItem : reviews
  StudyPlan ||o--o| DailyStudyPlan : caches
  StudyPlanItem ||--o{ StudySession : launches
  StudySession ||--o{ StudySessionQuestion : serves
  Question ||--o{ StudySessionQuestion : canonical
  PreGeneratedQuestion ||--o{ StudySessionQuestion : generated
  QuestionIdentity ||--o{ StudySessionQuestion : identifies
  QuestionIdentity ||--o{ QuestionAttempt : identifies
  QuestionIdentity ||--o{ ReviewLog : identifies
  QuestionIdentity ||--o{ SavedQuestion : identifies
  QuestionIdentity ||--o{ Card : identifies
  Question ||--o{ QuestionIdentity : canonicalizes
  PreGeneratedQuestion ||--o{ QuestionIdentity : sources
  StagingQuestion ||--o{ QuestionIdentity : sources
  QuestionSeed ||--o{ QuestionIdentity : templates
  QuestionAttempt ||--o{ ReviewLog : produces
  ReviewLog ||--o{ CalibrationLog : calibrates
```

## Normalization Decisions

Prisma model names remain singular because that is the repo convention and keeps generated client names readable. New physical tables use plural snake_case names through `@@map`, matching the requested database naming convention without renaming the existing production tables.

`Course`, `StudyTopic`, `Condition`, `Question`, and `User` are separate entities. Many-to-many relationships are represented by explicit join tables (`CourseStudyTopic`, `StudyTopicCondition`, `QuestionStudyTopic`, `UserCourseEnrollment`) so course membership, curriculum coverage, and question tagging can change independently.

`QuestionAnswerChoice` and `QuestionExplanation` split answer options and rationales out of `Question.options` and `Question.explanation`. The old fields remain as a compatibility cache. The migration adds a partial unique index so only one answer choice can be marked correct per question.

`QuestionExplanationCitation` stores durable grounding for RAG explanations. It can point at `MedicalContent`, `ContentChunk`, `EducationalResource`, or `TextbookChunk`, enforces at least one source pointer, and cascades away when its source is deleted so content maintenance is not blocked by orphaned citations.

`StudySessionQuestion` replaces array-only session membership with ordered rows. It supports canonical `Question` IDs, exact served `PreGeneratedQuestion` IDs, or both when generated questions are mirrored into canonical questions. A check constraint enforces at least one source per row.

`QuestionIdentity` is the stable bridge between source-specific question systems and learner events. It stores `(questionSource, sourceQuestionId)` as the unique natural key and can optionally point to a canonical `Question`, `PreGeneratedQuestion`, `StagingQuestion`, or `QuestionSeed`. `StudySessionQuestion.questionIdentityId`, `QuestionAttempt.questionIdentityId`, `ReviewLog.questionIdentityId`, `SavedQuestion.questionIdentityId`, and `Card.questionIdentityId` are nullable during rollout, then backfilled by migration. This keeps the current `QuestionAttempt.questionId`, `ReviewLog.questionId`, `SavedQuestion.questionId`, and `Card.questionId` compatibility fields intact while giving new scheduling and analytics code a single FK for joins.

`StudyPlan` and `StudyPlanItem` normalize daily plan tasks. `DailyStudyPlan` remains as a denormalized daily response/cache table and now has an optional `studyPlanId`. `StudyPlan.planDate` is the required anchor date for daily, weekly, exam-review, and custom plans. `StudyPlanItem.taskKey` is required so it can preserve the stable task IDs currently passed by the daily-plan API, and `(userId, planType, planDate)` prevents duplicate normalized daily source plans.

## FSRS and Scheduling Contract

The schema preserves PANaCEa's FSRS guardrails:

- Student-facing ratings remain binary: `Again` and `Good`.
- `ReviewLog.grade_continuous` remains a 1.0 to 4.0 continuous rating.
- `ReviewLog.retrievability` remains a 0.0 to 1.0 probability.
- `Card.stability` and `ReviewLog.stability` remain day-based.
- Only real `MAIN` and `DRILL` style review flows should update scheduler state unless product explicitly changes the contract.

The migration also adds:

```sql
CREATE INDEX "ReviewLog_userId_sessionType_review_type_reviewedAt_idx"
  ON "ReviewLog"("userId", "sessionType", "review_type", "reviewedAt" DESC);

CREATE INDEX "ReviewLog_userId_system_sessionType_reviewedAt_idx"
  ON "ReviewLog"("userId", "system", "sessionType", "reviewedAt" DESC);

CREATE INDEX "UserProgress_userId_progressContext_system_nextReviewAt_idx"
  ON "UserProgress"("userId", "progressContext", "system", "nextReviewAt");

CREATE UNIQUE INDEX "question_identities_questionSource_sourceQuestionId_key"
  ON "question_identities"("questionSource", "sourceQuestionId");

CREATE INDEX "ReviewLog_userId_questionIdentityId_reviewedAt_desc_idx"
  ON "ReviewLog"("userId", "questionIdentityId", "reviewedAt" DESC);

CREATE INDEX "QuestionAttempt_userId_questionIdentityId_createdAt_desc_idx"
  ON "QuestionAttempt"("userId", "questionIdentityId", "createdAt" DESC);
```

These match review forecast, dashboard, daily allocator, and optimizer query shapes identified by the scheduling/UI subagent.

## Index Plan

High-cardinality lookup and join columns have btree indexes:

- User-owned rows: `userId`, plus status/date composites for plans and enrollments.
- Curriculum joins: `(courseId, topicId)`, `(topicId, conditionId, relationshipType)`, `(questionId, topicId, role)`.
- Question explainability: `(questionId, explanationType, version)`, `(questionId, isActive)`, citation source IDs.
- Session replay: `(sessionId, sequenceIndex)`, source question IDs, and `attemptId`.
- Scheduler: `Card(userId, progressContext, state, due)`, `ReviewLog` session/type/time composites, `CalibrationLog` FK indexes.
- Source identity: `(questionSource, sourceQuestionId)` for idempotent source lookup, plus `questionIdentityId` indexes on `StudySessionQuestion`, `QuestionAttempt`, `ReviewLog`, and `Card` for replay, optimizer, and analytics joins.
- Saved items: `SavedQuestion(userId, questionIdentityId, type)` supports saved/flagged/missed collections even when source IDs and canonical question IDs differ.

## RLS Plan

The migration enables RLS on new user-owned tables:

- `user_course_enrollments`
- `study_plans`
- `study_plan_items`
- `study_session_questions`

Policies resolve the authenticated Clerk subject to internal `User.id` using the existing `User.clerkId` pattern. Public curriculum and content tables remain public/service-readable through existing API access patterns.

## Migration and Backfill Strategy

1. Deploy the additive normalized-study migration.
2. Deploy the additive question-identity migration; it creates `question_identities`, backfills existing question identities, and sets nullable identity links on current session, attempt, review, saved-question, and card rows.
3. Run the read-only identity rollout audit with `npm run db:audit-learning-identity`; use `-- --fail-on-issues` in CI/staging gates once expected historical gaps are understood.
4. Generate Prisma client with `npx prisma generate`.
5. Backfill curriculum rows from `lib/constants/pa-curriculum.ts` into `courses`, `study_topics`, and `course_study_topics`.
6. Backfill `study_topic_conditions` from current `Condition.system`, `Condition.subcategory`, and `ExamBlueprintCondition`.
7. Backfill `question_study_topics` from `Question.conditionId`, `Question.system`, `Question.topic`, `Question.taskType`, and generated pool metadata.
8. Backfill `question_answer_choices` and `question_explanations` from `Question.options`, `Question.correctAnswer`, and `Question.explanation`.
9. Update session generation to dual-write `StudySessionQuestion` while retaining `StudySession.questionIds`.
10. Update attempt/review/card writers to set `questionIdentityId` directly after the migration is deployed; until then, backfill and compatibility fields preserve behavior.
11. Update daily planning to dual-write `StudyPlan` and `StudyPlanItem` while retaining `DailyStudyPlan.recommendedSessions`.
12. Switch read paths to relational tables after parity checks.
13. Remove or deprecate legacy denormalized fields only after production read paths no longer depend on them.

## Open Decisions

- `UserProgress.conditionId` currently points at `MedicalContent.id`, not `Condition.id`. Renaming or adding a true `medicalContentId` should be a dedicated migration because many scheduler paths rely on the existing field.
- `QuestionVariant` still needs an explicit source-identity relationship if variants become served as first-class learner-facing questions instead of canonical `Question` rows.
- `ProgressContext` comments and live FSRS writer behavior disagree in current code. Resolve the product contract before enforcing stricter scheduler constraints.
