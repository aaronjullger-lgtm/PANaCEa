-- Migration: add UserStatistics table and extend StudySession for clinical profile dashboard
-- Note: Run via Prisma Migrate or apply manually in Postgres.

-- Create UserStatistics table
CREATE TABLE IF NOT EXISTS "UserStatistics" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "correctAnswers" INTEGER NOT NULL DEFAULT 0,
  "avgTimePerQuestion" DOUBLE PRECISION,
  "systemStats" JSONB,
  "rushedSystems" TEXT[] NOT NULL DEFAULT '{}',
  "overthinkingSystems" TEXT[] NOT NULL DEFAULT '{}',
  "diagnosisBias" JSONB,
  "strongestSystems" TEXT[] NOT NULL DEFAULT '{}',
  "weakestSystems" TEXT[] NOT NULL DEFAULT '{}',
  "peakStudyHours" INTEGER[] NOT NULL DEFAULT '{}',
  "avgSessionLength" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK to User
ALTER TABLE "UserStatistics"
  ADD CONSTRAINT IF NOT EXISTS "UserStatistics_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "UserStatistics_userId_idx" ON "UserStatistics"("userId");

-- Extend StudySession
ALTER TABLE "StudySession"
  ADD COLUMN IF NOT EXISTS "systemsTargeted" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "StudySession"
  ADD COLUMN IF NOT EXISTS "sessionType" TEXT;
