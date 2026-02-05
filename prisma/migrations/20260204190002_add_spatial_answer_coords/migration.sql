-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "spatialAnswerCoords" JSONB;
