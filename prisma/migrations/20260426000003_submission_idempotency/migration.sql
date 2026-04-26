-- Persistent idempotency ledger for launch-critical study submission mutations.
-- KV remains a fast cache, but this table is the durable guard against retries,
-- double-clicks, and offline replay corrupting progress/review state.

CREATE TABLE IF NOT EXISTS "SubmissionIdempotency" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "responseJson" JSONB,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubmissionIdempotency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubmissionIdempotency_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubmissionIdempotency_user_endpoint_key_unique"
  ON "SubmissionIdempotency" ("userId", "endpoint", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "SubmissionIdempotency_userId_idx"
  ON "SubmissionIdempotency" ("userId");

CREATE INDEX IF NOT EXISTS "SubmissionIdempotency_endpoint_idx"
  ON "SubmissionIdempotency" ("endpoint");

CREATE INDEX IF NOT EXISTS "SubmissionIdempotency_status_idx"
  ON "SubmissionIdempotency" ("status");

CREATE INDEX IF NOT EXISTS "SubmissionIdempotency_expiresAt_idx"
  ON "SubmissionIdempotency" ("expiresAt");

CREATE INDEX IF NOT EXISTS "SubmissionIdempotency_user_endpoint_status_idx"
  ON "SubmissionIdempotency" ("userId", "endpoint", "status");
