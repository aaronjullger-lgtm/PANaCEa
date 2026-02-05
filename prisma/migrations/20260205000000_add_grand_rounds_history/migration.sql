-- CreateTable: GrandRoundsHistory for daily leaderboard (one row per user per day UTC).
-- Populated on Grand Rounds submit; used by leaderboard, rank, and completed APIs.
CREATE TABLE IF NOT EXISTS "GrandRoundsHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "completionTimeMs" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrandRoundsHistory_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one row per user per date
CREATE UNIQUE INDEX IF NOT EXISTS "GrandRoundsHistory_userId_date_key" ON "GrandRoundsHistory"("userId", "date");

-- Index for leaderboard queries (date, score desc, completionTimeMs asc)
CREATE INDEX IF NOT EXISTS "GrandRoundsHistory_date_idx" ON "GrandRoundsHistory"("date");
CREATE INDEX IF NOT EXISTS "GrandRoundsHistory_date_score_idx" ON "GrandRoundsHistory"("date", "score");

-- Foreign key to User
ALTER TABLE "GrandRoundsHistory" DROP CONSTRAINT IF EXISTS "GrandRoundsHistory_userId_fkey";
ALTER TABLE "GrandRoundsHistory" ADD CONSTRAINT "GrandRoundsHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
