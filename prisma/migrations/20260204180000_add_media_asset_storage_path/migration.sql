-- Add storagePath to MediaAsset for reliable delete and URL construction
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "storagePath" TEXT;
