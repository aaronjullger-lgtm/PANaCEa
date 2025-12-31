-- Sprint 4: Enhanced Session Analytics
-- Migration: Add StudySession and UserLearningProfile tables

-- Create StudySession table for session-level analytics
CREATE TABLE IF NOT EXISTS "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    
    -- Core metrics
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTimeMs" INTEGER NOT NULL DEFAULT 0,
    "avgTimePerQuestion" INTEGER,
    
    -- Streak data
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "finalStreak" INTEGER NOT NULL DEFAULT 0,
    "avgStreak" DOUBLE PRECISION,
    "errorClusters" INTEGER NOT NULL DEFAULT 0,
    
    -- Momentum metrics
    "peakMomentum" DOUBLE PRECISION,
    "avgMomentum" DOUBLE PRECISION,
    "momentumTrend" TEXT,
    
    -- Behavioral signals
    "totalAnswerChanges" INTEGER NOT NULL DEFAULT 0,
    "helpfulChanges" INTEGER NOT NULL DEFAULT 0,
    "harmfulChanges" INTEGER NOT NULL DEFAULT 0,
    "firstInstinctAccuracy" DOUBLE PRECISION,
    
    -- Confidence calibration
    "avgInferredConfidence" DOUBLE PRECISION,
    "highConfidenceAccuracy" DOUBLE PRECISION,
    "lowConfidenceAccuracy" DOUBLE PRECISION,
    "calibrationScore" DOUBLE PRECISION,
    
    -- Time pressure analysis
    "questionsUnderPar" INTEGER NOT NULL DEFAULT 0,
    "questionsOverPar" INTEGER NOT NULL DEFAULT 0,
    "rushingAccuracy" DOUBLE PRECISION,
    "deliberateAccuracy" DOUBLE PRECISION,
    
    -- Fatigue indicators
    "early10Accuracy" DOUBLE PRECISION,
    "late10Accuracy" DOUBLE PRECISION,
    "staminaFade" DOUBLE PRECISION,
    
    -- PANCE distribution
    "distributionScore" DOUBLE PRECISION,
    "systemsCovered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Predicted score
    "predictedScore" INTEGER,
    "scoreConfidence" TEXT,
    "passLikelihood" DOUBLE PRECISION,
    
    -- Session settings
    "mode" TEXT,
    "focus" TEXT,
    "difficulty" TEXT,
    
    -- Device info
    "deviceType" TEXT,
    "browserName" TEXT,
    
    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- Create UserLearningProfile table for cumulative user analytics
CREATE TABLE IF NOT EXISTS "UserLearningProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    
    -- Cumulative performance
    "lifetimeQuestions" INTEGER NOT NULL DEFAULT 0,
    "lifetimeCorrect" INTEGER NOT NULL DEFAULT 0,
    "lifetimeAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeStudyTimeMs" BIGINT NOT NULL DEFAULT 0,
    
    -- Streak records
    "bestEverStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestDailyStreak" INTEGER NOT NULL DEFAULT 0,
    
    -- Test-taking patterns
    "avgAnswerChanges" DOUBLE PRECISION,
    "changeHelpfulRatio" DOUBLE PRECISION,
    "firstInstinctTrustScore" DOUBLE PRECISION,
    
    -- Confidence calibration (lifetime)
    "overallCalibrationScore" DOUBLE PRECISION,
    "overconfidenceIndex" DOUBLE PRECISION,
    "underconfidenceIndex" DOUBLE PRECISION,
    
    -- Time patterns
    "avgTimePerQuestion" INTEGER,
    "optimalTimeRange" TEXT,
    "rushingTendency" DOUBLE PRECISION,
    
    -- Stamina profile
    "avgSessionLength" INTEGER,
    "fatigueOnsetQuestion" INTEGER,
    "optimalSessionLength" INTEGER,
    
    -- System strengths/weaknesses
    "strongestSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weakestSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mostImprovedSystem" TEXT,
    
    -- PANCE readiness
    "estimatedScore" INTEGER,
    "scoreHistory" JSONB,
    "readinessLevel" TEXT,
    "targetExamDate" TIMESTAMP(3),
    
    -- Learning style insights
    "learningInsights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Circadian patterns
    "bestStudyHour" INTEGER,
    "worstStudyHour" INTEGER,
    "weekendVsWeekday" DOUBLE PRECISION,
    
    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLearningProfile_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on userId for UserLearningProfile
CREATE UNIQUE INDEX IF NOT EXISTS "UserLearningProfile_userId_key" ON "UserLearningProfile"("userId");

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "StudySession_userId_idx" ON "StudySession"("userId");
CREATE INDEX IF NOT EXISTS "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "StudySession_startedAt_idx" ON "StudySession"("startedAt");
CREATE INDEX IF NOT EXISTS "UserLearningProfile_userId_idx" ON "UserLearningProfile"("userId");
CREATE INDEX IF NOT EXISTS "UserLearningProfile_estimatedScore_idx" ON "UserLearningProfile"("estimatedScore");
