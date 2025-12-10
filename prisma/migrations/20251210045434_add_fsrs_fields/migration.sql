/*
  Warnings:

  - You are about to drop the column `category` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `conditionId` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `difficulty` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `extractedAt` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `extractedBy` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `fullExplanation` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `pearlText` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `questionId` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `usefulVotes` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `ClinicalPearl` table. All the data in the column will be lost.
  - The `tags` column on the `ClinicalPearl` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `adequacyDetails` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `adequacyScore` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `adequacyStatus` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `checkedAt` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `conditionId` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `explanationLength` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `generatedAt` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `hasCorrectAnswer` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `hasMedicalErrors` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `promotedAt` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `questionData` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `questionType` on the `StagingQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `conditionId` on the `UserQuestionHistory` table. All the data in the column will be lost.
  - You are about to drop the column `questionType` on the `UserQuestionHistory` table. All the data in the column will be lost.
  - You are about to drop the column `system` on the `UserQuestionHistory` table. All the data in the column will be lost.
  - You are about to drop the column `wasCorrect` on the `UserQuestionHistory` table. All the data in the column will be lost.
  - You are about to drop the `BountyReward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContentDriftReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GuidelineConflict` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GuidelineVersion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NCCPABlueprint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionMigration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionSeed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionVerification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StalenessReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserPearl` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `text` to the `ClinicalPearl` table without a default value. This is not possible if the table is not empty.
  - Made the column `system` on table `ClinicalPearl` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `correctAnswer` to the `StagingQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `explanation` to the `StagingQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `options` to the `StagingQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `StagingQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vignette` to the `StagingQuestion` table without a default value. This is not possible if the table is not empty.
  - Made the column `system` on table `StagingQuestion` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `isCorrect` to the `UserQuestionHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GuidelineConflict" DROP CONSTRAINT "GuidelineConflict_guidelineVersionId_fkey";

-- DropIndex
DROP INDEX "ClinicalPearl_category_idx";

-- DropIndex
DROP INDEX "ClinicalPearl_conditionId_idx";

-- DropIndex
DROP INDEX "ClinicalPearl_extractedAt_idx";

-- DropIndex
DROP INDEX "ClinicalPearl_questionId_idx";

-- DropIndex
DROP INDEX "ClinicalPearl_tags_idx";

-- DropIndex
DROP INDEX "StagingQuestion_adequacyStatus_idx";

-- DropIndex
DROP INDEX "StagingQuestion_generatedAt_idx";

-- DropIndex
DROP INDEX "StagingQuestion_questionType_idx";

-- DropIndex
DROP INDEX "UserQuestionHistory_questionId_idx";

-- DropIndex
DROP INDEX "UserQuestionHistory_seenAt_idx";

-- DropIndex
DROP INDEX "UserQuestionHistory_userId_conditionId_idx";

-- DropIndex
DROP INDEX "UserQuestionHistory_userId_system_idx";

-- AlterTable
ALTER TABLE "ClinicalPearl" DROP COLUMN "category",
DROP COLUMN "conditionId",
DROP COLUMN "difficulty",
DROP COLUMN "extractedAt",
DROP COLUMN "extractedBy",
DROP COLUMN "fullExplanation",
DROP COLUMN "pearlText",
DROP COLUMN "questionId",
DROP COLUMN "usefulVotes",
DROP COLUMN "viewCount",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sourceQuestionId" TEXT,
ADD COLUMN     "text" TEXT NOT NULL,
ALTER COLUMN "system" SET NOT NULL,
DROP COLUMN "tags",
ADD COLUMN     "tags" JSONB;

-- AlterTable
ALTER TABLE "SRSItem" ADD COLUMN     "fsrsDifficulty" DOUBLE PRECISION,
ADD COLUMN     "fsrsLastReview" TIMESTAMP(3),
ADD COLUMN     "fsrsStability" DOUBLE PRECISION,
ADD COLUMN     "fsrsState" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StagingQuestion" DROP COLUMN "adequacyDetails",
DROP COLUMN "adequacyScore",
DROP COLUMN "adequacyStatus",
DROP COLUMN "checkedAt",
DROP COLUMN "conditionId",
DROP COLUMN "explanationLength",
DROP COLUMN "generatedAt",
DROP COLUMN "hasCorrectAnswer",
DROP COLUMN "hasMedicalErrors",
DROP COLUMN "promotedAt",
DROP COLUMN "questionData",
DROP COLUMN "questionType",
ADD COLUMN     "adminReview" TEXT,
ADD COLUMN     "aiGrade" JSONB,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "correctAnswer" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "explanation" TEXT NOT NULL,
ADD COLUMN     "generationPrompt" TEXT,
ADD COLUMN     "options" JSONB NOT NULL,
ADD COLUMN     "question" TEXT NOT NULL,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "vignette" TEXT NOT NULL,
ALTER COLUMN "system" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "UserQuestionHistory" DROP COLUMN "conditionId",
DROP COLUMN "questionType",
DROP COLUMN "system",
DROP COLUMN "wasCorrect",
ADD COLUMN     "isCorrect" BOOLEAN NOT NULL;

-- DropTable
DROP TABLE "BountyReward";

-- DropTable
DROP TABLE "ContentDriftReport";

-- DropTable
DROP TABLE "GuidelineConflict";

-- DropTable
DROP TABLE "GuidelineVersion";

-- DropTable
DROP TABLE "NCCPABlueprint";

-- DropTable
DROP TABLE "QuestionMigration";

-- DropTable
DROP TABLE "QuestionSeed";

-- DropTable
DROP TABLE "QuestionVerification";

-- DropTable
DROP TABLE "StalenessReport";

-- DropTable
DROP TABLE "UserPearl";

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "vignette" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "tags" JSONB,
    "difficulty" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timesSeen" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "score" JSONB NOT NULL,
    "feedback" TEXT NOT NULL,
    "phasesData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncounterResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drug" (
    "id" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "brandName" TEXT,
    "drugClass" TEXT[],
    "mechanismOfAction" TEXT,
    "indications" TEXT[],
    "contraindications" TEXT[],
    "sideEffects" JSONB,
    "interactions" JSONB,
    "dosing" TEXT,
    "tags" TEXT[],
    "isHighYield" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_system_idx" ON "Question"("system");

-- CreateIndex
CREATE INDEX "Question_difficulty_idx" ON "Question"("difficulty");

-- CreateIndex
CREATE INDEX "EncounterResult_userId_idx" ON "EncounterResult"("userId");

-- CreateIndex
CREATE INDEX "EncounterResult_caseId_idx" ON "EncounterResult"("caseId");

-- CreateIndex
CREATE INDEX "Drug_genericName_idx" ON "Drug"("genericName");

-- CreateIndex
CREATE INDEX "Drug_brandName_idx" ON "Drug"("brandName");

-- CreateIndex
CREATE INDEX "Drug_drugClass_idx" ON "Drug"("drugClass");

-- AddForeignKey
ALTER TABLE "UserQuestionHistory" ADD CONSTRAINT "UserQuestionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
