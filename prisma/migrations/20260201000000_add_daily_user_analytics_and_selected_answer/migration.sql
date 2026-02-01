-- Add selectedAnswer to QuestionAttempt for drill/analytics
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "selectedAnswer" TEXT;

-- CreateTable: DailyUserAnalytics (per-user, per-day rollup for cron aggregate-analytics)
CREATE TABLE IF NOT EXISTS "DailyUserAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER,
    "systemsStudied" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyUserAnalytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyUserAnalytics_userId_sessionDate_key" ON "DailyUserAnalytics"("userId", "sessionDate");
CREATE INDEX IF NOT EXISTS "DailyUserAnalytics_userId_idx" ON "DailyUserAnalytics"("userId");
CREATE INDEX IF NOT EXISTS "DailyUserAnalytics_sessionDate_idx" ON "DailyUserAnalytics"("sessionDate");

ALTER TABLE "DailyUserAnalytics" ADD CONSTRAINT "DailyUserAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
