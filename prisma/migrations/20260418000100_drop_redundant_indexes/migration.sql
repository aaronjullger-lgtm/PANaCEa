-- Drop verified-redundant indexes identified by the 2026-04-17 live-DB
-- re-baseline. Each drop is documented with its reason. Applied via Supabase
-- MCP on 2026-04-17; this file is the Prisma-side record. Run
-- `npx prisma migrate resolve --applied 20260418000100_drop_redundant_indexes`
-- after pulling.

-- 1. MC_buzzwords_gin_idx vs MedicalContent_buzzwords_gin_idx: identical GIN
--    indexes on MedicalContent.buzzwords. Keep the Prisma-style long name;
--    drop the legacy abbreviated one.
DROP INDEX IF EXISTS public."MC_buzzwords_gin_idx";

-- 2. idx_user_question_seen_user_last (DESC) duplicates
--    UserQuestionSeen_userId_lastSeenAt_idx (ASC). Postgres btree scans
--    bidirectionally at equal cost; two indexes is pure write amplification.
--    Drop the pre-Prisma idx_* one.
DROP INDEX IF EXISTS public.idx_user_question_seen_user_last;

-- 3. idx_ubm_user_created (DESC) duplicates
--    UserBehaviorMetrics_userId_createdAt_idx (ASC). Same reasoning as (2).
DROP INDEX IF EXISTS public.idx_ubm_user_created;

-- 4. Drug_drugClass_idx: btree on a _text[] ARRAY column. btree on arrays
--    only matches whole-array equality — never how drugClass is queried.
--    Pure dead weight. Replace with GIN later if array membership search is
--    needed.
DROP INDEX IF EXISTS public."Drug_drugClass_idx";
