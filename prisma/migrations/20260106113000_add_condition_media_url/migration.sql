-- Add media_url column to Condition for linking primary image/media path
ALTER TABLE "Condition" ADD COLUMN IF NOT EXISTS "media_url" TEXT;
