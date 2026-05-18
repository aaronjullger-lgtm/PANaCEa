---
name: memory-regression-eval
description: Use this skill when adding or running memory evals, golden queries, retrieval regression tests, graph traversal tests, table-memory tests, or CI gates for memory quality.
---

# Memory Regression Eval

Use this skill when adding or running memory evals, golden queries, retrieval regression tests, graph traversal tests, table-memory tests, or CI gates for memory quality.

## First Files

- `evals/memory/golden_queries.yaml`
- `scripts/memory/run-memory-regression-tests.mjs`
- `lib/evaluation/ragasMetrics.ts`
- `lib/evaluation/embeddingBenchmark.ts`
- `tests/ragContextService.test.ts`
- `lib/services/search/hybridSearch.test.ts`
- `lib/services/search/graphRag.test.ts`
- `tests/graph/GraphBuilder.test.ts`
- `tests/graph/RelationshipExtractor.test.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/memory-evals.yml`
- `.github/workflows/sched-monthly-deep-audit.yml`

## Loop

run golden queries -> measure retrieval precision/recall/faithfulness -> compare baseline -> flag regressions -> create issue or patch recommendation -> update eval report

## Checks

- Golden queries have expected source selectors.
- Retrieval traces include score and source id.
- Graph fixtures cover edge type and traversal direction.
- Table fixtures cover tenant isolation.
- Safety fixtures cover prompt injection and memory poisoning.
- CI distinguishes deterministic regressions from external-service flakiness.

## Output Artifacts

- Eval report.
- Baseline diff.
- Failed query traces.
- Patch recommendations.

## Commands

- `npm run eval:memory`
- `npm run test:memory`
- `npm run verify:memory`
