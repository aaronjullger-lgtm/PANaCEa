-- Hot path: SRS next-item query filters UserTopicProgress by userId, state IN (1,3), nextReviewDate <= now, orderBy nextReviewDate asc.
CREATE INDEX IF NOT EXISTS "UserTopicProgress_userId_state_nextReviewDate_idx"
  ON "UserTopicProgress"("userId", "state", "nextReviewDate");
