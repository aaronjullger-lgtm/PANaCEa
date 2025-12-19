/*
  Warnings:

  - You are about to drop the column `sourceQuestionId` on the `ClinicalPearl` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `ClinicalPearl` table. All the data in the column will be lost.
  - The `tags` column on the `ClinicalPearl` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sideEffects` column on the `Drug` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `interactions` column on the `Drug` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `content` on the `MedicalContent` table. All the data in the column will be lost.
  - You are about to drop the `Leaderboard` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LeaderboardEntry` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[genericName]` on the table `Drug` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pearlText` to the `ClinicalPearl` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ClinicalPearl` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WordleStatus" AS ENUM ('playing', 'won', 'lost');

-- DropForeignKey
ALTER TABLE "Leaderboard" DROP CONSTRAINT "Leaderboard_groupId_fkey";

-- DropForeignKey
ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_leaderboardId_fkey";

-- DropForeignKey
ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_userId_fkey";

-- DropIndex
DROP INDEX "Drug_brandName_idx";

-- DropIndex
DROP INDEX "Drug_drugClass_idx";

-- DropIndex
DROP INDEX "MedicalContent_relatedSystems_idx";

-- AlterTable
ALTER TABLE "ClinicalPearl" DROP COLUMN "sourceQuestionId",
DROP COLUMN "text",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fullExplanation" TEXT,
ADD COLUMN     "pearlText" TEXT NOT NULL,
ADD COLUMN     "questionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usefulVotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "tags",
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "Condition" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "content" JSONB,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "Drug" ADD COLUMN     "aliases" TEXT[],
ADD COLUMN     "antidote" TEXT,
ADD COLUMN     "clinicalNotes" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "elimination" TEXT,
ADD COLUMN     "metabolism" TEXT,
DROP COLUMN "sideEffects",
ADD COLUMN     "sideEffects" TEXT[],
DROP COLUMN "interactions",
ADD COLUMN     "interactions" TEXT[];

-- AlterTable
ALTER TABLE "MedicalContent" DROP COLUMN "content",
ADD COLUMN     "buzzwords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "complications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "diagnostics" JSONB,
ADD COLUMN     "differentialDiagnosis" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "epidemiology" TEXT,
ADD COLUMN     "etiology" TEXT,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "pathophysiology" TEXT,
ADD COLUMN     "physicalExam" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prognosis" TEXT,
ADD COLUMN     "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "treatment" JSONB;

-- AlterTable
ALTER TABLE "SyncQueue" ADD COLUMN     "conflictDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "Leaderboard";

-- DropTable
DROP TABLE "LeaderboardEntry";

-- CreateTable
CREATE TABLE "UserSRSConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "wWeights" JSONB NOT NULL,
    "lastTuned" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSRSConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "commonAbnormalities" TEXT[],
    "typicalUse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCase" (
    "id" TEXT NOT NULL,
    "correctDiagnosis" TEXT NOT NULL,
    "clinicalVignette" TEXT NOT NULL,
    "labs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnatomyStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "region" TEXT,
    "type" TEXT,
    "description" TEXT,
    "function" TEXT,
    "innervation" TEXT,
    "bloodSupply" TEXT,
    "clinicalSignificance" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnatomyStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "system" TEXT,
    "region" TEXT,
    "description" TEXT,
    "sensitivity" DOUBLE PRECISION,
    "specificity" DOUBLE PRECISION,
    "technique" TEXT,
    "positiveTest" TEXT,
    "interpretation" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrandRoundsChallenge" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "questionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrandRoundsChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrandRoundsAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "timeSpentMs" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrandRoundsAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buzzword" (
    "id" TEXT NOT NULL,
    "buzzword" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "subcategory" TEXT,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Buzzword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWordle" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWordle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWordleState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "guesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WordleStatus" NOT NULL DEFAULT 'playing',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWordleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionType" TEXT,
    "system" TEXT,
    "conditionId" TEXT,
    "mode" TEXT,
    "wasCorrect" BOOLEAN NOT NULL DEFAULT false,
    "isRankedAttempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientEncounterSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "messages" JSONB NOT NULL,
    "physicalFindings" JSONB,
    "diagnosticOrders" JSONB,
    "diagnosis" TEXT,
    "treatmentPlan" TEXT,

    CONSTRAINT "PatientEncounterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientEncounterCase" (
    "id" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "vitalSigns" JSONB NOT NULL,
    "historyData" JSONB NOT NULL,
    "physicalExamData" JSONB NOT NULL,
    "labData" JSONB NOT NULL,
    "essentialQuestions" TEXT[],
    "helpfulQuestions" TEXT[],
    "unnecessaryQuestions" TEXT[],
    "correctDiagnosis" TEXT NOT NULL,
    "differentialDiagnoses" TEXT[],
    "idealWorkup" TEXT[],
    "teachingPoints" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientEncounterCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalGuideline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clinicalContext" TEXT,
    "maxScore" INTEGER NOT NULL,
    "components" JSONB NOT NULL,
    "scoringMap" JSONB,
    "vignettes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingStudy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "bodyRegion" TEXT,
    "usesContrast" BOOLEAN NOT NULL DEFAULT false,
    "usesRadiation" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "indications" TEXT[],
    "contraindications" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagingStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalExamFinding" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "description" TEXT,
    "clinicalSignificance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalExamFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeGuideline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "year" INTEGER,
    "summary" TEXT,
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysiologyConcept" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "aliases" TEXT[],
    "system" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "mechanism" TEXT,
    "clinicalSignificance" TEXT,
    "relatedConditions" TEXT[],
    "relatedDrugs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysiologyConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "aliases" TEXT[],
    "category" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "mechanism" TEXT,
    "dosing" TEXT,
    "sideEffects" TEXT[],
    "indications" TEXT[],
    "contraindications" TEXT[],
    "complications" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DifferentialDiagnosis" (
    "id" TEXT NOT NULL,
    "presentingComplaint" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "differentialList" TEXT[],
    "mustNotMiss" TEXT[],
    "workup" TEXT,
    "pearls" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DifferentialDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirstLineTreatment" (
    "id" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirstLineTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSeed" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "system" TEXT,
    "corePathology" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "template" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "distractors" TEXT[],
    "explanation" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "tags" TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPearl" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pearlId" TEXT NOT NULL,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "markedUseful" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "UserPearl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConditionToSpecialTest" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_AnatomyStructureToCondition" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSRSConfig_userId_key" ON "UserSRSConfig"("userId");

-- CreateIndex
CREATE INDEX "UserSRSConfig_userId_idx" ON "UserSRSConfig"("userId");

-- CreateIndex
CREATE INDEX "UserSRSConfig_lastTuned_idx" ON "UserSRSConfig"("lastTuned");

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_name_key" ON "LabTest"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AnatomyStructure_name_key" ON "AnatomyStructure"("name");

-- CreateIndex
CREATE INDEX "AnatomyStructure_system_idx" ON "AnatomyStructure"("system");

-- CreateIndex
CREATE INDEX "AnatomyStructure_name_idx" ON "AnatomyStructure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialTest_name_key" ON "SpecialTest"("name");

-- CreateIndex
CREATE INDEX "SpecialTest_name_idx" ON "SpecialTest"("name");

-- CreateIndex
CREATE INDEX "SpecialTest_displayName_idx" ON "SpecialTest"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "GrandRoundsChallenge_date_key" ON "GrandRoundsChallenge"("date");

-- CreateIndex
CREATE INDEX "GrandRoundsAttempt_challengeId_idx" ON "GrandRoundsAttempt"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "GrandRoundsAttempt_userId_challengeId_key" ON "GrandRoundsAttempt"("userId", "challengeId");

-- CreateIndex
CREATE INDEX "Buzzword_system_idx" ON "Buzzword"("system");

-- CreateIndex
CREATE INDEX "Buzzword_condition_idx" ON "Buzzword"("condition");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWordle_date_key" ON "DailyWordle"("date");

-- CreateIndex
CREATE INDEX "DailyWordle_wordId_idx" ON "DailyWordle"("wordId");

-- CreateIndex
CREATE INDEX "UserWordleState_userId_idx" ON "UserWordleState"("userId");

-- CreateIndex
CREATE INDEX "UserWordleState_date_idx" ON "UserWordleState"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserWordleState_userId_date_key" ON "UserWordleState"("userId", "date");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_createdAt_idx" ON "QuestionAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionAttempt_questionId_idx" ON "QuestionAttempt"("questionId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_mode_idx" ON "QuestionAttempt"("mode");

-- CreateIndex
CREATE INDEX "QuestionAttempt_isRankedAttempt_idx" ON "QuestionAttempt"("isRankedAttempt");

-- CreateIndex
CREATE INDEX "PatientEncounterSession_userId_idx" ON "PatientEncounterSession"("userId");

-- CreateIndex
CREATE INDEX "PatientEncounterSession_status_idx" ON "PatientEncounterSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ImagingStudy_name_key" ON "ImagingStudy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalExamFinding_name_key" ON "PhysicalExamFinding"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeGuideline_name_key" ON "PracticeGuideline"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PhysiologyConcept_name_key" ON "PhysiologyConcept"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Treatment_name_key" ON "Treatment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DifferentialDiagnosis_presentingComplaint_key" ON "DifferentialDiagnosis"("presentingComplaint");

-- CreateIndex
CREATE INDEX "QuestionSeed_conditionId_idx" ON "QuestionSeed"("conditionId");

-- CreateIndex
CREATE INDEX "QuestionSeed_system_idx" ON "QuestionSeed"("system");

-- CreateIndex
CREATE UNIQUE INDEX "UserPearl_userId_pearlId_key" ON "UserPearl"("userId", "pearlId");

-- CreateIndex
CREATE UNIQUE INDEX "_ConditionToSpecialTest_AB_unique" ON "_ConditionToSpecialTest"("A", "B");

-- CreateIndex
CREATE INDEX "_ConditionToSpecialTest_B_index" ON "_ConditionToSpecialTest"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AnatomyStructureToCondition_AB_unique" ON "_AnatomyStructureToCondition"("A", "B");

-- CreateIndex
CREATE INDEX "_AnatomyStructureToCondition_B_index" ON "_AnatomyStructureToCondition"("B");

-- CreateIndex
CREATE INDEX "ClinicalPearl_category_idx" ON "ClinicalPearl"("category");

-- CreateIndex
CREATE INDEX "ClinicalPearl_questionId_idx" ON "ClinicalPearl"("questionId");

-- CreateIndex
CREATE INDEX "Condition_parentId_idx" ON "Condition"("parentId");

-- CreateIndex
CREATE INDEX "Condition_displayName_idx" ON "Condition"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Drug_genericName_key" ON "Drug"("genericName");

-- CreateIndex
CREATE INDEX "MedicalContent_relatedSystems_idx" ON "MedicalContent"("relatedSystems");

-- CreateIndex
CREATE INDEX "SyncQueue_attempts_idx" ON "SyncQueue"("attempts");

-- AddForeignKey
ALTER TABLE "UserSRSConfig" ADD CONSTRAINT "UserSRSConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrandRoundsAttempt" ADD CONSTRAINT "GrandRoundsAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrandRoundsAttempt" ADD CONSTRAINT "GrandRoundsAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "GrandRoundsChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWordle" ADD CONSTRAINT "DailyWordle_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Buzzword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWordleState" ADD CONSTRAINT "UserWordleState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEncounterSession" ADD CONSTRAINT "PatientEncounterSession_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PatientEncounterCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEncounterSession" ADD CONSTRAINT "PatientEncounterSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPearl" ADD CONSTRAINT "UserPearl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPearl" ADD CONSTRAINT "UserPearl_pearlId_fkey" FOREIGN KEY ("pearlId") REFERENCES "ClinicalPearl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConditionToSpecialTest" ADD CONSTRAINT "_ConditionToSpecialTest_A_fkey" FOREIGN KEY ("A") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConditionToSpecialTest" ADD CONSTRAINT "_ConditionToSpecialTest_B_fkey" FOREIGN KEY ("B") REFERENCES "SpecialTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnatomyStructureToCondition" ADD CONSTRAINT "_AnatomyStructureToCondition_A_fkey" FOREIGN KEY ("A") REFERENCES "AnatomyStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnatomyStructureToCondition" ADD CONSTRAINT "_AnatomyStructureToCondition_B_fkey" FOREIGN KEY ("B") REFERENCES "Condition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
