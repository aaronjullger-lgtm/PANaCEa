#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const MEMORY_TEST_FILES = [
  'functions/api/_shared/question-generator.memory-safety.test.ts',
  'functions/api/library/answer.test.ts',
  'tests/ragContextService.test.ts',
  'tests/cragGuardrailService.test.ts',
  'tests/graphRag.test.ts',
  'tests/knowledgeTutorCache.test.ts',
  'tests/api/graph/path.test.ts',
  'tests/api/graph/search.test.ts',
  'tests/api/graph/confidence.test.ts',
  'functions/api/questions/explain-rag.test.ts',
  'functions/api/questions/generate-rag.test.ts',
  'lib/evaluation/embeddingBenchmark.test.ts',
  'lib/evaluation/ragasMetrics.test.ts',
  'lib/services/search/contextualRetrieval.test.ts',
  'lib/services/search/graphRag.test.ts',
  'lib/services/search/hybridSearch.test.ts',
  'tests/memory/contextSanitizer.test.ts',
  'tests/memory/knowledgeCacheDeletion.test.ts',
  'tests/memory/knowledgeCacheRetention.test.ts',
  'tests/memory/memoryEvalGoldenQueries.test.ts',
  'tests/memory/tabularMemorySchema.test.ts',
  'lib/services/tokenMatchCache.test.ts',
  'tests/api/graph/expand.test.ts',
  'tests/graph/GraphBuilder.test.ts',
  'tests/graph/RelationshipExtractor.test.ts',
  'tests/domain/pathFinderService.test.ts',
];

const extraArgs = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', ...MEMORY_TEST_FILES, ...extraArgs],
  {
    stdio: 'inherit',
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.signal) {
  console.error(`Memory regression tests terminated by signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
