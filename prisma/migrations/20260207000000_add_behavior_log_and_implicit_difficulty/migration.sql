-- CreateTable: BehaviorLog for Ghost Grader (implicit FSRS)
CREATE TABLE IF NOT EXISTS "BehaviorLog" (
    "id" TEXT NOT NULL,
    "questionAttemptId" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "impliedRating" INTEGER,
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorLog_pkey" PRIMARY KEY ("id")
);

-- Add implicitDifficulty to UserTopicProgress (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'UserTopicProgress' AND column_name = 'implicitDifficulty'
  ) THEN
    ALTER TABLE "UserTopicProgress" ADD COLUMN "implicitDifficulty" DOUBLE PRECISION;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BehaviorLog_questionAttemptId_idx" ON "BehaviorLog"("questionAttemptId");

-- AddForeignKey
ALTER TABLE "BehaviorLog" DROP CONSTRAINT IF EXISTS "BehaviorLog_questionAttemptId_fkey";
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_questionAttemptId_fkey" FOREIGN KEY ("questionAttemptId") REFERENCES "QuestionAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
