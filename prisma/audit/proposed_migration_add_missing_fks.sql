-- ============================================================================
-- Proposed migration: add missing foreign keys
-- Date: 2026-04-18
-- Status: DRAFT — awaiting Aaron's approval to apply.
--
-- Context (DATABASE_AUDIT_2026-04-17.md Addendum §A.2 and §A.7 item 5):
--   The 2026-04-17 orphan probe returned 0 orphans across 18 checked
--   references. Every user-activity table is empty on prod as of the audit
--   date. Adding FKs now is free — no cleanup or backfill needed.
--
-- After apply:
--   1. `npx prisma db pull` to sync schema.prisma with the new relations
--   2. Review the @relation additions Prisma generates
--   3. Commit schema.prisma + generated client
--   Alternatively, mirror the @relation additions by hand; see comments.
--
-- ON DELETE choices rationale:
--   * userId → User:              CASCADE  (remove user → remove activity)
--   * questionId → Question:      SET NULL (retain attempts for analytics
--                                           even if question retired)
--   * conditionId → Condition:    SET NULL (field already nullable)
--   * medicalContentId → MC:      SET NULL (field already nullable)
--   * Card.questionId → Question: CASCADE  (FSRS state tied to question)
--   * ItemDifficulty.cardId:      CASCADE  (metrics belong to card)
--   * StudentReservoirItem.questionId → PreGeneratedQuestion: CASCADE
--     (reservoir items are ephemeral; will auto-expire anyway)
-- ============================================================================

-- ── QuestionAttempt ─────────────────────────────────────────────────────────
-- userId → User.id (CASCADE)
ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- questionId → Question.id (SET NULL would require nullability; use CASCADE
-- because retired questions in this corpus are soft-deleted via lifecycle
-- status, not hard-deleted. If policy changes, flip to SET NULL after making
-- questionId nullable.)
ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- conditionId → Condition.id (nullable, SET NULL)
ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_conditionId_fkey"
  FOREIGN KEY ("conditionId") REFERENCES "Condition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- medicalContentId → MedicalContent.id (nullable, SET NULL)
ALTER TABLE "QuestionAttempt"
  ADD CONSTRAINT "QuestionAttempt_medicalContentId_fkey"
  FOREIGN KEY ("medicalContentId") REFERENCES "MedicalContent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── ReviewLog ───────────────────────────────────────────────────────────────
-- User, MedicalContent, Question(via questionFkId) FKs already exist.
-- Only missing: conditionId → Condition.id.
ALTER TABLE "ReviewLog"
  ADD CONSTRAINT "ReviewLog_conditionId_fkey"
  FOREIGN KEY ("conditionId") REFERENCES "Condition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: ReviewLog.questionId (legacy column, separate from questionFkId) is
-- intentionally left without an FK. It is a soft reference retained for
-- backward compatibility. The canonical reference is questionFkId which
-- already has a FK declared.

-- ── Card ────────────────────────────────────────────────────────────────────
-- User FK already exists. Add questionId → Question.id.
ALTER TABLE "Card"
  ADD CONSTRAINT "Card_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── StudentReservoirItem ────────────────────────────────────────────────────
-- userId → User.id
ALTER TABLE "StudentReservoirItem"
  ADD CONSTRAINT "StudentReservoirItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- questionId → PreGeneratedQuestion.id
--   Target is PreGeneratedQuestion (not Question) based on reservoir policy:
--   queue serves from the PreGen pool. If orphan probe #11 vs #12 (see
--   orphan_probes.sql) finds questionId points at Question instead when the
--   table has rows, flip the reference and reapply.
ALTER TABLE "StudentReservoirItem"
  ADD CONSTRAINT "StudentReservoirItem_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "PreGeneratedQuestion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ItemDifficulty ──────────────────────────────────────────────────────────
-- cardId → Card.id (cardId is UNIQUE so this is a 1:1 relation)
ALTER TABLE "ItemDifficulty"
  ADD CONSTRAINT "ItemDifficulty_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "Card"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
