-- Swap QuestionEmbedding vector index from IVFFlat(lists=100) to HNSW.
-- Applied via Supabase MCP on 2026-04-17. Table was empty (0 rows) at apply
-- time so the DROP+CREATE was free.
--
-- The initial apply used HNSW defaults (m=16, ef_construction=64). The repo's
-- established pattern for 768-dim Gemini embeddings (see
-- 20260417120000_hnsw_tune) is m=24, ef_construction=200. Because the table
-- is still empty, we re-tune here to match — no corpus cost. Consolidating
-- into a single migration rather than tracking my mid-apply defaults as
-- drift.
--
-- Run `npx prisma migrate resolve --applied 20260418000200_question_embedding_ivfflat_to_hnsw`
-- after pulling; the DROP+CREATE is idempotent.

CREATE EXTENSION IF NOT EXISTS vector;

SET maintenance_work_mem = '512MB';

DROP INDEX IF EXISTS "QuestionEmbedding_embedding_idx";

CREATE INDEX "QuestionEmbedding_embedding_idx"
  ON "QuestionEmbedding"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 200);

RESET maintenance_work_mem;
