-- Add TARGETED to SessionType enum
ALTER TYPE "SessionType" ADD VALUE 'TARGETED';

-- Create ProgressContext enum
CREATE TYPE "ProgressContext" AS ENUM ('READINESS', 'TARGETED');

-- Add progressContext column to Card with default READINESS
ALTER TABLE "Card" ADD COLUMN "progressContext" "ProgressContext" NOT NULL DEFAULT 'READINESS';

-- Add progressContext column to UserProgress with default READINESS
ALTER TABLE "UserProgress" ADD COLUMN "progressContext" "ProgressContext" NOT NULL DEFAULT 'READINESS';

-- Add progressContext column to UserTopicProgress with default READINESS
ALTER TABLE "UserTopicProgress" ADD COLUMN "progressContext" "ProgressContext" NOT NULL DEFAULT 'READINESS';

-- Drop old unique constraints
ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_userId_questionId_key";
ALTER TABLE "UserProgress" DROP CONSTRAINT IF EXISTS "UserProgress_userId_conditionId_key";
ALTER TABLE "UserTopicProgress" DROP CONSTRAINT IF EXISTS "UserTopicProgress_userId_conditionId_taskType_key";

-- Create new unique constraints that include progressContext
CREATE UNIQUE INDEX "Card_userId_questionId_progressContext_key" ON "Card"("userId", "questionId", "progressContext");
CREATE UNIQUE INDEX "UserProgress_userId_conditionId_progressContext_key" ON "UserProgress"("userId", "conditionId", "progressContext");
CREATE UNIQUE INDEX "UserTopicProgress_userId_conditionId_taskType_progressContext_key" ON "UserTopicProgress"("userId", "conditionId", "taskType", "progressContext");

-- Add performance indexes for context-partitioned queries
CREATE INDEX "Card_userId_progressContext_due_idx" ON "Card"("userId", "progressContext", "due");
CREATE INDEX "UserProgress_userId_progressContext_nextReviewAt_idx" ON "UserProgress"("userId", "progressContext", "nextReviewAt");
