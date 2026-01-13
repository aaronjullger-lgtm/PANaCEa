-- Migration: Add Platform Statistics Tables
-- Sprint A: Steps 1-2
-- Created: 2026-01-13

-- Step 1: Platform Statistics Table
-- Aggregates daily platform-wide metrics for trend analysis
CREATE TABLE IF NOT EXISTS "PlatformStatistics" (
  "id" TEXT PRIMARY KEY,
  "date" DATE NOT NULL UNIQUE,
  "dau" INTEGER NOT NULL DEFAULT 0,
  "wau" INTEGER NOT NULL DEFAULT 0,
  "mau" INTEGER NOT NULL DEFAULT 0,
  "newUsers" INTEGER NOT NULL DEFAULT 0,
  "returningUsers" INTEGER NOT NULL DEFAULT 0,
  "retention7Day" DECIMAL(5,4),
  "retention30Day" DECIMAL(5,4),
  "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
  "questionsCorrect" INTEGER NOT NULL DEFAULT 0,
  "questionsIncorrect" INTEGER NOT NULL DEFAULT 0,
  "averageAccuracy" DECIMAL(5,4),
  "sessionsStarted" INTEGER NOT NULL DEFAULT 0,
  "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
  "averageSessionDuration" INTEGER,
  "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsReviewed" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsMature" INTEGER NOT NULL DEFAULT 0,
  "fsrsAverageRetention" DECIMAL(5,4),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformStatistics_date_idx" ON "PlatformStatistics"("date");
CREATE INDEX IF NOT EXISTS "PlatformStatistics_dau_idx" ON "PlatformStatistics"("dau");
CREATE INDEX IF NOT EXISTS "PlatformStatistics_createdAt_idx" ON "PlatformStatistics"("createdAt");

-- Step 2: Content Usage Statistics Table
-- Tracks which conditions/systems are being studied
CREATE TABLE IF NOT EXISTS "ContentStatistics" (
  "id" TEXT PRIMARY KEY,
  "conditionId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
  "questionsCorrect" INTEGER NOT NULL DEFAULT 0,
  "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
  "averageAccuracy" DECIMAL(5,4),
  "averageTimeSpent" INTEGER,
  "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
  "flagCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("conditionId") REFERENCES "MedicalContent"("conditionId") ON DELETE CASCADE,
  UNIQUE("conditionId", "date")
);

CREATE INDEX IF NOT EXISTS "ContentStatistics_conditionId_idx" ON "ContentStatistics"("conditionId");
CREATE INDEX IF NOT EXISTS "ContentStatistics_date_idx" ON "ContentStatistics"("date");
CREATE INDEX IF NOT EXISTS "ContentStatistics_views_idx" ON "ContentStatistics"("views");
CREATE INDEX IF NOT EXISTS "ContentStatistics_questionsAnswered_idx" ON "ContentStatistics"("questionsAnswered");
CREATE INDEX IF NOT EXISTS "ContentStatistics_uniqueUsers_idx" ON "ContentStatistics"("uniqueUsers");

-- Step 4: User Statistics Snapshot Table
-- Weekly snapshots of user progress for historical charts
CREATE TABLE IF NOT EXISTS "UserStatisticsSnapshot" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "snapshotDate" DATE NOT NULL,
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "correctAnswers" INTEGER NOT NULL DEFAULT 0,
  "accuracy" DECIMAL(5,4),
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "totalStudyTime" INTEGER NOT NULL DEFAULT 0,
  "conditionsMastered" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsTotal" INTEGER NOT NULL DEFAULT 0,
  "fsrsCardsMature" INTEGER NOT NULL DEFAULT 0,
  "fsrsAverageRetention" DECIMAL(5,4),
  "weakestSystem" TEXT,
  "strongestSystem" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE("userId", "snapshotDate")
);

CREATE INDEX IF NOT EXISTS "UserStatisticsSnapshot_userId_idx" ON "UserStatisticsSnapshot"("userId");
CREATE INDEX IF NOT EXISTS "UserStatisticsSnapshot_snapshotDate_idx" ON "UserStatisticsSnapshot"("snapshotDate");
CREATE INDEX IF NOT EXISTS "UserStatisticsSnapshot_accuracy_idx" ON "UserStatisticsSnapshot"("accuracy");
