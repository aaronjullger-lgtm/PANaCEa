-- =============================================================================
-- Supabase Storage: Two-Bucket Architecture + RLS
-- =============================================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor) or via psql.
--
-- Buckets (create via Dashboard if INSERT fails: Storage > New bucket):
--   - raw-source-vault: public = false. Only service_role can access.
--   - public-assets:    public = true.  SELECT for all; INSERT/UPDATE service_role only.
-- =============================================================================

-- 1) Create buckets (optional; some projects prefer Dashboard: Storage > New bucket)
--    raw-source-vault: public = false
--    public-assets:    public = true
INSERT INTO storage.buckets (id, name, public, file_size_limit, created_at, updated_at)
VALUES
  ('raw-source-vault', 'raw-source-vault', false, 52428800, now(), now()),
  ('public-assets', 'public-assets', true, 52428800, now(), now())
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  updated_at = now();

-- 2) raw-source-vault: no allow policies for anon or authenticated
--    → only service_role (bypasses RLS) can access. Default = deny.

-- 3) public-assets: allow SELECT for everyone (anon + authenticated)
DROP POLICY IF EXISTS "public-assets allow public read" ON storage.objects;
CREATE POLICY "public-assets allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public-assets');

-- No INSERT/UPDATE/DELETE for anon or authenticated on public-assets
-- → only service_role can write.
