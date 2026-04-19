-- Sprint 18 — NotificationLog model
-- Unblocks the TODO at functions/api/cron/push-reminders.ts:370
--   `notificationsSent24h: 0, // TODO: track via NotificationLog when migration ships`
--   `notificationsSent7d: 0,`
--
-- The habit-formation throttler needs a rolling count of notifications sent
-- per user so it can enforce maxPerDay, prevent spam, and rotate notification
-- types. Persisting a log (rather than counting a KV bucket) also unlocks
-- downstream A/B-testing of notification types vs. study-session lift.
--
-- Greenfield-safe per prisma/audit/DATABASE_AUDIT_2026-04-17.md.

-- ============================================================================
-- NotificationLog Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "NotificationLog" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "channel"          TEXT NOT NULL,              -- PUSH | EMAIL | IN_APP
    "notificationType" TEXT NOT NULL,              -- REVIEW_DUE | STREAK_RISK | DAILY_GOAL | HABIT_CUE | SYSTEM_NEGLECT | ENCOURAGEMENT
    "title"            TEXT NOT NULL,
    "body"             TEXT NOT NULL,
    "actionUrl"        TEXT,
    "payload"          JSONB,
    "endpoint"         TEXT,                       -- PushSubscription endpoint if channel = PUSH
    "status"           TEXT NOT NULL DEFAULT 'SENT', -- SENT | FAILED | EXPIRED | DELIVERED | OPENED
    "errorDetail"      TEXT,
    "sentAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt"      TIMESTAMP(3),
    "openedAt"         TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Foreign Keys
-- ============================================================================
ALTER TABLE "NotificationLog"
    ADD CONSTRAINT "NotificationLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Indexes
-- ============================================================================
-- Per-user timeline queries (throttling window checks) — covers both 24h and 7d
CREATE INDEX "NotificationLog_userId_sentAt_idx"
    ON "NotificationLog"("userId", "sentAt" DESC);

-- Per-user + type rollups (rotate which notification type fires next)
CREATE INDEX "NotificationLog_userId_notificationType_sentAt_idx"
    ON "NotificationLog"("userId", "notificationType", "sentAt" DESC);

-- Global sentAt for admin analytics / A/B cohort slicing
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");

-- Channel-only filter for operational dashboards
CREATE INDEX "NotificationLog_channel_idx" ON "NotificationLog"("channel");

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE "NotificationLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_log_select_own"
  ON "NotificationLog"
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Inserts happen from the cron (service role — bypasses RLS). Leaving a
-- matching USER insert policy for future client-side in-app notifications.
CREATE POLICY "notification_log_insert_own"
  ON "NotificationLog"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "notification_log_update_own"
  ON "NotificationLog"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");
