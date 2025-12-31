-- CreateTable: StudySession
CREATE TABLE IF NOT EXISTS "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTimeMs" INTEGER NOT NULL DEFAULT 0,
    "avgTimePerQuestion" INTEGER,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "finalStreak" INTEGER NOT NULL DEFAULT 0,
    "avgStreak" DOUBLE PRECISION,
    "errorClusters" INTEGER NOT NULL DEFAULT 0,
    "peakMomentum" DOUBLE PRECISION,
    "avgMomentum" DOUBLE PRECISION,
    "momentumTrend" TEXT,
    "totalAnswerChanges" INTEGER NOT NULL DEFAULT 0,
    "helpfulChanges" INTEGER NOT NULL DEFAULT 0,
    "harmfulChanges" INTEGER NOT NULL DEFAULT 0,
    "firstInstinctAccuracy" DOUBLE PRECISION,
    "avgInferredConfidence" DOUBLE PRECISION,
    "highConfidenceAccuracy" DOUBLE PRECISION,
    "lowConfidenceAccuracy" DOUBLE PRECISION,
    "calibrationScore" DOUBLE PRECISION,
    "questionsUnderPar" INTEGER NOT NULL DEFAULT 0,
    "questionsOverPar" INTEGER NOT NULL DEFAULT 0,
    "rushingAccuracy" DOUBLE PRECISION,
    "deliberateAccuracy" DOUBLE PRECISION,
    "early10Accuracy" DOUBLE PRECISION,
    "late10Accuracy" DOUBLE PRECISION,
    "staminaFade" DOUBLE PRECISION,
    "distributionScore" DOUBLE PRECISION,
    "systemsCovered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "predictedScore" INTEGER,
    "scoreConfidence" TEXT,
    "passLikelihood" DOUBLE PRECISION,
    "mode" TEXT,
    "focus" TEXT,
    "difficulty" TEXT,
    "deviceType" TEXT,
    "browserName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudySession_userId_idx" ON "StudySession"("userId");
CREATE INDEX IF NOT EXISTS "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "StudySession_startedAt_idx" ON "StudySession"("startedAt");

-- CreateTable: UserLearningProfile
CREATE TABLE IF NOT EXISTS "UserLearningProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lifetimeQuestions" INTEGER NOT NULL DEFAULT 0,
    "lifetimeCorrect" INTEGER NOT NULL DEFAULT 0,
    "lifetimeAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeStudyTimeMs" BIGINT NOT NULL DEFAULT 0,
    "bestEverStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestDailyStreak" INTEGER NOT NULL DEFAULT 0,
    "avgAnswerChanges" DOUBLE PRECISION,
    "changeHelpfulRatio" DOUBLE PRECISION,
    "firstInstinctTrustScore" DOUBLE PRECISION,
    "overallCalibrationScore" DOUBLE PRECISION,
    "overconfidenceIndex" DOUBLE PRECISION,
    "underconfidenceIndex" DOUBLE PRECISION,
    "avgTimePerQuestion" INTEGER,
    "optimalTimeRange" TEXT,
    "rushingTendency" DOUBLE PRECISION,
    "avgSessionLength" INTEGER,
    "fatigueOnsetQuestion" INTEGER,
    "optimalSessionLength" INTEGER,
    "strongestSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weakestSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mostImprovedSystem" TEXT,
    "estimatedScore" INTEGER,
    "scoreHistory" JSONB,
    "readinessLevel" TEXT,
    "targetExamDate" TIMESTAMP(3),
    "learningInsights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bestStudyHour" INTEGER,
    "worstStudyHour" INTEGER,
    "weekendVsWeekday" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserLearningProfile_userId_key" ON "UserLearningProfile"("userId");
CREATE INDEX IF NOT EXISTS "UserLearningProfile_userId_idx" ON "UserLearningProfile"("userId");
CREATE INDEX IF NOT EXISTS "UserLearningProfile_estimatedScore_idx" ON "UserLearningProfile"("estimatedScore");
