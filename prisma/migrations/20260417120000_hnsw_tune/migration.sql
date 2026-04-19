-- Tune HNSW indexes for 768-dim Gemini text-embedding-005 clinical retrieval.
-- Upgrade m=16 (default) → m=24, ef_construction=64 (default) → ef_construction=200.
-- Trades a longer one-time build for materially better recall@10, especially
-- at small-to-medium corpus sizes where default parameters under-perform.
--
-- Runtime `hnsw.ef_search` is set per-connection in application code
-- (see lib/search.ts, functions/api/library/semantic-search.ts); do NOT set a
-- global default here — that would double-enforce and make tuning opaque.

CREATE EXTENSION IF NOT EXISTS vector;

-- Bump maintenance_work_mem for this migration so HNSW build fits in memory.
-- Scoped to the current session only; does not affect runtime.
SET maintenance_work_mem = '512MB';

-- MedicalContentEmbedding
DROP INDEX IF EXISTS "MedicalContentEmbedding_embedding_hnsw";
CREATE INDEX "MedicalContentEmbedding_embedding_hnsw"
ON "MedicalContentEmbedding" USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 200);

-- ContentChunk (RAG chunks)
DROP INDEX IF EXISTS "ContentChunk_embedding_hnsw";
CREATE INDEX "ContentChunk_embedding_hnsw"
ON "ContentChunk" USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 200);

RESET maintenance_work_mem;
