-- Durable question identity contract.
--
-- This migration adds a normalized source-identity table and nullable links from
-- the hot learning-event tables. It is additive: existing writers keep working,
-- and the backfill resolves current canonical/pregenerated/staging/seed rows.

CREATE TABLE IF NOT EXISTS "question_identities" (
  "id" TEXT NOT NULL,
  "questionSource" TEXT NOT NULL,
  "sourceQuestionId" TEXT NOT NULL,
  "canonicalQuestionId" TEXT,
  "preGeneratedQuestionId" TEXT,
  "stagingQuestionId" TEXT,
  "questionSeedId" TEXT,
  "fingerprint" TEXT,
  "provenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "question_identities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_identities_questionSource_sourceQuestionId_key"
    UNIQUE ("questionSource", "sourceQuestionId"),
  CONSTRAINT "question_identities_questionSource_check"
    CHECK ("questionSource" IN ('question', 'pre_generated', 'staging', 'seed', 'generated')),
  CONSTRAINT "question_identities_canonicalQuestionId_fkey"
    FOREIGN KEY ("canonicalQuestionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "question_identities_preGeneratedQuestionId_fkey"
    FOREIGN KEY ("preGeneratedQuestionId") REFERENCES "PreGeneratedQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "question_identities_stagingQuestionId_fkey"
    FOREIGN KEY ("stagingQuestionId") REFERENCES "StagingQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "question_identities_questionSeedId_fkey"
    FOREIGN KEY ("questionSeedId") REFERENCES "QuestionSeed"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "questionIdentityId" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "questionIdentityId" TEXT;
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "questionIdentityId" TEXT;
ALTER TABLE "SavedQuestion" ADD COLUMN IF NOT EXISTS "questionIdentityId" TEXT;
ALTER TABLE "study_session_questions" ADD COLUMN IF NOT EXISTS "questionIdentityId" TEXT;

INSERT INTO "question_identities" (
  "id",
  "questionSource",
  "sourceQuestionId",
  "canonicalQuestionId",
  "provenance",
  "createdAt",
  "updatedAt"
)
SELECT
  'qid_q_' || md5(q.id),
  'question',
  q.id,
  q.id,
  jsonb_build_object(
    'system', q."system",
    'conditionId', q."conditionId",
    'medicalContentId', q."medicalContentId",
    'lifecycleStatus', q."lifecycleStatus",
    'qaStatus', q."qaStatus"
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Question" q
ON CONFLICT ("questionSource", "sourceQuestionId") DO UPDATE SET
  "canonicalQuestionId" = EXCLUDED."canonicalQuestionId",
  "provenance" = EXCLUDED."provenance",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "question_identities" (
  "id",
  "questionSource",
  "sourceQuestionId",
  "canonicalQuestionId",
  "preGeneratedQuestionId",
  "fingerprint",
  "provenance",
  "createdAt",
  "updatedAt"
)
SELECT
  'qid_pgq_' || md5(pgq.id),
  'pre_generated',
  pgq.id,
  q.id,
  pgq.id,
  pgq."semanticHash",
  jsonb_build_object(
    'questionType', pgq."questionType",
    'system', pgq."system",
    'conditionId', pgq."conditionId",
    'medicalContentId', pgq."medicalContentId",
    'validationStatus', pgq."validationStatus",
    'qualityScore', pgq."qualityScore"
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PreGeneratedQuestion" pgq
LEFT JOIN "Question" q ON q.id = pgq.id
ON CONFLICT ("questionSource", "sourceQuestionId") DO UPDATE SET
  "canonicalQuestionId" = EXCLUDED."canonicalQuestionId",
  "preGeneratedQuestionId" = EXCLUDED."preGeneratedQuestionId",
  "fingerprint" = EXCLUDED."fingerprint",
  "provenance" = EXCLUDED."provenance",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "question_identities" (
  "id",
  "questionSource",
  "sourceQuestionId",
  "stagingQuestionId",
  "provenance",
  "createdAt",
  "updatedAt"
)
SELECT
  'qid_stg_' || md5(s.id),
  'staging',
  s.id,
  s.id,
  jsonb_build_object(
    'system', s."system",
    'difficulty', s."difficulty",
    'status', s."status",
    'aiModel', s."aiModel"
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "StagingQuestion" s
ON CONFLICT ("questionSource", "sourceQuestionId") DO UPDATE SET
  "stagingQuestionId" = EXCLUDED."stagingQuestionId",
  "provenance" = EXCLUDED."provenance",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "question_identities" (
  "id",
  "questionSource",
  "sourceQuestionId",
  "questionSeedId",
  "provenance",
  "createdAt",
  "updatedAt"
)
SELECT
  'qid_seed_' || md5(qs.id),
  'seed',
  qs.id,
  qs.id,
  jsonb_build_object(
    'questionType', qs."questionType",
    'system', qs."system",
    'conditionId', qs."conditionId",
    'medicalContentId', qs."medicalContentId",
    'usageCount', qs."usageCount"
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "QuestionSeed" qs
ON CONFLICT ("questionSource", "sourceQuestionId") DO UPDATE SET
  "questionSeedId" = EXCLUDED."questionSeedId",
  "provenance" = EXCLUDED."provenance",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "study_session_questions" ssq
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE ssq."questionIdentityId" IS NULL
  AND ssq."preGeneratedQuestionId" IS NOT NULL
  AND qi."questionSource" = 'pre_generated'
  AND qi."sourceQuestionId" = ssq."preGeneratedQuestionId";

UPDATE "study_session_questions" ssq
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE ssq."questionIdentityId" IS NULL
  AND ssq."questionId" IS NOT NULL
  AND qi."questionSource" = 'question'
  AND qi."sourceQuestionId" = ssq."questionId";

UPDATE "QuestionAttempt" qa
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE qa."questionIdentityId" IS NULL
  AND qi."questionSource" = 'question'
  AND qi."sourceQuestionId" = qa."questionId";

UPDATE "ReviewLog" rl
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE rl."questionIdentityId" IS NULL
  AND rl."questionId" IS NOT NULL
  AND qi."questionSource" = 'pre_generated'
  AND qi."sourceQuestionId" = rl."questionId";

UPDATE "ReviewLog" rl
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE rl."questionIdentityId" IS NULL
  AND COALESCE(rl."questionFkId", rl."questionId") IS NOT NULL
  AND qi."questionSource" = 'question'
  AND qi."sourceQuestionId" = COALESCE(rl."questionFkId", rl."questionId");

UPDATE "Card" c
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE c."questionIdentityId" IS NULL
  AND qi."questionSource" = 'question'
  AND qi."sourceQuestionId" = c."questionId";

UPDATE "SavedQuestion" sq
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE sq."questionIdentityId" IS NULL
  AND qi."questionSource" = 'pre_generated'
  AND qi."sourceQuestionId" = sq."questionId";

UPDATE "SavedQuestion" sq
SET "questionIdentityId" = qi.id
FROM "question_identities" qi
WHERE sq."questionIdentityId" IS NULL
  AND qi."questionSource" = 'question'
  AND qi."sourceQuestionId" = sq."questionId";

DO $$
BEGIN
  ALTER TABLE "Card"
    ADD CONSTRAINT "Card_questionIdentityId_fkey"
    FOREIGN KEY ("questionIdentityId") REFERENCES "question_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "QuestionAttempt"
    ADD CONSTRAINT "QuestionAttempt_questionIdentityId_fkey"
    FOREIGN KEY ("questionIdentityId") REFERENCES "question_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReviewLog"
    ADD CONSTRAINT "ReviewLog_questionIdentityId_fkey"
    FOREIGN KEY ("questionIdentityId") REFERENCES "question_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SavedQuestion"
    ADD CONSTRAINT "SavedQuestion_questionIdentityId_fkey"
    FOREIGN KEY ("questionIdentityId") REFERENCES "question_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "study_session_questions"
    ADD CONSTRAINT "study_session_questions_questionIdentityId_fkey"
    FOREIGN KEY ("questionIdentityId") REFERENCES "question_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "question_identities_canonicalQuestionId_idx"
  ON "question_identities"("canonicalQuestionId");
CREATE INDEX IF NOT EXISTS "question_identities_preGeneratedQuestionId_idx"
  ON "question_identities"("preGeneratedQuestionId");
CREATE INDEX IF NOT EXISTS "question_identities_questionSeedId_idx"
  ON "question_identities"("questionSeedId");
CREATE INDEX IF NOT EXISTS "question_identities_questionSource_idx"
  ON "question_identities"("questionSource");
CREATE INDEX IF NOT EXISTS "question_identities_stagingQuestionId_idx"
  ON "question_identities"("stagingQuestionId");

CREATE INDEX IF NOT EXISTS "Card_questionIdentityId_idx"
  ON "Card"("questionIdentityId");
CREATE INDEX IF NOT EXISTS "Card_userId_questionIdentityId_progressContext_idx"
  ON "Card"("userId", "questionIdentityId", "progressContext");

CREATE INDEX IF NOT EXISTS "QuestionAttempt_questionIdentityId_idx"
  ON "QuestionAttempt"("questionIdentityId");
CREATE INDEX IF NOT EXISTS "QuestionAttempt_userId_questionIdentityId_createdAt_desc_idx"
  ON "QuestionAttempt"("userId", "questionIdentityId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ReviewLog_questionIdentityId_idx"
  ON "ReviewLog"("questionIdentityId");
CREATE INDEX IF NOT EXISTS "ReviewLog_userId_questionIdentityId_reviewedAt_desc_idx"
  ON "ReviewLog"("userId", "questionIdentityId", "reviewedAt" DESC);

CREATE INDEX IF NOT EXISTS "SavedQuestion_questionIdentityId_idx"
  ON "SavedQuestion"("questionIdentityId");
CREATE INDEX IF NOT EXISTS "SavedQuestion_userId_questionIdentityId_type_idx"
  ON "SavedQuestion"("userId", "questionIdentityId", "type");

CREATE INDEX IF NOT EXISTS "study_session_questions_questionIdentityId_idx"
  ON "study_session_questions"("questionIdentityId");
CREATE INDEX IF NOT EXISTS "study_session_questions_sessionId_questionIdentityId_idx"
  ON "study_session_questions"("sessionId", "questionIdentityId");
