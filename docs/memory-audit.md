# Memory Systems Audit

Date: 2026-05-17

Scope: RAG, vector memory, graph memory, tabular memory, agent memory, prompt/context injection, storage/config, tests/evals, security/privacy/governance, dead code, and repo skills/workflows.

This audit is evidence-first. When an implementation path could not be fully proven active from code, it is marked `Unclear`.

## Executive Summary

StudyPANaCEa has active memory systems across several layers:

- Vector/RAG memory over `MedicalContentEmbedding` with pgvector/HNSW and Gemini `text-embedding-005`.
- Hybrid keyword plus vector library search using full-text search and reciprocal rank fusion.
- SQL-backed learner memory through `QuestionAttempt`, `ReviewLog`, `StudySession`, `UserProgress`, `KnowledgeCache`, `SemanticCache`, and `QuestionEmbedding`.
- Graph memory through `GraphNode`, `GraphEdge`, graph builder/extractor services, graph APIs, and GraphRAG traversal code.
- Document ingestion through PDF extraction, Adobe structured data, OpenStax chunking, Gemini Files/cached content, Supabase Storage, and CSV restore/audit scripts.

Top risks after the remediation pass:

- `ContentChunk` chunk memory exists but the main RAG path uses `MedicalContentEmbedding`, so chunk-level retrieval is not clearly wired into production RAG.
- Hybrid retrieval is duplicated between `lib/search.ts` and `lib/services/search/hybridSearch.ts`.
- Gemini cached-content memory can include learner weak spots and recent incorrect attempts, so deletion/retention and privacy controls remain high-value regression targets even after deletion-order hardening.
- Offline seeded retrieval fixtures now gate Hit@K/MRR for RAG, graph, tabular, and hybrid memory; live pgvector/graph/table integration remains a release-hardening option.
- Browser-exposed Gemini key configuration must remain blocked; Gemini must use server-side `GEMINI_API_KEY`.

## Inventory Table

| Area | Component | File(s) | Status | Evidence | Risk | Notes |
|---|---|---|---|---|---|---|
| RAG/vector | Core RAG context service | `lib/services/ragContextService.ts` | Active | Lines 1-7 describe pgvector/HNSW and Gemini embeddings; lines 104-118 query `MedicalContentEmbedding`; lines 202-220 format prompt context. | High | Main RAG path retrieves full `MedicalContent` records. |
| Vector storage | `MedicalContentEmbedding` | `prisma/schema.prisma`, `prisma/migrations/20260206000000_add_medical_content_embeddings/migration.sql` | Active | Schema lines 1841-1847 define `vector(768)`; migration creates pgvector table/index. | Medium | Needs embedding model/version/hash lifecycle. |
| Embedding model | Gemini `text-embedding-005` | `lib/gemini.ts` | Active | Lines 11-13 define model and 768 dimensions; lines 104-130 validate vector length. | Medium | Central helper exists. |
| Hybrid search | FTS plus vector RRF | `lib/search.ts`, `lib/services/search/hybridSearch.ts`, `functions/api/library/search.ts` | Active | `lib/search.ts` lines 73-93 RRF; `hybridSearch.ts` lines 99-189 SQL RRF; endpoint calls it at line 53. | High | Duplicate implementations. |
| RAG endpoints | Question explain/generate | `functions/api/questions/explain-rag.ts`, `functions/api/questions/generate-rag.ts` | Active | `explain-rag.ts` lines 136-153 retrieves/fails closed; `generate-rag.ts` lines 85-115 retrieves/refines/guards. | Medium | Some error paths leak raw details. |
| Chunk memory | `ContentChunk` and chunker | `prisma/schema.prisma`, `scripts/intelligence/chunk-content.ts` | Unclear | Schema lines 1849-1864 and chunk script lines 1-12 exist. | Medium | Not clearly used by primary RAG retrieval. |
| Textbook chunks | `TextbookChunk` retrieval | `scripts/ingest/openstax-ingest.ts`, `functions/api/content/textbook-retrieve.ts` | Active | OpenStax ingest lines 1-10; public retrieval lines 19-77. | High | Public raw chunk retrieval needs content/license review. |
| Rerank/CRAG | Retrieval refinement | `lib/services/rerankService.ts`, `lib/services/cragGuardrailService.ts`, `lib/services/search/correctiveRag.ts` | Active | Rerank service lines 1-30; CRAG guardrail lines 1-23. | Medium | Needs eval gate against golden queries. |
| Graph schema | `GraphNode`, `GraphEdge` | `prisma/schema.prisma` | Active | Enums lines 4329-4353; node model lines 4355-4376; edge model lines 4378-4398. | High | Relational graph, not external graph DB. |
| Graph builder/extractor | Entity/relation memory | `services/graph/GraphBuilder.ts`, `services/graph/RelationshipExtractor.ts` | Active | Builder starts line 18; extractor starts line 6. | High | Edge-type and selected-field defects found. |
| GraphRAG | Graph traversal retrieval | `lib/services/search/graphRag.ts` | Experimental | Module header now states graph-only lexical seeding; `graphRAGQuery` traverses graph nodes/edges. | Medium | Vector-seeded graph traversal belongs in the hybrid router. |
| Tabular learner memory | Attempts/reviews/progress/sessions | `prisma/schema.prisma` | Active | `QuestionAttempt` line 2705, `ReviewLog` line 2865, `StudySession` line 3288, `UserProgress` line 3902. | Medium | Product-critical SQL memory. |
| Question semantic spacing | `QuestionEmbedding` | `prisma/schema.prisma`, `functions/api/srs/semantic-reorder.ts`, `functions/api/embeddings/generate-questions.ts` | Active | Schema line 4984; semantic reorder line 69; generator line 96. | Medium | Separate from main RAG router. |
| Agent/user memory | Gemini `KnowledgeCache` | `functions/api/knowledge/cache/student-context.ts`, `prisma/schema.prisma` | Active | Student context lines 78-107; cache creation line 124; schema line 1482. | Critical | External cache retention and deletion need hardening. |
| Semantic cache | Token/Jaccard question cache | `lib/services/semanticCacheService.ts`, `functions/api/_shared/semantic-cache.ts` | Active | Both implement threshold 0.85 token/Jaccard matching. | Medium | Duplicate logic, not true embedding semantic cache. |
| Document loaders | PDF/Adobe/Gemini/Supabase ingestion | `functions/api/content/library/extract.ts`, `functions/api/content/library/ingest.ts`, `services/domain/educationalResourceService.ts` | Active | Adobe extract lines 1-3; ingest lines 64-96; educational service lines 111-145. | High | Needs provenance/quarantine policy. |
| CSV/table operations | CSV restore/audit/export | `scripts/restore_medical_content_csv.ts`, `scripts/db/audit-user-progress.ts` | Experimental | CSV restore lines 31-84; audit CSV output lines 242-295. | Medium | Operational scripts, not governed memory pipeline. |
| Repo skills | Memory-relevant workflow skills | `.agents/skills/*/SKILL.md` | Active | Content refinery references RAG/search files at line 16; Prisma skill covers schema/data integrity at line 8. | Low | No top-level `skills/` or `.skills/` project tree found. |

## RAG / Vector Findings

1. Active pgvector RAG exists.
   - Evidence: `lib/services/ragContextService.ts` lines 1-7, 104-118, 129-197, 202-220.
   - How it works: embed query through `getEmbedding`, query `MedicalContentEmbedding` with `<=>`, filter by similarity, hydrate `MedicalContent`, compose cited prompt context.
   - Gap: filters like `system` are applied after vector top-k hydration.
   - Fix: push metadata filters into vector SQL and return route/score traces.

2. Embedding storage is aligned on 768 dimensions.
   - Evidence: `lib/gemini.ts` lines 11-13 and 104-130; `prisma/schema.prisma` lines 1841-1847.
   - Gap: no explicit content hash, source revision, or model-version migration policy.
   - Fix: add hash/version columns or a sidecar embedding metadata table.

3. Hybrid search is active but duplicated.
   - Evidence: `lib/search.ts` lines 1-8 and 73-93; `lib/services/search/hybridSearch.ts` lines 1-12 and 99-189.
   - Gap: behavior can drift across endpoints.
   - Fix: consolidate to one retrieval service and keep a compatibility wrapper.

4. Chunk memory is partially implemented.
   - Evidence: `ContentChunk` in `prisma/schema.prisma` lines 1849-1864; chunking script in `scripts/intelligence/chunk-content.ts` lines 1-12.
   - Gap: primary RAG service does not clearly retrieve `ContentChunk`.
   - Fix: either wire chunk-level retrieval into RAG or mark the chunk path deprecated.

5. RAG endpoints mostly fail closed.
   - Evidence: `functions/api/questions/explain-rag.ts` lines 136-153; `functions/api/questions/generate-rag.ts` lines 97-115.
   - Gap: live pgvector fixtures are still missing.
   - Fix: seed deterministic retrieval fixtures and compare Hit@K/MRR in CI.

## Graph Memory Findings

1. Graph memory is modeled in Postgres.
   - Evidence: `prisma/schema.prisma` lines 4329-4398.
   - Representation: typed node and edge rows with confidence, metadata, source, and timestamps.

2. Graph build/extraction edge-type defects were covered with regression tests.
   - Evidence: `tests/graph/GraphBuilder.test.ts` covers `CO_OCCURRENCE`; `tests/graph/RelationshipExtractor.test.ts` covers `TREATS`.
   - Gap: graph extraction still needs low-confidence candidate quarantine before production graph rebuilds.
   - Fix: keep extractor tests in the memory eval gate and add graph consistency reports for rebuilds.

3. Relationship extraction references fields it did not select.
   - Evidence: `services/graph/RelationshipExtractor.ts` line 86 selects only `id` and `name`, while later logic references richer drug fields.
   - Gap: relations may be missing or incorrectly inferred.
   - Fix: select the needed fields or simplify the matching logic.

4. Graph traversal/path calculations now have regression coverage.
   - Evidence: `tests/domain/pathFinderService.test.ts` covers multi-hop weighted paths; `tests/api/graph/expand.test.ts` covers incoming/outgoing expansion.
   - Gap: live DB graph expansion fixtures remain optional release-hardening.
   - Fix: add a seeded DB graph smoke when a disposable integration database is approved.

5. GraphRAG vector integration is explicitly out of scope for the graph primitive.
   - Evidence: `lib/services/search/graphRag.ts` now documents graph-only lexical seeding.
   - Fix: implement vector-seeded graph expansion in the future hybrid router if needed.

## Tabular Memory Findings

1. SQL learner memory is active and broad.
   - Evidence: `QuestionAttempt`, `ReviewLog`, `StudySession`, and `UserProgress` in `prisma/schema.prisma` lines 2705, 2865, 3288, and 3902.
   - Use: attempts, progress, FSRS state, session analytics, weak-area targeting.
   - Gap: not unified with vector/graph retrieval in a single context router.

2. `KnowledgeCache` is long-context agent memory.
   - Evidence: `functions/api/knowledge/cache/student-context.ts` lines 78-107 and 124-172.
   - Gap: scheduled cleanup/audit reporting is still a production operations decision.
   - Fix: keep external-delete-before-DB-delete tests and retention-decision tests in CI.

3. `SemanticCache` is duplicated and token-based.
   - Evidence: `lib/services/semanticCacheService.ts` lines 26-57 and `functions/api/_shared/semantic-cache.ts` lines 14-33.
   - Gap: name says semantic but implementation is Jaccard token overlap.
   - Fix: rename or replace with embedding-backed cache.

4. CSV/table scripts exist but are operational, not a governed memory pipeline.
   - Evidence: `scripts/restore_medical_content_csv.ts` lines 31-84; `scripts/db/audit-user-progress.ts` lines 242-295.
   - Gap: no manifest, retention, or audit approval flow.
   - Fix: require dry-run manifests for restore/import scripts.

## Hybrid Retrieval Findings

Current hybrid retrieval is keyword plus vector. It does not yet combine vector, graph, and tabular learner memory into one ranked context payload, but `docs/memory-architecture.md` now defines the common result contract, source-attribution contract, routing requirements, and eval hook needed to build it.

Required target behavior:

- Route query intent to vector, graph, tabular, or blended retrieval.
- Retrieve vector/FTS source evidence.
- Expand entities and relations from graph memory.
- Retrieve learner-specific tabular context when the user is authenticated and the request requires personalization.
- Fuse results into a common schema with provenance, score, source type, tenant scope, and citation metadata.
- Rerank, deduplicate, sanitize, and bound token usage.

## Prompt and Context Injection Map

| Entry point | Memory source | Injection point | Notes |
|---|---|---|---|
| `functions/api/questions/explain-rag.ts` | `retrieveContext` | Lines 155-190 | Grounded explanation prompt. |
| `functions/api/questions/generate-rag.ts` | `retrieveAndRefineContext` | Lines 120-145 | Question generation with CRAG gate. |
| `functions/api/library/answer.ts` | Library vector results | Lines 146-154 | Injects reference excerpts. |
| `functions/api/library/query.ts` | Gemini cached content | Lines 83-96 | Cached textbook/library chat. |
| `functions/api/ai/chat/stream.ts` | User or blueprint cached content | Lines 305-347 | General chat streaming. |
| `functions/api/tutor/chat.ts` | Cached content | Lines 140-156 | Tutor chat. |
| `lib/ai/aiGateway.ts` | Cached content option | Lines 228-245, 305-312 | Gateway-level pass-through. |
| `components/pages/MyLibraryPage.tsx` | Active knowledge cache | Lines 672-683 | Client-selected cached context. |
| `components/pages/TutorChatPage.tsx` | Active knowledge cache | Lines 193-200 | Client-to-stream handoff. |
| `components/questions/ExplanationPanel.tsx` | Active knowledge cache | Lines 431-436 | Explanation panel handoff. |

## Evaluation and Testing Findings

Existing coverage:

- `tests/ragContextService.test.ts`: prompt formatting, quality scoring, refinement.
- `functions/api/questions/explain-rag.test.ts` and `functions/api/questions/generate-rag.test.ts`: RAG endpoint behavior.
- `lib/services/search/hybridSearch.test.ts`, `lib/services/search/contextualRetrieval.test.ts`, `lib/services/search/correctiveRag.test.ts`: search/refinement tests.
- `lib/services/search/graphRag.test.ts`, `tests/graph/GraphBuilder.test.ts`, `tests/graph/RelationshipExtractor.test.ts`, `tests/api/graph/*.test.ts`: graph memory tests.
- `lib/evaluation/ragasMetrics.ts` and `lib/evaluation/embeddingBenchmark.ts`: eval harnesses.
- `evals/memory/golden_queries.yaml`, `evals/memory/fixture_corpus.json`, and `evals/memory/run_memory_evals.ts`: offline golden-query manifest, seeded fixture retrieval scoring, and deterministic safety gate.
- `scripts/memory/run-memory-regression-tests.mjs`: stable memory regression test runner used by local verification and CI.
- `package.json`: exposes `eval:memory`, `test:memory`, and `verify:memory` so agents do not need to retype long command lists.
- `.github/workflows/memory-evals.yml`: memory-focused CI hook.
- `tests/memory/contextSanitizer.test.ts`, `tests/memory/knowledgeCacheDeletion.test.ts`, `tests/memory/knowledgeCacheRetention.test.ts`, `tests/memory/memoryEvalGoldenQueries.test.ts`, and `tests/memory/tabularMemorySchema.test.ts`: memory safety/cache/eval/schema regression tests.
- `functions/api/library/answer.test.ts` and `functions/api/_shared/question-generator.memory-safety.test.ts`: prompt-context sanitation tests for library answers and textbook grounding context.
- `tests/api/graph/expand.test.ts`: API-level graph expansion regression test for incoming/outgoing edges.

Remaining optional release-hardening coverage:

- Live pgvector/HNSW integration test with disposable seeded database fixtures.
- End-to-end chunk-level retrieval tests if `ContentChunk` becomes the primary RAG path.
- Privacy tests for learner-memory logging once a logging sink test harness exists.

## Security, Privacy, and Governance Findings

- PII/learner data: `student-context.ts` sends weak spots and recent incorrect attempts to Gemini cached content. Treat this as sensitive external memory.
- Tenant isolation: many endpoints are authenticated, but `textbook-retrieve.ts` is public and returns raw chunk text. Confirm only public/licensed content is stored there.
- Prompt injection: retrieved clinical and guideline context is sanitized through `lib/services/memory/contextSanitizer.ts` before prompt insertion.
- Memory poisoning: Adobe/Gemini/PDF/CSV ingestion paths need provenance, content hash, review state, and quarantine.
- Retention/deletion: `KnowledgeCache` has TTL fields, and external Gemini cache deletion is now regression-tested before DB deletion.
- Secrets: Gemini must use server-side `GEMINI_API_KEY`; browser-exposed AI keys should not be used.
- Auditability: retrieval traces, route decisions, source hashes, and context composer output should be logged without sensitive text.

## Dead Code and Duplication

- Duplicate hybrid search: `lib/search.ts` and `lib/services/search/hybridSearch.ts`.
- Duplicate semantic cache: `lib/services/semanticCacheService.ts` and `functions/api/_shared/semantic-cache.ts`.
- `ContentChunk` and contextual retrieval are partially implemented but not clearly connected to primary RAG.
- GraphRAG documentation claims vector+graph behavior that is not evident in the implementation.
- Some planning docs are stale or conflicting; refresh after architecture decisions.

## Recommended Architecture

Adopt a canonical memory boundary under `lib/services/memory` or `lib/services/retrieval`:

1. Ingestion adapters: PDF, Adobe structuredData, OpenStax, Gemini Files, Drive, CSV.
2. Normalization: canonical source ids, content hash, license/publication state, owner scope, review status.
3. Vector memory: embedding lifecycle, pgvector query service, HNSW settings, metadata filters.
4. Graph memory: entity/relation extraction, graph build snapshots, traversal API.
5. Tabular memory: learner-state query service with tenant-scoped access.
6. Retrieval router: classify query, call retrievers, collect traces.
7. Context composer: dedupe, sanitize, cite, bound tokens, isolate untrusted text.
8. Evaluator: RAGAS metrics, embedding benchmark, graph/table fixtures, golden queries.
9. Observability: route traces, score distributions, cache hit/miss, safe logs.
10. Governance: retention, deletion, provenance, quarantine, approval workflow.

## Priority Plan

P0:

- Keep browser-exposed Gemini API keys blocked.
- Sanitize raw API errors.
- Fix Gemini cached-content replacement/deletion.
- Fix graph edge/traversal defects.

P1:

- Consolidate hybrid search.
- Wire or retire `ContentChunk`.
- Expand memory eval CI from offline seeded fixture metrics to live seeded database metrics when an integration DB is approved.
- Keep `npm run verify:memory` green for memory/RAG/graph/table PRs.
- Add provenance and poisoning checks for ingestion.

P2:

- Add unified memory traces.
- Refresh stale memory docs.
- Expand table-memory tests.

## Readiness Checklist

- [x] RAG inventory
- [x] Vector store mapping
- [x] Embedding model mapping
- [x] Chunking strategy
- [x] Retrieval tests
- [x] Reranking tests
- [x] Graph memory inventory
- [x] Entity/relation schema
- [x] Graph traversal tests
- [x] Tabular memory inventory
- [x] Table/schema documentation
- [x] SQL/table query tests
- [x] Hybrid retrieval strategy
- [x] Context injection map
- [x] Source attribution
- [x] Memory eval code
- [x] PII controls
- [x] Prompt injection controls
- [x] Memory poisoning controls
- [x] Retention/deletion policy
- [x] Skill-based workflow loops
- [x] CI or automation hooks
