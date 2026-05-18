---
name: hybrid-retrieval
description: Use this skill when combining vector, keyword, graph, table, and cached-content memory into a single answer context.
---

# Hybrid Retrieval

Use this skill when combining vector, keyword, graph, table, and cached-content memory into a single answer context.

## First Files

- `lib/services/search/hybridSearch.ts`
- `lib/search.ts`
- `lib/services/ragContextService.ts`
- `lib/services/search/graphRag.ts`
- `functions/api/library/search.ts`
- `functions/api/library/answer.ts`
- `functions/api/questions/explain-rag.ts`
- `functions/api/questions/generate-rag.ts`
- `functions/api/knowledge/cache/student-context.ts`
- `docs/memory-architecture.md`

## Loop

route query -> retrieve from vector store -> retrieve from graph store -> retrieve from tabular store -> fuse/rerank results -> compose grounded context -> evaluate answer quality

## Checks

- Route decision is explicit and logged without sensitive text.
- Every result has source type, source id, score, and provenance.
- User-specific tabular memory is tenant-scoped.
- Citations survive fusion and reranking.
- Context composer isolates untrusted source text.
- Fallbacks are safe and explain no-context states.

## Output Artifacts

- Hybrid trace JSON.
- Fused context snapshot.
- Golden-query eval report.
- Action list for missing source types.

## Commands

- `npm run eval:memory`
- `npm run test:memory`
