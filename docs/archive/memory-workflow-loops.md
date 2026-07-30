# Memory Workflow Loops

These loops use repo-defined skills under `.agents/skills`. They are intended to be repeated during PR review, scheduled audits, and memory-system changes.

## Skill Map

| Skill | Use |
|---|---|
| `.agents/skills/memory-discovery/SKILL.md` | Broad repo discovery, inventory, classification, storage/config mapping, and audit updates. |
| `.agents/skills/rag-quality/SKILL.md` | RAG/vector retrieval, embeddings, chunking, reranking, CRAG, and source attribution. |
| `.agents/skills/graph-memory/SKILL.md` | Entity/relation extraction, graph schema, graph traversal, GraphRAG, and graph fixtures. |
| `.agents/skills/tabular-memory/SKILL.md` | SQL-backed learner memory, cache tables, FSRS/progress state, imports, and table-query checks. |
| `.agents/skills/hybrid-retrieval/SKILL.md` | Vector, keyword, graph, table, and cached-content fusion into grounded context. |
| `.agents/skills/memory-safety/SKILL.md` | PII, secrets, prompt injection, poisoning, retention, provenance, and deletion controls. |
| `.agents/skills/memory-regression-eval/SKILL.md` | Golden queries, retrieval regressions, graph/table fixtures, safety fixtures, and CI gates. |
| `.agents/skills/panacea-verify/SKILL.md` | PANaCEa-specific validation command selection and result reporting. |

## 1. Memory Discovery Loop

Purpose: continuously discover memory-related code and dependencies.

Trigger: PR or scheduled audit touching `lib/services`, `functions/api`, `prisma`, `scripts`, `docs`, prompts, workflows, or skills.

Inputs: git diff, keyword scan, schema diff, dependency diff, docs/workflow changes.

Skills used: `memory-discovery`, `rag-quality`, `graph-memory`, `tabular-memory`, `memory-safety`, `panacea-verify`.

Steps:

1. Observe repo changes.
2. Run keyword clusters for RAG/vector, graph, tabular, agent memory, and prompt integration.
3. Classify components as Active, Experimental, Test-only, Deprecated, Dead/unused, or Unclear.
4. Update inventory with file paths and line numbers.
5. Detect new storage, config, dependency, or prompt-injection risk.
6. Validate with targeted tests or mark missing tests.
7. Write audit notes.

Validation checks:

- `rg` finds no unclassified memory path.
- Prisma schema changes are explained.
- New retrievers have tests or explicit test gaps.
- New external memory stores have deletion/retention notes.

Failure handling:

- Mark unsupported claims as `Unclear`.
- Add a follow-up issue or P0/P1/P2 action.
- Do not approve hidden memory stores.

Output artifacts: `docs/memory-audit.md`, inventory diff, risk list.

Next-loop handoff: RAG Quality, Graph Memory, Tabular Memory, Memory Safety.

## 2. RAG Quality Loop

Purpose: improve retrieval quality.

Trigger: changes to embeddings, chunking, search, reranking, CRAG, library answer generation, or source ingestion.

Inputs: golden queries, source corpus, embeddings, retrieval config, expected citations.

Skills used: `rag-quality`, `memory-regression-eval`, `memory-safety`, `panacea-verify`.

Steps:

1. Collect representative clinical and exam-prep queries.
2. Retrieve documents through the active endpoint or service.
3. Score relevance, citation accuracy, grounding, and latency.
4. Inspect false positives, false negatives, stale hits, and no-context failures.
5. Adjust chunking, filters, top-k, reranking, or source metadata.
6. Rerun evals and compare to baseline.
7. Document changes and remaining failure modes.

Validation checks:

- Hit@K and MRR meet baseline.
- Answers cite expected source records.
- No-context paths fail closed.
- Prompt context stays within token budget.

Failure handling:

- Roll back config-only changes.
- Quarantine bad chunks/sources.
- Mark the query as a golden failure with owner and fix path.

Output artifacts: retrieval eval report, failed query set, updated golden query file.

Next-loop handoff: Hybrid Retrieval and Regression/Eval.

## 3. Graph Memory Loop

Purpose: improve entity/relation memory.

Trigger: graph schema, graph builder, extractor, traversal, medical content, or prerequisite logic changes.

Inputs: content rows, graph fixture, expected nodes/edges, expected traversal answers.

Skills used: `graph-memory`, `memory-regression-eval`, `panacea-verify`.

Steps:

1. Extract entities.
2. Extract relation candidates.
3. Validate edge types, confidence, source ids, and metadata.
4. Update graph in a reversible build or fixture DB.
5. Validate graph consistency.
6. Run traversal/path tests.
7. Compare graph-supported answers against expected answers.
8. Document graph gaps.

Validation checks:

- No orphan edges.
- Edge enum matches extractor intent.
- Traversal handles incoming and outgoing edges.
- Path weights use actual path edges.
- Low-confidence relations are not promoted silently.

Failure handling:

- Block destructive graph rebuilds.
- Keep prior graph snapshot.
- Quarantine relation candidates.
- Emit a graph gap report.

Output artifacts: graph consistency report, relation gap list, traversal regression tests.

Next-loop handoff: Hybrid Retrieval.

## 4. Tabular Memory Loop

Purpose: improve structured/table-based memory.

Trigger: Prisma migration, learner analytics change, FSRS/progress changes, cache schema changes, or data import scripts.

Inputs: schema, migrations, anonymized fixtures, expected SQL/table answers.

Skills used: `tabular-memory`, `memory-safety`, `memory-regression-eval`, `panacea-verify`.

Steps:

1. Detect affected schemas and indexes.
2. Validate data types and required relations.
3. Test SQL/table queries.
4. Check joins, filters, tenant boundaries, and pagination.
5. Compare outputs to expected learner-state answers.
6. Document schema gaps.

Validation checks:

- No orphaned progress or review records.
- User-scoped queries include user filter.
- CSV/import scripts have dry-run and duplicate checks.
- Cache records include expiry/deletion path.

Failure handling:

- Stop migration or import.
- Generate remediation SQL or script notes.
- Require backup before destructive repair.

Output artifacts: schema map, query coverage report, import/export manifest.

Next-loop handoff: Memory Safety and Regression/Eval.

## 5. Hybrid Retrieval Loop

Purpose: combine vector, graph, and tabular memory.

Trigger: query router, answer composer, graph/RAG integration, or personalized answer changes.

Inputs: query, user scope, vector candidates, graph candidates, tabular learner context, citation requirements.

Skills used: `hybrid-retrieval`, `rag-quality`, `graph-memory`, `tabular-memory`, `memory-safety`, `panacea-verify`.

Steps:

1. Route query by intent.
2. Retrieve from vector store.
3. Retrieve from graph store when relationships are relevant.
4. Retrieve from tabular store when personalization is relevant and authorized.
5. Fuse and rerank results into a common memory result schema.
6. Compose grounded prompt context.
7. Evaluate answer quality and citation coverage.

Validation checks:

- Route decision is traced.
- Source types are tagged.
- User-specific context is tenant-scoped.
- Citations survive fusion/reranking.
- Composer rejects unsafe or untrusted context instructions.

Failure handling:

- Fall back to the safest single retriever.
- Explain no-context state.
- Log route failure without raw sensitive context.

Output artifacts: hybrid retrieval trace, fused context snapshot, eval report.

Next-loop handoff: Memory Safety and Regression/Eval.

## 6. Memory Safety Loop

Purpose: protect against unsafe, stale, private, or poisoned memory.

Trigger: content ingestion, file upload, graph rebuild, embedding backfill, cache creation, or external-memory deletion.

Inputs: uploaded content, extracted text, source metadata, owner scope, cache name, retention policy.

Skills used: `memory-safety`, `memory-discovery`, `tabular-memory`, `panacea-verify`.

Steps:

1. Scan memory inputs.
2. Detect PII, secrets, prompt-injection attempts, and suspicious source instructions.
3. Validate provenance, license/publication state, content hash, and review state.
4. Enforce retention and deletion policy.
5. Quarantine risky memory.
6. Log decision metadata.
7. Run safety tests.

Validation checks:

- PII/secrets are not logged.
- External caches can be deleted and verified.
- Unreviewed content is not used for prompt context unless explicitly allowed.
- Poisoned source fixtures fail closed.

Failure handling:

- Quarantine source.
- Skip embedding.
- Revoke or delete cache.
- Emit audit log and owner task.

Output artifacts: safety decision log, quarantine manifest, deletion proof.

Next-loop handoff: Regression/Eval.

## 7. Regression/Eval Loop

Purpose: prevent memory quality regressions.

Trigger: CI, nightly run, monthly deep audit, or any retrieval/memory PR.

Inputs: golden queries, expected sources, baseline metrics, graph/table fixtures.

Skills used: `memory-regression-eval`, `rag-quality`, `graph-memory`, `tabular-memory`, `memory-safety`, `panacea-verify`.

Steps:

1. Run golden queries.
2. Measure retrieval precision/recall, Hit@K, MRR, citation validity, and faithfulness.
3. Run graph traversal fixtures.
4. Run table query fixtures.
5. Compare against baseline.
6. Flag regressions.
7. Create issue or patch recommendation.
8. Update eval report.

Validation checks:

- No P0 metric regression.
- No missing expected citations.
- No tenant isolation failure.
- No unsafe prompt/context acceptance.
- `npm run verify:memory` passes.

Failure handling:

- Fail CI for P0 regression.
- Mark external-service flakiness separately.
- Preserve failed traces for debugging.

Output artifacts: eval report, baseline diff, failed query trace.

Next-loop handoff: Memory Discovery and targeted repair loop.
