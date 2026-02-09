-- Upgrade vector search to HNSW for ~10x faster approximate nearest neighbor.
-- Replaces IVFFlat indexes on MedicalContentEmbedding and ContentChunk.

CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing IVFFlat (or legacy) vector indexes
DROP INDEX IF EXISTS "MedicalContentEmbedding_embedding_idx";
DROP INDEX IF EXISTS "ContentChunk_embedding_idx";
DROP INDEX IF EXISTS "ContentChunk_embedding_cosine_ops";

-- HNSW: fast and accurate approximate nearest neighbor (cosine distance)
CREATE INDEX "MedicalContentEmbedding_embedding_hnsw"
ON "MedicalContentEmbedding" USING hnsw (embedding vector_cosine_ops);

CREATE INDEX "ContentChunk_embedding_hnsw"
ON "ContentChunk" USING hnsw (embedding vector_cosine_ops);
