-- Add missing foreign keys to activity tables.
--
-- Context: 2026-04-17 orphan probe returned 0 orphans across 18 checked references.
-- DB is greenfield (0 QuestionAttempts, 0 ReviewLogs). Adding FKs carries zero risk.
--
-- After apply, run `npx prisma generate` (schema.prisma @relation annotations were
-- added alongside this migration file — no db pull needed).
--
-- ON DELETE policy rationale:
--   userId → User:                       CASCADE  (activity belongs to user)
--   QuestionAttempt.questionId → Q:      CASCADE  (questions soft-deleted via lifecycle)
--   QuestionAttempt.conditionId → C:     SET NULL (nullable, retain analytics row)
--   QuestionAttempt.medicalContentId→MC: SET NULL (nullable)
--   ReviewLog.conditionId → Condition:   SET NULL (nullable, legacy compat)
--   Card.questionId → Question:          CASCADE  (FSRS state tied to question)
--   StudentReservoirItem.userId → User:  CASCADE
--   StudentReservoirItem.questionId→PGQ: CASCADE  (reservoir items ephemeral)
--   ItemDifficulty.cardId → Card:        CASCADE  (metrics belong to card)

-- ── QuestionAttempt ──────────────────────────────────────────────────────────
ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_conditionId_fkey"
  FOREIGN KEY ("conditionId") REFERENCES "Condition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_medicalContentId_fkey"
  FOREIGN KEY ("medicalContentId") REFERENCES "MedicalContent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── ReviewLog ────────────────────────────────────────────────────────────────
-- User, MedicalContent, Question (via questionFkId) FKs already in place.
-- ReviewLog.questionId (legacy soft-ref) intentionally left without FK.
ALTER TABLE "ReviewLog"
  ADD CONSTRAINT "ReviewLog_conditionId_fkey"
  FOREIGN KEY ("conditionId") REFERENCES "Condition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Card ─────────────────────────────────────────────────────────────────────
-- User FK already exists.
ALTER TABLE "Card"
  ADD CONSTRAINT "Card_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── StudentReservoirItem ─────────────────────────────────────────────────────
ALTER TABLE "StudentReservoirItem"
  ADD CONSTRAINT "StudentReservoirItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentReservoirItem"
  ADD CONSTRAINT "StudentReservoirItem_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "PreGeneratedQuestion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ItemDifficulty ───────────────────────────────────────────────────────────
ALTER TABLE "ItemDifficulty"
  ADD CONSTRAINT "ItemDifficulty_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "Card"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
