-- Enable RLS on StudentReservoirItem — the one real RLS gap surfaced by the
-- 2026-04-17 live-DB re-baseline (see prisma/audit/DATABASE_AUDIT_2026-04-17.md
-- Addendum §A.2). Table was empty when this migration ran; adding policies
-- carries zero data-migration risk. Service role bypasses RLS (force_rls=false
-- is the expected project-wide pattern, matching sibling user-scoped tables).
--
-- Applied via Supabase MCP on 2026-04-17; this file is the Prisma-side record.
-- Run `npx prisma migrate resolve --applied 20260418000000_enable_rls_student_reservoir_item`
-- to register it with Prisma without re-running the SQL.

ALTER TABLE "StudentReservoirItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_reservoir_select_own"
  ON "StudentReservoirItem"
  FOR SELECT
  USING (auth.uid()::text = "userId");

CREATE POLICY "student_reservoir_insert_own"
  ON "StudentReservoirItem"
  FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "student_reservoir_update_own"
  ON "StudentReservoirItem"
  FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "student_reservoir_delete_own"
  ON "StudentReservoirItem"
  FOR DELETE
  USING (auth.uid()::text = "userId");
