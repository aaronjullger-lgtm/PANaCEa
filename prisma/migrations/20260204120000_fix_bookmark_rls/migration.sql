-- Corrective migration: Bookmark table does not exist in schema (bookmarks are SavedQuestion or client-side).
-- Remove RLS for "Bookmark" only if the table exists (e.g. from an older manual create).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Bookmark') THEN
    DROP POLICY IF EXISTS "bookmark_select_own" ON "Bookmark";
    DROP POLICY IF EXISTS "bookmark_all_own" ON "Bookmark";
    ALTER TABLE "Bookmark" DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
