-- CreateEnum
CREATE TYPE "UserLifecycleRole" AS ENUM ('STUDENT', 'PRACTICING_PA');

-- CreateEnum
CREATE TYPE "TrainingPhase" AS ENUM ('DIDACTIC', 'CLINICAL', 'GRADUATED');

-- CreateEnum
CREATE TYPE "CognitiveLevel" AS ENUM ('LEVEL_1_RECALL', 'LEVEL_2_CONCEPT', 'LEVEL_3_VIGNETTE');

-- AlterTable User: Add lifecycle fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lifecycleRole" "UserLifecycleRole" NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trainingPhase" "TrainingPhase";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rotationExamDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeSystems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable Question: Add content granularity fields
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "topic" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "cognitiveLevel" "CognitiveLevel" NOT NULL DEFAULT 'LEVEL_1_RECALL';
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "clinicalSettings" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "relatedDrugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "relatedDiseases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable ReviewLog: Add algorithm fields and Question FK
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "questionFkId" TEXT;
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "review_type" TEXT NOT NULL DEFAULT 'real';

-- Backfill skipped: sessionType may not exist on ReviewLog; default 'real' is applied by ADD COLUMN above.

-- CreateIndex User
CREATE INDEX IF NOT EXISTS "User_lifecycleRole_idx" ON "User"("lifecycleRole");
CREATE INDEX IF NOT EXISTS "User_trainingPhase_idx" ON "User"("trainingPhase");

-- CreateIndex Question
CREATE INDEX IF NOT EXISTS "Question_category_idx" ON "Question"("category");
CREATE INDEX IF NOT EXISTS "Question_topic_idx" ON "Question"("topic");
CREATE INDEX IF NOT EXISTS "Question_cognitiveLevel_idx" ON "Question"("cognitiveLevel");

-- CreateIndex ReviewLog
CREATE INDEX IF NOT EXISTS "ReviewLog_questionFkId_idx" ON "ReviewLog"("questionFkId");

-- AddForeignKey ReviewLog -> Question (when questionFkId is set)
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_questionFkId_fkey" 
  FOREIGN KEY ("questionFkId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
