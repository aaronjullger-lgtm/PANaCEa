-- Deepen data storage: drill session records, audit log, question attempt medicalContentId, daily accuracy by system, user-condition accuracy

-- DrillSessionRecord: session-level drill metrics (from /api/performance/record)
CREATE TABLE IF NOT EXISTS "DrillSessionRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "totalQuestions" INTEGER NOT NULL,
  "accuracy" DOUBLE PRECISION NOT NULL,
  "timeSpentMs" INTEGER NOT NULL,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "sessionStart" TIMESTAMP(3) NOT NULL,
  "sessionEnd" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrillSessionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DrillSessionRecord_userId_idx" ON "DrillSessionRecord"("userId");
CREATE INDEX IF NOT EXISTS "DrillSessionRecord_userId_sessionStart_idx" ON "DrillSessionRecord"("userId", "sessionStart");
CREATE INDEX IF NOT EXISTS "DrillSessionRecord_mode_idx" ON "DrillSessionRecord"("mode");

ALTER TABLE "DrillSessionRecord" ADD CONSTRAINT "DrillSessionRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog: system/cron audit trail
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "entityId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- QuestionAttempt: add medicalContentId for content-level analytics
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "medicalContentId" TEXT;
CREATE INDEX IF NOT EXISTS "QuestionAttempt_medicalContentId_createdAt_idx" ON "QuestionAttempt"("medicalContentId", "createdAt");

-- DailyUserAnalytics: add accuracyBySystem Json
ALTER TABLE "DailyUserAnalytics" ADD COLUMN IF NOT EXISTS "accuracyBySystem" JSONB;

-- UserConditionAccuracy: per-user per-condition accuracy snapshot
CREATE TABLE IF NOT EXISTS "UserConditionAccuracy" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conditionId" TEXT NOT NULL,
  "medicalContentId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "correctCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserConditionAccuracy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserConditionAccuracy_userId_conditionId_key" ON "UserConditionAccuracy"("userId", "conditionId");
CREATE INDEX IF NOT EXISTS "UserConditionAccuracy_userId_idx" ON "UserConditionAccuracy"("userId");
CREATE INDEX IF NOT EXISTS "UserConditionAccuracy_conditionId_idx" ON "UserConditionAccuracy"("conditionId");
CREATE INDEX IF NOT EXISTS "UserConditionAccuracy_medicalContentId_idx" ON "UserConditionAccuracy"("medicalContentId");

ALTER TABLE "UserConditionAccuracy" ADD CONSTRAINT "UserConditionAccuracy_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
