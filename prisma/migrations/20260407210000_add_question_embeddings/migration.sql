-- Question Embeddings for Semantic Spacing (Tier 2, Feature 1)
-- Enables KARL-inspired similarity-based session reordering.
-- Uses text-embedding-004 (768 dims) via Gemini API.
-- Companion to existing MedicalContentEmbedding table.

-- pgvector extension already created in 20260206000000 migration
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "QuestionEmbedding" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "questionId" TEXT NOT NULL,
  "embedding" vector(768) NOT NULL,
  "model" TEXT NOT NULL DEFAULT 'text-embedding-004',
  "embeddedText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionEmbedding_questionId_fkey"
    FOREIGN KEY ("questionId")
    REFERENCES "PreGeneratedQuestion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- One embedding per question
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionEmbedding_questionId_key"
  ON "QuestionEmbedding"("questionId");

-- IVFFlat cosine distance index for ANN search
-- lists=100 is appropriate for <100K vectors (tier2.md recommendation)
CREATE INDEX IF NOT EXISTS "QuestionEmbedding_embedding_idx"
  ON "QuestionEmbedding"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Index for model-based filtering (future multi-model support)
CREATE INDEX IF NOT EXISTS "QuestionEmbedding_model_idx"
  ON "QuestionEmbedding"("model");

COMMENT ON TABLE "QuestionEmbedding" IS 'Vector embeddings for question-level semantic spacing (KARL algorithm). 768-dim Gemini text-embedding-004.';
