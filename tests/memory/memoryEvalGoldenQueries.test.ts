import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { evaluateGoldenManifest } from '@/evals/memory/run_memory_evals';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load(input: string): unknown };

describe('memory golden query manifest', () => {
  it('covers all required memory areas and passes deterministic safety checks', () => {
    const manifest = yaml.load(readFileSync('evals/memory/golden_queries.yaml', 'utf8'));
    const fixture = JSON.parse(readFileSync('evals/memory/fixture_corpus.json', 'utf8')) as {
      documents: Array<{ id: string; source_type: string; text: string }>;
    };
    const report = evaluateGoldenManifest(manifest, 'evals/memory/golden_queries.yaml', {
      path: 'evals/memory/fixture_corpus.json',
      documents: fixture.documents,
    });

    expect(report.failed).toBe(0);
    expect(report.areaCoverage.rag_vector).toBeGreaterThan(0);
    expect(report.areaCoverage.graph_memory).toBeGreaterThan(0);
    expect(report.areaCoverage.tabular_memory).toBeGreaterThan(0);
    expect(report.areaCoverage.hybrid_retrieval).toBeGreaterThan(0);
    expect(report.areaCoverage.memory_safety).toBeGreaterThan(0);
    expect(report.retrieval?.hitAtK).toBe(1);
    expect(report.retrieval?.mrr).toBeGreaterThan(0.5);
  });
});
