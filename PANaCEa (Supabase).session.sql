-- =============================================================================
-- Supabase Storage: Two-Bucket Architecture (Refinery + Visual Ingestion)
-- =============================================================================
-- Run in Supabase SQL Editor. Safe to re-run (ON CONFLICT updates existing).
--
-- Buckets:
--   raw-source-vault: private. Service role only (Drive ingest, signed URLs).
--   public-assets:    public read. Approved media after triage.
-- =============================================================================

-- 1) Create or update buckets (50MB limit each)
INSERT INTO storage.buckets (id, name, public, file_size_limit, created_at, updated_at)
VALUES
  ('raw-source-vault', 'raw-source-vault', false, 52428800, now(), now()),
  ('public-assets', 'public-assets', true, 52428800, now(), now())
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  updated_at = now();

-- 2) raw-source-vault: no RLS policies for anon/authenticated → service_role only.

-- 3) public-assets: allow public read
DROP POLICY IF EXISTS "public-assets allow public read" ON storage.objects;
CREATE POLICY "public-assets allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'public-assets');

-- Writes to public-assets remain service_role only (no anon/authenticated INSERT/UPDATE/DELETE).
