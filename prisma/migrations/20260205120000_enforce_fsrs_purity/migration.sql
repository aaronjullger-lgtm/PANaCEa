-- FSRS Data Isolation: Enforce that review_type = 'real' only when sessionType = 'MAIN'.
-- Run scripts/purge-bad-fsrs-logs.ts first if you have existing bad rows.
-- Optional: comment out or skip this migration if you prefer application-level enforcement only.

ALTER TABLE "ReviewLog"
ADD CONSTRAINT "enforce_fsrs_main_session"
CHECK (
  (review_type = 'real' AND "sessionType" = 'MAIN') OR
  (review_type != 'real')
);
