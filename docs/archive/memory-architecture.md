# Memory Architecture

This document defines a target architecture for StudyPANaCEa memory systems. It is intentionally incremental: it preserves the existing Prisma, pgvector, Gemini, Cloudflare Pages, Supabase, and TypeScript stack while reducing duplicated retrieval logic and governance gaps.

## Goals

- Keep all retrieval paths source-attributed and testable.
- Unify vector, graph, tabular, and cached-content memory behind a small set of contracts.
- Make prompt context bounded, cited, sanitized, and tenant-aware.
- Support medical-learning quality evals and safety regression tests.
- Keep ingestion auditable with provenance, review state, retention, and deletion semantics.

## Proposed Modules

```text
lib/services/memory/
  ingestion/
  normalization/
  vectorMemory.ts
  graphMemory.ts
  tabularMemory.ts
  retrievalRouter.ts
  contextComposer.ts
  memoryTrace.ts
  governance.ts
  evalContracts.ts
```

Use this as a target structure, not a migration mandate. Existing files can move behind compatibility exports only after tests are in place.

## Shared Result Contract

All memory retrievers should return a common shape:

```ts
interface MemoryResult {
  id: string;
  sourceType: 'medical_content' | 'content_chunk' | 'textbook_chunk' | 'graph_node' | 'graph_edge' | 'learner_state' | 'knowledge_cache';
  sourceId: string;
  userScope: 'public' | 'user' | 'admin';
  title?: string;
  text: string;
  score: number;
  retrievalSignals: Record<string, number | string | boolean | null>;
  citation?: {
    label: string;
    url?: string;
    page?: number;
    section?: string;
  };
  provenance: {
    origin: string;
    contentHash?: string;
    embeddingModel?: string;
    generatedAt?: string;
    reviewedAt?: string;
    reviewStatus?: 'draft' | 'approved' | 'quarantined' | 'deprecated';
  };
}
```

## Ingestion

Current entry points include:

- Adobe PDF Extract: `functions/api/content/library/extract.ts` and `functions/api/content/library/ingest.ts`.
- Educational uploads: `services/domain/educationalResourceService.ts`.
- OpenStax chunks: `scripts/ingest/openstax-ingest.ts`.
- Medical content CSV restore: `scripts/restore_medical_content_csv.ts`.
- Gemini file/cached content flows: `functions/api/knowledge/upload.ts`, `functions/api/knowledge/cache*.ts`.

Target behavior:

1. Accept content from the adapter.
2. Normalize text and metadata.
3. Assign provenance and owner scope.
4. Hash content.
5. Run safety/provenance checks.
6. Store raw/source artifact and normalized records.
7. Queue embedding/chunking/graph extraction only after approval or safe auto-approval.

## Vector Memory

Canonical source today: `MedicalContentEmbedding` over `MedicalContent`.

Target behavior:

- One embedding service owns model, dimensions, batching, retries, and version metadata.
- One vector query service owns pgvector SQL, HNSW settings, top-k, filters, and tracing.
- Chunk-level and record-level retrieval should be explicit modes.
- Re-embedding should trigger when content hash or embedding model version changes.

Current chunking state:

- `MedicalContentEmbedding` is the active production vector table for record-level medical content retrieval.
- `ContentChunk` and `scripts/intelligence/chunk-content.ts` define a chunk-memory path, but chunk-level retrieval is still a migration target rather than the primary RAG path.
- `TextbookChunk` is active for textbook retrieval and must remain public/licensed-only when exposed through public endpoints.
- Until chunk-level RAG is fully wired, new retrieval work should state whether it targets record-level `MedicalContentEmbedding`, textbook chunks, or future `ContentChunk` memory.

Chunking rules to preserve:

- Keep chunks source-separated and citation-preserving.
- Track source id, content type, content hash, embedding model, and owner/publication scope.
- Do not mix learner-private context into public vector indexes.
- Rebuild embeddings when content text, chunk boundaries, or embedding model changes.

## Graph Memory

Canonical source today: `GraphNode` and `GraphEdge`.

Target behavior:

- Graph builds are snapshot-based and reversible.
- Extractors emit typed relation candidates before committing edges.
- Graph validation blocks orphan edges, invalid enum use, and low-confidence writes.
- GraphRAG should either be graph-only by contract or explicitly vector-seeded.

## Tabular Memory

Canonical sources today include `QuestionAttempt`, `ReviewLog`, `StudySession`, `UserProgress`, `KnowledgeCache`, `SemanticCache`, and `QuestionEmbedding`.

Target behavior:

- Keep learner-state retrieval in a dedicated tenant-scoped service.
- Separate aggregate analytics from prompt-injected learner memory.
- Do not send raw attempts or sensitive weak-spot profiles to external cached content without retention/deletion coverage.
- Add typed query contracts for personalization context.

## Retrieval Router

The router should classify a query into one or more routes:

- `vector`: source/evidence retrieval.
- `keyword`: exact term or abbreviation lookup.
- `graph`: differential, complication, prerequisite, or relationship query.
- `tabular`: personalized learner-state query.
- `cached_content`: textbook/library long-context query.
- `hybrid`: blended retrieval requiring fusion.

The router should emit a trace with route decision, query rewrite, retrievers called, candidate counts, top scores, filters, and fallback reason.

## Context Composer

The composer should:

- Deduplicate by source id and content hash.
- Keep untrusted source text inside explicit boundaries.
- Strip or neutralize source-level prompt injection patterns.
- Preserve citations and provenance.
- Bound token budget by route and answer type.
- Fail closed when source quality is below threshold.

Current prompt-context safety baseline:

- `lib/services/memory/contextSanitizer.ts` neutralizes high-risk source instructions before prompt insertion.
- `lib/services/ragContextService.ts` applies the sanitizer inside `formatContextForPrompt`.
- `lib/services/guidelineRagService.ts` applies the same sanitizer before guideline snippets enter system prompt context.
- `functions/api/library/answer.ts` sanitizes retrieved reference excerpts before answer-prompt insertion.
- `functions/api/_shared/question-generator.ts` sanitizes textbook and external grounding context before question-generation prompt insertion.
- Source attribution must keep condition/content-type labels, source ids in traces, and citation text separate from retrieved source text.

Source-attribution contract:

| Source type | Required attribution fields | Prompt requirement |
|---|---|---|
| `medical_content` | `sourceId`, condition, content type, similarity score | Include `[Source: condition - type]` or equivalent and preserve score in traces. |
| `textbook_chunk` | chunk id, resource id, page/section when available, license/publication state | Cite page/section when available and exclude private uploads from public endpoints. |
| `graph_node` / `graph_edge` | node/edge id, edge type, confidence, source content id | Include relationship type and confidence in graph-supported answers. |
| `learner_state` | user id scope, table/model, aggregate timestamp | Use only aggregate learner context needed for personalization; do not expose raw private attempts unless required. |
| `knowledge_cache` | local cache id, Gemini cache name, owner user id, expiry | Pass cache references only after auth and retention checks. |

## Evaluator

Memory evals should cover:

- Retrieval Hit@K and MRR.
- Faithfulness/groundedness.
- Citation accuracy.
- Prompt-injection resistance.
- Graph traversal correctness.
- Table query correctness and tenant isolation.
- Cache retention/deletion behavior.

## Observability

Log metadata, not sensitive content:

- route id
- retriever names
- source ids
- score distributions
- cache hit/miss
- context token count
- safety/quarantine decision
- user scope

Avoid logging full learner context, cached content text, API keys, or raw uploaded text.

## Governance

Every memory write should answer:

- Who owns it?
- Where did it come from?
- Is it public, user-scoped, or admin-only?
- What is its content hash?
- Has it been reviewed?
- When should it expire?
- How is it deleted from internal and external stores?
- Can it be used in prompts?

Current storage/schema/config map:

| Memory area | Storage | Key schema/config | Governance baseline |
|---|---|---|---|
| RAG/vector | Postgres pgvector | `MedicalContentEmbedding.embedding vector(768)`, Gemini `text-embedding-005` | Server-side `GEMINI_API_KEY`; source id and similarity required. |
| Chunk memory | Postgres tables | `ContentChunk`, `TextbookChunk` | Public/licensed content only for public retrieval; chunk path remains explicitly tracked. |
| Graph memory | Postgres relational graph | `GraphNode`, `GraphEdge`, graph edge enum | Typed edges, confidence, source id, traversal regression tests. |
| Tabular learner memory | Postgres/Prisma | `QuestionAttempt`, `ReviewLog`, `StudySession`, `UserProgress` | User-scoped queries and static schema tests for tenant boundaries. |
| External cached content | Gemini cached content plus `KnowledgeCache` | `geminiCacheName`, `userId`, `expiresAt` | External delete before DB delete; replacement/deletion regression tests. |
| Semantic cache | Postgres/Prisma | `SemanticCache` token/Jaccard cache | Treat as lexical cache until embedding-backed semantics exist. |

Current safety/eval hooks:

- `evals/memory/golden_queries.yaml` defines RAG, graph, tabular, hybrid, and safety fixtures.
- `evals/memory/fixture_corpus.json` provides deterministic non-production evidence for offline Hit@K/MRR scoring.
- `evals/memory/run_memory_evals.ts` validates golden-query coverage, seeded retrieval quality, and deterministic safety fixtures.
- `scripts/memory/run-memory-regression-tests.mjs` centralizes the memory regression test set.
- `npm run eval:memory`, `npm run test:memory`, and `npm run verify:memory` are the canonical local commands.
- `tests/memory/contextSanitizer.test.ts` covers prompt-injection neutralization for retrieved context.
- `tests/memory/knowledgeCacheDeletion.test.ts` covers external cache deletion ordering.
- `tests/memory/knowledgeCacheRetention.test.ts` covers cache-expiry decisions without exposing raw learner ids.
- `tests/memory/tabularMemorySchema.test.ts` covers user-scoped tabular memory schema contracts.
- `tests/api/graph/expand.test.ts` covers incoming/outgoing API graph expansion.
- `.github/workflows/memory-evals.yml` runs `npm run eval:memory` and `npm run test:memory`.
