-- Semantic search: pgvector embeddings for Reference Library (MedicalContent)
-- Use text-embedding-005 (768 dimensions) via Google AI embedContent API.
-- Run embedding backfill with: npx tsx scripts/semantic/embed-reference-cards.ts

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "MedicalContentEmbedding" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "medicalContentId" TEXT NOT NULL,
  "embedding" vector(768) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalContentEmbedding_medicalContentId_fkey" FOREIGN KEY ("medicalContentId") REFERENCES "MedicalContent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MedicalContentEmbedding_medicalContentId_key" ON "MedicalContentEmbedding"("medicalContentId");

-- Cosine distance index for fast nearest-neighbor (<=> operator)
CREATE INDEX IF NOT EXISTS "MedicalContentEmbedding_embedding_idx" ON "MedicalContentEmbedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE "MedicalContentEmbedding" IS 'Vector embeddings for Reference Library semantic search (text-embedding-005, 768 dims).';
