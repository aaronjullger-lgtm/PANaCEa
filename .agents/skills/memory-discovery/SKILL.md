---
name: memory-discovery
description: Use this skill when auditing or reviewing RAG, vector memory, graph memory, tabular memory, agent memory, retrieval routing, prompts, context injection, or memory storage/config.
---

# Memory Discovery

Use this skill when auditing or reviewing RAG, vector memory, graph memory, tabular memory, agent memory, retrieval routing, prompts, context injection, or memory storage/config.

## First Files

- `docs/memory-audit.md`
- `docs/memory-architecture.md`
- `docs/memory-workflow-loops.md`
- `prisma/schema.prisma`
- `lib/services/ragContextService.ts`
- `lib/services/search/hybridSearch.ts`
- `lib/services/search/graphRag.ts`
- `services/graph/GraphBuilder.ts`
- `services/graph/RelationshipExtractor.ts`
- `functions/api/knowledge/cache/student-context.ts`

## Search Clusters

Run broad `rg` scans before making claims:

- RAG/vector: `rag|retrieval|retriever|retrieve|vector|embedding|embeddings|embed|chunk|chunks|similarity|semantic search|pgvector|rerank|hybrid search|bm25|keyword search`
- Graph: `graph|knowledge graph|entity|entities|relationship|relation|edge|node|triple|cypher|neo4j|ontology`
- Tabular: `table|tabular|dataframe|pandas|polars|duckdb|sqlite|postgres|sqlalchemy|csv|parquet|spreadsheet|rows|columns|schema|records`
- Agent memory: `memory|memories|conversation memory|long term|short term|episodic|semantic|profile|user facts|checkpoint|scratchpad|history|session|store|persistence`
- Prompt integration: `context|prompt|system prompt|messages|tools|agent|planner|reflection|feedback|eval|evaluation|grounding|citation|source`

## Workflow

1. Inspect repo skills and workflow conventions first.
2. Search code, configs, docs, tests, prompts, workflows, and scripts.
3. Verify each finding with code, schema, tests, imports, runtime path, or docs.
4. Classify each component as `Active`, `Experimental`, `Test-only`, `Deprecated`, `Dead/unused`, or `Unclear`.
5. Classify risk as `Low`, `Medium`, `High`, or `Critical`.
6. Mark uncertain findings as `Unclear`.
7. Update or reference `docs/memory-audit.md`.

## Validation

- Every claim has a path and line number where possible.
- Do not infer from file names alone.
- Check both implementation and tests.
- Check prompt/context injection points.
- Check storage/schema/config and environment variables.
- Check privacy, retention, provenance, and tenant isolation.
