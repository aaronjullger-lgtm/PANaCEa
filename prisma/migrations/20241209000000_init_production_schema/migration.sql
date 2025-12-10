-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "role" TEXT NOT NULL DEFAULT 'user',
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "verifyToken" TEXT,
    "verifyTokenExpiry" TIMESTAMP(3),
    "hasCompletedBaseline" BOOLEAN NOT NULL DEFAULT false,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "examDate" TIMESTAMP(3),
    "graduationDate" TIMESTAMP(3),
    "school" TEXT,
    "currentRotation" TEXT,
    "yearInProgram" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "system" TEXT,
    "focus" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "questionWordCount" INTEGER,
    "errorTag" TEXT,
    "subcategoryName" TEXT,
    "conditionName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SRSItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "interval" INTEGER NOT NULL,
    "repetition" INTEGER NOT NULL,
    "easiness" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "lastReviewed" TIMESTAMP(3) NOT NULL,
    "quality" INTEGER NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "stabilityScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SRSItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "system" TEXT,
    "type" TEXT NOT NULL,
    "userNote" TEXT,
    "repetitionLevel" INTEGER NOT NULL DEFAULT 1,
    "nextReviewDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalUrl" TEXT,
    "thumbnailUrl" TEXT,
    "tags" TEXT[],
    "description" TEXT,
    "altText" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "dimensions" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiMetadata" JSONB,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "isClinical" BOOLEAN NOT NULL DEFAULT false,
    "folder" TEXT NOT NULL DEFAULT 'inbox',
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "textContent" TEXT,
    "pageCount" INTEGER,
    "duration" INTEGER,
    "sourceUrl" TEXT,
    "citation" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "accuracyPercent" DOUBLE PRECISION NOT NULL,
    "studyMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfusionPair" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "realCondition" TEXT NOT NULL,
    "mistakenFor" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastOccurrence" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfusionPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasteryProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conditionName" TEXT,
    "systemCode" TEXT,
    "subcategory" TEXT,
    "masteryTier" TEXT NOT NULL DEFAULT 'bronze',
    "accuracy" DOUBLE PRECISION NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasteryProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "systemBreakdown" JSONB NOT NULL,
    "weakestSystems" TEXT[],
    "strongestSystems" TEXT[],

    CONSTRAINT "BaselineAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplanationReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "questionId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplanationReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeaknessPattern" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "wasCorrect" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consecutiveWrong" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WeaknessPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalContent" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "MedicalContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "changeType" TEXT NOT NULL,
    "changeDescription" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAuditLog" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "changeDescription" TEXT,
    "changedFields" TEXT[],
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedBy" TEXT NOT NULL,
    "changedByRole" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ContentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentHealthReport" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalContent" INTEGER NOT NULL,
    "missingExplanations" INTEGER NOT NULL DEFAULT 0,
    "brokenMediaLinks" INTEGER NOT NULL DEFAULT 0,
    "invalidFields" INTEGER NOT NULL DEFAULT 0,
    "outdatedContent" INTEGER NOT NULL DEFAULT 0,
    "reportData" JSONB NOT NULL,

    CONSTRAINT "ContentHealthReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreGeneratedQuestion" (
    "id" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "system" TEXT,
    "conditionId" TEXT,
    "difficulty" TEXT NOT NULL,
    "questionData" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "usedBy" TEXT,
    "quality" INTEGER,

    CONSTRAINT "PreGeneratedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentLock" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "SyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationalResource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "fileUrl" TEXT,
    "originalFilename" TEXT,
    "extractedText" TEXT,
    "summary" TEXT,
    "keyTopics" TEXT[],
    "author" TEXT,
    "source" TEXT,
    "pageNumber" INTEGER,
    "duration" INTEGER,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "conditionIds" TEXT[],
    "systemCodes" TEXT[],
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "EducationalResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "userFirstName" TEXT,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "correctAnswer" TEXT,
    "topic" TEXT,
    "system" TEXT,
    "flagType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignedTo" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemanticCache" (
    "id" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "queryEmbedding" TEXT,
    "questionType" TEXT NOT NULL,
    "system" TEXT,
    "difficulty" TEXT,
    "cachedQuestion" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SemanticCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionHistory" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "questionData" JSONB NOT NULL,
    "changedBy" TEXT,
    "changeReason" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "QuestionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBranch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseBranch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "mergedBy" TEXT,
    "mergeCommitId" TEXT,
    "contentCount" INTEGER NOT NULL DEFAULT 0,
    "changeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContentBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchChange" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "contentData" JSONB NOT NULL,
    "previousData" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagingQuestion" (
    "id" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "system" TEXT,
    "conditionId" TEXT,
    "difficulty" TEXT NOT NULL,
    "questionData" JSONB NOT NULL,
    "adequacyStatus" TEXT NOT NULL DEFAULT 'pending',
    "adequacyScore" DOUBLE PRECISION,
    "adequacyDetails" JSONB,
    "hasCorrectAnswer" BOOLEAN NOT NULL DEFAULT false,
    "explanationLength" INTEGER NOT NULL DEFAULT 0,
    "hasMedicalErrors" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'staging',

    CONSTRAINT "StagingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "system" TEXT,
    "conditionId" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasCorrect" BOOLEAN,

    CONSTRAINT "UserQuestionHistory_pkey" PRIMARY KEY ("id")
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
    "explanation" TEXT NOT NULL,
    "distractors" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalPearl" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "conditionId" TEXT,
    "system" TEXT,
    "pearlText" TEXT NOT NULL,
    "fullExplanation" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "difficulty" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "usefulVotes" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedBy" TEXT NOT NULL DEFAULT 'ai',

    CONSTRAINT "ClinicalPearl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPearl" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pearlId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedUseful" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "UserPearl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineVersion" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "guidelineName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "keyChanges" TEXT[],
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectionMethod" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,

    CONSTRAINT "GuidelineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidelineConflict" (
    "id" TEXT NOT NULL,
    "guidelineVersionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "conditionId" TEXT,
    "system" TEXT,
    "conflictType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'flagged',
    "assignedTo" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "GuidelineConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCCPABlueprint" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "systemWeights" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "NCCPABlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDriftReport" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalQuestions" INTEGER NOT NULL,
    "systemBreakdown" JSONB NOT NULL,
    "driftSummary" JSONB NOT NULL,
    "hasSignificantDrift" BOOLEAN NOT NULL DEFAULT false,
    "alertsSent" BOOLEAN NOT NULL DEFAULT false,
    "alertDetails" JSONB,

    CONSTRAINT "ContentDriftReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVerification" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "conditionId" TEXT,
    "system" TEXT,
    "verificationType" TEXT NOT NULL,
    "verificationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiModel" TEXT NOT NULL,
    "isAccurate" BOOLEAN,
    "confidence" DOUBLE PRECISION,
    "aiResponse" JSONB,
    "issues" TEXT[],
    "recommendedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "quarantinedAt" TIMESTAMP(3),
    "quarantineReason" TEXT,

    CONSTRAINT "QuestionVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StalenessReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "questionId" TEXT NOT NULL,
    "conditionId" TEXT,
    "system" TEXT,
    "reportType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autoHidden" BOOLEAN NOT NULL DEFAULT false,
    "autoHiddenAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "isValid" BOOLEAN,
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "rewardGrantedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StalenessReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BountyReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedBy" TEXT,

    CONSTRAINT "BountyReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionMigration" (
    "id" TEXT NOT NULL,
    "originalQuestionId" TEXT NOT NULL,
    "newQuestionId" TEXT NOT NULL,
    "migrationType" TEXT NOT NULL,
    "guidelineChange" TEXT,
    "reasonForMigration" TEXT NOT NULL,
    "aiModel" TEXT,
    "migrationPrompt" TEXT,
    "changesApplied" JSONB NOT NULL,
    "oldContent" JSONB NOT NULL,
    "newContent" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "PerformanceRecord_userId_idx" ON "PerformanceRecord"("userId");

-- CreateIndex
CREATE INDEX "PerformanceRecord_userId_timestamp_idx" ON "PerformanceRecord"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "PerformanceRecord_topic_idx" ON "PerformanceRecord"("topic");

-- CreateIndex
CREATE INDEX "PerformanceRecord_system_idx" ON "PerformanceRecord"("system");

-- CreateIndex
CREATE INDEX "SRSItem_userId_idx" ON "SRSItem"("userId");

-- CreateIndex
CREATE INDEX "SRSItem_userId_dueDate_idx" ON "SRSItem"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "SRSItem_questionId_idx" ON "SRSItem"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SRSItem_userId_questionId_key" ON "SRSItem"("userId", "questionId");

-- CreateIndex
CREATE INDEX "SavedQuestion_userId_idx" ON "SavedQuestion"("userId");

-- CreateIndex
CREATE INDEX "SavedQuestion_userId_type_idx" ON "SavedQuestion"("userId", "type");

-- CreateIndex
CREATE INDEX "SavedQuestion_questionId_idx" ON "SavedQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedQuestion_userId_questionId_type_key" ON "SavedQuestion"("userId", "questionId", "type");

-- CreateIndex
CREATE INDEX "Condition_system_idx" ON "Condition"("system");

-- CreateIndex
CREATE INDEX "Condition_name_idx" ON "Condition"("name");

-- CreateIndex
CREATE INDEX "MediaAsset_conditionId_idx" ON "MediaAsset"("conditionId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- CreateIndex
CREATE INDEX "MediaAsset_filename_idx" ON "MediaAsset"("filename");

-- CreateIndex
CREATE INDEX "MediaAsset_tags_idx" ON "MediaAsset"("tags");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedBy_idx" ON "MediaAsset"("uploadedBy");

-- CreateIndex
CREATE INDEX "MediaAsset_approvalStatus_idx" ON "MediaAsset"("approvalStatus");

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

-- CreateIndex
CREATE INDEX "MediaAsset_folder_idx" ON "MediaAsset"("folder");

-- CreateIndex
CREATE INDEX "MediaAsset_mediaType_idx" ON "MediaAsset"("mediaType");

-- CreateIndex
CREATE INDEX "MediaAsset_approvedAt_idx" ON "MediaAsset"("approvedAt");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "DailyStreak_userId_idx" ON "DailyStreak"("userId");

-- CreateIndex
CREATE INDEX "DailyStreak_date_idx" ON "DailyStreak"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStreak_userId_date_key" ON "DailyStreak"("userId", "date");

-- CreateIndex
CREATE INDEX "ConfusionPair_userId_idx" ON "ConfusionPair"("userId");

-- CreateIndex
CREATE INDEX "ConfusionPair_userId_realCondition_idx" ON "ConfusionPair"("userId", "realCondition");

-- CreateIndex
CREATE INDEX "ConfusionPair_realCondition_idx" ON "ConfusionPair"("realCondition");

-- CreateIndex
CREATE UNIQUE INDEX "ConfusionPair_userId_realCondition_mistakenFor_key" ON "ConfusionPair"("userId", "realCondition", "mistakenFor");

-- CreateIndex
CREATE INDEX "MasteryProgress_userId_idx" ON "MasteryProgress"("userId");

-- CreateIndex
CREATE INDEX "MasteryProgress_systemCode_idx" ON "MasteryProgress"("systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "MasteryProgress_userId_conditionName_systemCode_subcategory_key" ON "MasteryProgress"("userId", "conditionName", "systemCode", "subcategory");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineAssessment_userId_key" ON "BaselineAssessment"("userId");

-- CreateIndex
CREATE INDEX "BaselineAssessment_userId_idx" ON "BaselineAssessment"("userId");

-- CreateIndex
CREATE INDEX "ExplanationReaction_questionId_idx" ON "ExplanationReaction"("questionId");

-- CreateIndex
CREATE INDEX "ExplanationReaction_userId_questionId_idx" ON "ExplanationReaction"("userId", "questionId");

-- CreateIndex
CREATE INDEX "WeaknessPattern_userId_idx" ON "WeaknessPattern"("userId");

-- CreateIndex
CREATE INDEX "WeaknessPattern_userId_conditionId_idx" ON "WeaknessPattern"("userId", "conditionId");

-- CreateIndex
CREATE INDEX "WeaknessPattern_conditionId_idx" ON "WeaknessPattern"("conditionId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalContent_conditionId_key" ON "MedicalContent"("conditionId");

-- CreateIndex
CREATE INDEX "MedicalContent_conditionId_idx" ON "MedicalContent"("conditionId");

-- CreateIndex
CREATE INDEX "MedicalContent_system_idx" ON "MedicalContent"("system");

-- CreateIndex
CREATE INDEX "MedicalContent_status_idx" ON "MedicalContent"("status");

-- CreateIndex
CREATE INDEX "MedicalContent_createdBy_idx" ON "MedicalContent"("createdBy");

-- CreateIndex
CREATE INDEX "MedicalContent_updatedAt_idx" ON "MedicalContent"("updatedAt");

-- CreateIndex
CREATE INDEX "ContentVersion_contentId_idx" ON "ContentVersion"("contentId");

-- CreateIndex
CREATE INDEX "ContentVersion_changedBy_idx" ON "ContentVersion"("changedBy");

-- CreateIndex
CREATE INDEX "ContentVersion_changedAt_idx" ON "ContentVersion"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_contentId_version_key" ON "ContentVersion"("contentId", "version");

-- CreateIndex
CREATE INDEX "ContentAuditLog_contentId_idx" ON "ContentAuditLog"("contentId");

-- CreateIndex
CREATE INDEX "ContentAuditLog_conditionId_idx" ON "ContentAuditLog"("conditionId");

-- CreateIndex
CREATE INDEX "ContentAuditLog_changedBy_idx" ON "ContentAuditLog"("changedBy");

-- CreateIndex
CREATE INDEX "ContentAuditLog_changedAt_idx" ON "ContentAuditLog"("changedAt");

-- CreateIndex
CREATE INDEX "ContentAuditLog_changeType_idx" ON "ContentAuditLog"("changeType");

-- CreateIndex
CREATE INDEX "ContentHealthReport_timestamp_idx" ON "ContentHealthReport"("timestamp");

-- CreateIndex
CREATE INDEX "PreGeneratedQuestion_questionType_idx" ON "PreGeneratedQuestion"("questionType");

-- CreateIndex
CREATE INDEX "PreGeneratedQuestion_system_idx" ON "PreGeneratedQuestion"("system");

-- CreateIndex
CREATE INDEX "PreGeneratedQuestion_difficulty_idx" ON "PreGeneratedQuestion"("difficulty");

-- CreateIndex
CREATE INDEX "PreGeneratedQuestion_usedAt_idx" ON "PreGeneratedQuestion"("usedAt");

-- CreateIndex
CREATE INDEX "PreGeneratedQuestion_generatedAt_idx" ON "PreGeneratedQuestion"("generatedAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_jobType_idx" ON "BackgroundJob"("jobType");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");

-- CreateIndex
CREATE INDEX "BackgroundJob_scheduledFor_idx" ON "BackgroundJob"("scheduledFor");

-- CreateIndex
CREATE INDEX "BackgroundJob_priority_status_idx" ON "BackgroundJob"("priority", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentLock_contentId_key" ON "ContentLock"("contentId");

-- CreateIndex
CREATE INDEX "ContentLock_contentId_idx" ON "ContentLock"("contentId");

-- CreateIndex
CREATE INDEX "ContentLock_lockedBy_idx" ON "ContentLock"("lockedBy");

-- CreateIndex
CREATE INDEX "ContentLock_expiresAt_idx" ON "ContentLock"("expiresAt");

-- CreateIndex
CREATE INDEX "SyncQueue_userId_idx" ON "SyncQueue"("userId");

-- CreateIndex
CREATE INDEX "SyncQueue_status_idx" ON "SyncQueue"("status");

-- CreateIndex
CREATE INDEX "SyncQueue_createdAt_idx" ON "SyncQueue"("createdAt");

-- CreateIndex
CREATE INDEX "EducationalResource_resourceType_idx" ON "EducationalResource"("resourceType");

-- CreateIndex
CREATE INDEX "EducationalResource_approvalStatus_idx" ON "EducationalResource"("approvalStatus");

-- CreateIndex
CREATE INDEX "EducationalResource_keyTopics_idx" ON "EducationalResource"("keyTopics");

-- CreateIndex
CREATE INDEX "EducationalResource_systemCodes_idx" ON "EducationalResource"("systemCodes");

-- CreateIndex
CREATE INDEX "EducationalResource_uploadedBy_idx" ON "EducationalResource"("uploadedBy");

-- CreateIndex
CREATE INDEX "EducationalResource_approvedAt_idx" ON "EducationalResource"("approvedAt");

-- CreateIndex
CREATE INDEX "QuestionFlag_userId_idx" ON "QuestionFlag"("userId");

-- CreateIndex
CREATE INDEX "QuestionFlag_questionId_idx" ON "QuestionFlag"("questionId");

-- CreateIndex
CREATE INDEX "QuestionFlag_status_idx" ON "QuestionFlag"("status");

-- CreateIndex
CREATE INDEX "QuestionFlag_priority_idx" ON "QuestionFlag"("priority");

-- CreateIndex
CREATE INDEX "QuestionFlag_createdAt_idx" ON "QuestionFlag"("createdAt");

-- CreateIndex
CREATE INDEX "QuestionFlag_status_priority_idx" ON "QuestionFlag"("status", "priority");

-- CreateIndex
CREATE INDEX "SemanticCache_queryText_idx" ON "SemanticCache" USING GIN ("queryText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "SemanticCache_questionType_idx" ON "SemanticCache"("questionType");

-- CreateIndex
CREATE INDEX "SemanticCache_system_idx" ON "SemanticCache"("system");

-- CreateIndex
CREATE INDEX "SemanticCache_lastUsedAt_idx" ON "SemanticCache"("lastUsedAt");

-- CreateIndex
CREATE INDEX "QuestionHistory_questionId_idx" ON "QuestionHistory"("questionId");

-- CreateIndex
CREATE INDEX "QuestionHistory_validFrom_idx" ON "QuestionHistory"("validFrom");

-- CreateIndex
CREATE INDEX "QuestionHistory_questionId_validFrom_idx" ON "QuestionHistory"("questionId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionHistory_questionId_version_key" ON "QuestionHistory"("questionId", "version");

-- CreateIndex
CREATE INDEX "ContentBranch_status_idx" ON "ContentBranch"("status");

-- CreateIndex
CREATE INDEX "ContentBranch_createdBy_idx" ON "ContentBranch"("createdBy");

-- CreateIndex
CREATE INDEX "ContentBranch_createdAt_idx" ON "ContentBranch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBranch_name_key" ON "ContentBranch"("name");

-- CreateIndex
CREATE INDEX "BranchChange_branchId_idx" ON "BranchChange"("branchId");

-- CreateIndex
CREATE INDEX "BranchChange_contentId_idx" ON "BranchChange"("contentId");

-- CreateIndex
CREATE INDEX "BranchChange_conditionId_idx" ON "BranchChange"("conditionId");

-- CreateIndex
CREATE INDEX "BranchChange_createdAt_idx" ON "BranchChange"("createdAt");

-- CreateIndex
CREATE INDEX "StagingQuestion_adequacyStatus_idx" ON "StagingQuestion"("adequacyStatus");

-- CreateIndex
CREATE INDEX "StagingQuestion_status_idx" ON "StagingQuestion"("status");

-- CreateIndex
CREATE INDEX "StagingQuestion_questionType_idx" ON "StagingQuestion"("questionType");

-- CreateIndex
CREATE INDEX "StagingQuestion_system_idx" ON "StagingQuestion"("system");

-- CreateIndex
CREATE INDEX "StagingQuestion_generatedAt_idx" ON "StagingQuestion"("generatedAt");

-- CreateIndex
CREATE INDEX "UserQuestionHistory_userId_idx" ON "UserQuestionHistory"("userId");

-- CreateIndex
CREATE INDEX "UserQuestionHistory_userId_system_idx" ON "UserQuestionHistory"("userId", "system");

-- CreateIndex
CREATE INDEX "UserQuestionHistory_userId_conditionId_idx" ON "UserQuestionHistory"("userId", "conditionId");

-- CreateIndex
CREATE INDEX "UserQuestionHistory_questionId_idx" ON "UserQuestionHistory"("questionId");

-- CreateIndex
CREATE INDEX "UserQuestionHistory_seenAt_idx" ON "UserQuestionHistory"("seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestionHistory_userId_questionId_key" ON "UserQuestionHistory"("userId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionSeed_conditionId_idx" ON "QuestionSeed"("conditionId");

-- CreateIndex
CREATE INDEX "QuestionSeed_questionType_idx" ON "QuestionSeed"("questionType");

-- CreateIndex
CREATE INDEX "QuestionSeed_system_idx" ON "QuestionSeed"("system");

-- CreateIndex
CREATE INDEX "QuestionSeed_usageCount_idx" ON "QuestionSeed"("usageCount");

-- CreateIndex
CREATE INDEX "ClinicalPearl_questionId_idx" ON "ClinicalPearl"("questionId");

-- CreateIndex
CREATE INDEX "ClinicalPearl_conditionId_idx" ON "ClinicalPearl"("conditionId");

-- CreateIndex
CREATE INDEX "ClinicalPearl_system_idx" ON "ClinicalPearl"("system");

-- CreateIndex
CREATE INDEX "ClinicalPearl_category_idx" ON "ClinicalPearl"("category");

-- CreateIndex
CREATE INDEX "ClinicalPearl_tags_idx" ON "ClinicalPearl"("tags");

-- CreateIndex
CREATE INDEX "ClinicalPearl_extractedAt_idx" ON "ClinicalPearl"("extractedAt");

-- CreateIndex
CREATE INDEX "UserPearl_userId_idx" ON "UserPearl"("userId");

-- CreateIndex
CREATE INDEX "UserPearl_pearlId_idx" ON "UserPearl"("pearlId");

-- CreateIndex
CREATE INDEX "UserPearl_viewedAt_idx" ON "UserPearl"("viewedAt");

-- CreateIndex
CREATE INDEX "UserPearl_userId_markedUseful_idx" ON "UserPearl"("userId", "markedUseful");

-- CreateIndex
CREATE UNIQUE INDEX "UserPearl_userId_pearlId_key" ON "UserPearl"("userId", "pearlId");

-- CreateIndex
CREATE INDEX "GuidelineVersion_source_idx" ON "GuidelineVersion"("source");

-- CreateIndex
CREATE INDEX "GuidelineVersion_guidelineName_idx" ON "GuidelineVersion"("guidelineName");

-- CreateIndex
CREATE INDEX "GuidelineVersion_effectiveDate_idx" ON "GuidelineVersion"("effectiveDate");

-- CreateIndex
CREATE INDEX "GuidelineVersion_reviewStatus_idx" ON "GuidelineVersion"("reviewStatus");

-- CreateIndex
CREATE INDEX "GuidelineVersion_detectedAt_idx" ON "GuidelineVersion"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuidelineVersion_source_guidelineName_version_key" ON "GuidelineVersion"("source", "guidelineName", "version");

-- CreateIndex
CREATE INDEX "GuidelineConflict_guidelineVersionId_idx" ON "GuidelineConflict"("guidelineVersionId");

-- CreateIndex
CREATE INDEX "GuidelineConflict_questionId_idx" ON "GuidelineConflict"("questionId");

-- CreateIndex
CREATE INDEX "GuidelineConflict_status_idx" ON "GuidelineConflict"("status");

-- CreateIndex
CREATE INDEX "GuidelineConflict_severity_idx" ON "GuidelineConflict"("severity");

-- CreateIndex
CREATE INDEX "GuidelineConflict_detectedAt_idx" ON "GuidelineConflict"("detectedAt");

-- CreateIndex
CREATE INDEX "GuidelineConflict_status_severity_idx" ON "GuidelineConflict"("status", "severity");

-- CreateIndex
CREATE INDEX "NCCPABlueprint_version_idx" ON "NCCPABlueprint"("version");

-- CreateIndex
CREATE INDEX "NCCPABlueprint_isActive_idx" ON "NCCPABlueprint"("isActive");

-- CreateIndex
CREATE INDEX "NCCPABlueprint_effectiveDate_idx" ON "NCCPABlueprint"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "NCCPABlueprint_version_key" ON "NCCPABlueprint"("version");

-- CreateIndex
CREATE INDEX "ContentDriftReport_blueprintId_idx" ON "ContentDriftReport"("blueprintId");

-- CreateIndex
CREATE INDEX "ContentDriftReport_reportDate_idx" ON "ContentDriftReport"("reportDate");

-- CreateIndex
CREATE INDEX "ContentDriftReport_hasSignificantDrift_idx" ON "ContentDriftReport"("hasSignificantDrift");

-- CreateIndex
CREATE INDEX "QuestionVerification_questionId_idx" ON "QuestionVerification"("questionId");

-- CreateIndex
CREATE INDEX "QuestionVerification_verificationType_idx" ON "QuestionVerification"("verificationType");

-- CreateIndex
CREATE INDEX "QuestionVerification_verificationDate_idx" ON "QuestionVerification"("verificationDate");

-- CreateIndex
CREATE INDEX "QuestionVerification_status_idx" ON "QuestionVerification"("status");

-- CreateIndex
CREATE INDEX "QuestionVerification_isAccurate_idx" ON "QuestionVerification"("isAccurate");

-- CreateIndex
CREATE INDEX "QuestionVerification_questionId_verificationDate_idx" ON "QuestionVerification"("questionId", "verificationDate");

-- CreateIndex
CREATE INDEX "StalenessReport_userId_idx" ON "StalenessReport"("userId");

-- CreateIndex
CREATE INDEX "StalenessReport_questionId_idx" ON "StalenessReport"("questionId");

-- CreateIndex
CREATE INDEX "StalenessReport_status_idx" ON "StalenessReport"("status");

-- CreateIndex
CREATE INDEX "StalenessReport_reportType_idx" ON "StalenessReport"("reportType");

-- CreateIndex
CREATE INDEX "StalenessReport_confirmations_idx" ON "StalenessReport"("confirmations");

-- CreateIndex
CREATE INDEX "StalenessReport_reportedAt_idx" ON "StalenessReport"("reportedAt");

-- CreateIndex
CREATE INDEX "StalenessReport_questionId_reportedAt_idx" ON "StalenessReport"("questionId", "reportedAt");

-- CreateIndex
CREATE INDEX "BountyReward_userId_idx" ON "BountyReward"("userId");

-- CreateIndex
CREATE INDEX "BountyReward_reportId_idx" ON "BountyReward"("reportId");

-- CreateIndex
CREATE INDEX "BountyReward_awardedAt_idx" ON "BountyReward"("awardedAt");

-- CreateIndex
CREATE INDEX "BountyReward_userId_awardedAt_idx" ON "BountyReward"("userId", "awardedAt");

-- CreateIndex
CREATE INDEX "QuestionMigration_originalQuestionId_idx" ON "QuestionMigration"("originalQuestionId");

-- CreateIndex
CREATE INDEX "QuestionMigration_newQuestionId_idx" ON "QuestionMigration"("newQuestionId");

-- CreateIndex
CREATE INDEX "QuestionMigration_migrationType_idx" ON "QuestionMigration"("migrationType");

-- CreateIndex
CREATE INDEX "QuestionMigration_status_idx" ON "QuestionMigration"("status");

-- CreateIndex
CREATE INDEX "QuestionMigration_migratedAt_idx" ON "QuestionMigration"("migratedAt");

-- AddForeignKey
ALTER TABLE "PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SRSItem" ADD CONSTRAINT "SRSItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuestion" ADD CONSTRAINT "SavedQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStreak" ADD CONSTRAINT "DailyStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "MedicalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAuditLog" ADD CONSTRAINT "ContentAuditLog_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "MedicalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchChange" ADD CONSTRAINT "BranchChange_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ContentBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidelineConflict" ADD CONSTRAINT "GuidelineConflict_guidelineVersionId_fkey" FOREIGN KEY ("guidelineVersionId") REFERENCES "GuidelineVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

