-- Content Refinery: Source Provenance, RAG Chunking, Question/Mastery Granularity
-- Enums
CREATE TYPE "QuestionFormat" AS ENUM ('VIGNETTE', 'IMAGE_FIRST', 'RECALL');
CREATE TYPE "SourceMaterialType" AS ENUM ('TEXTBOOK', 'WIKIMEDIA', 'JOURNAL', 'GUIDELINE', 'USER_UPLOAD', 'OTHER');

-- SourceMaterial (chain of custody)
CREATE TABLE "SourceMaterial" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "sourceType" "SourceMaterialType" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "licenseType" TEXT,
    "licenseUrl" TEXT,
    "citationText" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SourceMaterial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourceMaterial_sourceType_idx" ON "SourceMaterial"("sourceType");
CREATE INDEX "SourceMaterial_processed_idx" ON "SourceMaterial"("processed");

-- MediaAsset: provenance and attribution
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "sourceMaterialId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "licenseType" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "attribution" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "originalSourceId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "isClassicPortrayal" BOOLEAN;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "rawStoragePath" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "provenanceStatus" TEXT;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sourceMaterialId_fkey" FOREIGN KEY ("sourceMaterialId") REFERENCES "SourceMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "MediaAsset_sourceMaterialId_idx" ON "MediaAsset"("sourceMaterialId");

-- RAG: ContentChunk (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "ContentChunk" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "medicalContentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "tokenCount" INTEGER,

    CONSTRAINT "ContentChunk_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ContentChunk" ADD CONSTRAINT "ContentChunk_medicalContentId_fkey" FOREIGN KEY ("medicalContentId") REFERENCES "MedicalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "ContentChunk_medicalContentId_field_chunkIndex_key" ON "ContentChunk"("medicalContentId", "field", "chunkIndex");
CREATE INDEX IF NOT EXISTS "ContentChunk_medicalContentId_idx" ON "ContentChunk"("medicalContentId");
CREATE INDEX IF NOT EXISTS "ContentChunk_field_idx" ON "ContentChunk"("field");
CREATE INDEX IF NOT EXISTS "ContentChunk_embedding_cosine_ops" ON "ContentChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Question: task type, format, optional media
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "taskType" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "questionFormat" "QuestionFormat";
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT;
ALTER TABLE "Question" ADD CONSTRAINT "Question_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Question_mediaAssetId_idx" ON "Question"("mediaAssetId");
CREATE INDEX IF NOT EXISTS "Question_questionFormat_idx" ON "Question"("questionFormat");
CREATE INDEX IF NOT EXISTS "Question_taskType_idx" ON "Question"("taskType");

-- UserProgress: denormalized system + typed FSRS columns
ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "system" TEXT;
ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "fsrsStability" DOUBLE PRECISION;
ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "fsrsDifficulty" DOUBLE PRECISION;
ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "fsrsState" INTEGER;
ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "fsrsReps" INTEGER;
ALTER TABLE "UserProgress" ALTER COLUMN "fsrsCard" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "UserProgress_system_idx" ON "UserProgress"("system");

-- ReviewLog: task type and error taxonomy
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "taskType" TEXT;
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "errorCategory" TEXT;
ALTER TABLE "ReviewLog" ADD COLUMN IF NOT EXISTS "errorConfidence" DOUBLE PRECISION;
