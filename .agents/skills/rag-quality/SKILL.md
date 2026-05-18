---
name: rag-quality
description: Use this skill when improving or reviewing retrieval quality, vector search, embeddings, chunking, reranking, CRAG, library search, question RAG, or source attribution.
---

# RAG Quality

Use this skill when improving or reviewing retrieval quality, vector search, embeddings, chunking, reranking, CRAG, library search, question RAG, or source attribution.

## First Files

- `lib/services/ragContextService.ts`
- `lib/gemini.ts`
- `lib/services/search/hybridSearch.ts`
- `lib/search.ts`
- `lib/services/rerankService.ts`
- `lib/services/cragGuardrailService.ts`
- `lib/services/search/correctiveRag.ts`
- `lib/services/search/contextualRetrieval.ts`
- `functions/api/library/search.ts`
- `functions/api/library/semantic-search.ts`
- `functions/api/library/answer.ts`
- `functions/api/questions/explain-rag.ts`
- `functions/api/questions/generate-rag.ts`
- `scripts/semantic/embed-reference-cards.ts`
- `scripts/intelligence/chunk-content.ts`
- `evals/memory/golden_queries.yaml`

## Loop

collect queries -> retrieve documents -> score relevance -> inspect failures -> adjust chunking/indexing/reranking -> rerun evals -> document changes

## Checks

- Metadata filters are applied before top-k when possible.
- Embedding model and vector dimensions match schema.
- Retrieval returns source ids, scores, and citations.
- Context stays bounded and source-separated.
- No-context paths fail closed.
- Reranking improves or preserves golden-query metrics.

## Commands

- `npm test -- tests/ragContextService.test.ts`
- `npm test -- functions/api/questions/explain-rag.test.ts`
- `npm test -- functions/api/questions/generate-rag.test.ts`
- `npm test -- lib/services/search/hybridSearch.test.ts`
- `npm run verify:memory`
- `npm run benchmark:relevance` if configured and safe for the environment.
