#!/usr/bin/env tsx
/**
 * Offline memory-eval manifest gate.
 *
 * This validates the golden query contract and deterministic safety fixtures.
 * It also runs a seeded lexical retrieval fixture so local and CI checks can
 * catch obvious Hit@K/MRR regressions without production databases or AI calls.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sanitizeRetrievedContextText } from '../../lib/services/memory/contextSanitizer';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml') as { load(input: string): unknown };

const DEFAULT_INPUT = 'evals/memory/golden_queries.yaml';
const DEFAULT_FIXTURE_CORPUS = 'evals/memory/fixture_corpus.json';
const REQUIRED_AREAS = [
  'rag_vector',
  'graph_memory',
  'tabular_memory',
  'hybrid_retrieval',
  'memory_safety',
] as const;

type RequiredArea = (typeof REQUIRED_AREAS)[number];
type CheckStatus = 'pass' | 'fail';

interface GoldenQuery {
  id?: unknown;
  area?: unknown;
  query?: unknown;
  expected_source_selectors?: unknown;
  expected_behavior?: unknown;
  fixture_source_text?: unknown;
  requires_authenticated_fixture_user?: unknown;
  metrics?: unknown;
}

interface GoldenManifest {
  version?: unknown;
  owner?: unknown;
  notes?: unknown;
  queries?: unknown;
}

interface FixtureDocument {
  id: string;
  source_type: string;
  title?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

interface FixtureCorpus {
  documents?: unknown;
}

export interface EvalCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface MemoryEvalReport {
  timestamp: string;
  input: string;
  version: number | null;
  queryCount: number;
  requiredAreas: readonly RequiredArea[];
  areaCoverage: Record<RequiredArea, number>;
  retrieval?: {
    fixtureCorpus: string;
    queryCount: number;
    scoredQueryCount: number;
    hitAtK: number;
    mrr: number;
  };
  checks: EvalCheck[];
  failed: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function addCheck(checks: EvalCheck[], name: string, passed: boolean, detail: string): void {
  checks.push({ name, status: passed ? 'pass' : 'fail', detail });
}

function containsSelector(query: GoldenQuery): boolean {
  return (
    Array.isArray(query.expected_source_selectors) && query.expected_source_selectors.length > 0
  );
}

function hasMetric(query: GoldenQuery, metricName: string): boolean {
  return isRecord(query.metrics) && typeof query.metrics[metricName] === 'number';
}

function hasBehavior(query: GoldenQuery, behavior: string): boolean {
  return asStringArray(query.expected_behavior).includes(behavior);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function selectorMatches(doc: FixtureDocument, selector: unknown): boolean {
  if (!isRecord(selector)) return false;
  if (typeof selector.source_type === 'string' && selector.source_type !== doc.source_type) {
    return false;
  }

  const haystack =
    `${doc.title ?? ''} ${doc.text} ${JSON.stringify(doc.metadata ?? {})}`.toLowerCase();

  if (Array.isArray(selector.contains_any)) {
    const containsAny = selector.contains_any.some(
      (value) => typeof value === 'string' && haystack.includes(value.toLowerCase())
    );
    if (!containsAny) return false;
  }

  if (Array.isArray(selector.edge_type_any)) {
    const edgeType = typeof doc.metadata?.edge_type === 'string' ? doc.metadata.edge_type : '';
    if (!selector.edge_type_any.includes(edgeType)) return false;
  }

  if (Array.isArray(selector.tables_any)) {
    const tables = Array.isArray(doc.metadata?.tables)
      ? doc.metadata.tables.filter((value): value is string => typeof value === 'string')
      : [];
    if (!selector.tables_any.some((table) => typeof table === 'string' && tables.includes(table))) {
      return false;
    }
  }

  return true;
}

function scoreDocument(queryText: string, doc: FixtureDocument): number {
  const queryTokens = new Set(tokenize(queryText));
  const docTokens = new Set(tokenize(`${doc.title ?? ''} ${doc.text}`));
  if (queryTokens.size === 0 || docTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of queryTokens) {
    if (docTokens.has(token)) overlap += 1;
  }

  return overlap / queryTokens.size;
}

function evaluateFixtureRetrieval(
  queries: GoldenQuery[],
  corpus: FixtureDocument[],
  checks: EvalCheck[],
  fixtureCorpus: string
): MemoryEvalReport['retrieval'] {
  const scoredQueries = queries.filter(
    (query) =>
      typeof query.query === 'string' &&
      Array.isArray(query.expected_source_selectors) &&
      query.expected_source_selectors.length > 0
  );

  let hits = 0;
  let reciprocalRankSum = 0;

  for (const query of scoredQueries) {
    const id = typeof query.id === 'string' ? query.id : 'unknown_query';
    const selectors = query.expected_source_selectors as unknown[];
    const relevantIds = new Set(
      corpus
        .filter((doc) => selectors.some((selector) => selectorMatches(doc, selector)))
        .map((doc) => doc.id)
    );
    const hitAtK =
      isRecord(query.metrics) && typeof query.metrics.hit_at_k === 'number'
        ? query.metrics.hit_at_k
        : 5;

    addCheck(
      checks,
      `${id}:fixture_relevant_docs`,
      relevantIds.size > 0,
      'Fixture corpus must contain at least one relevant document for each retrieval query.'
    );

    const ranking = corpus
      .map((doc) => ({ id: doc.id, score: scoreDocument(query.query as string, doc) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const rankIndex = ranking.findIndex((item) => relevantIds.has(item.id));
    const hasHit = rankIndex >= 0 && rankIndex < hitAtK;
    if (hasHit) hits += 1;
    if (rankIndex >= 0) reciprocalRankSum += 1 / (rankIndex + 1);

    addCheck(
      checks,
      `${id}:fixture_hit_at_${hitAtK}`,
      hasHit,
      `Expected relevant fixture doc in top ${hitAtK}; first relevant rank was ${rankIndex >= 0 ? rankIndex + 1 : 'none'}.`
    );
  }

  const scoredQueryCount = scoredQueries.length;
  const hitAtK = scoredQueryCount > 0 ? hits / scoredQueryCount : 0;
  const mrr = scoredQueryCount > 0 ? reciprocalRankSum / scoredQueryCount : 0;

  return {
    fixtureCorpus,
    queryCount: queries.length,
    scoredQueryCount,
    hitAtK: Math.round(hitAtK * 1000) / 1000,
    mrr: Math.round(mrr * 1000) / 1000,
  };
}

export function evaluateGoldenManifest(
  manifest: unknown,
  input: string = DEFAULT_INPUT,
  fixture?: { path: string; documents: FixtureDocument[] }
): MemoryEvalReport {
  const checks: EvalCheck[] = [];
  const parsed = isRecord(manifest) ? (manifest as GoldenManifest) : {};
  const queries = Array.isArray(parsed.queries) ? (parsed.queries as GoldenQuery[]) : [];
  const areaCoverage = Object.fromEntries(REQUIRED_AREAS.map((area) => [area, 0])) as Record<
    RequiredArea,
    number
  >;

  addCheck(checks, 'manifest_shape', isRecord(manifest), 'Manifest must be a YAML object.');
  addCheck(
    checks,
    'version_present',
    typeof parsed.version === 'number',
    'Manifest must include numeric version.'
  );
  addCheck(
    checks,
    'queries_present',
    queries.length > 0,
    'Manifest must include at least one query.'
  );

  for (const [index, query] of queries.entries()) {
    const id = typeof query.id === 'string' ? query.id : `query_${index}`;
    const area = typeof query.area === 'string' ? query.area : '';
    const behaviors = asStringArray(query.expected_behavior);

    if (REQUIRED_AREAS.includes(area as RequiredArea)) {
      areaCoverage[area as RequiredArea] += 1;
    }

    addCheck(
      checks,
      `${id}:id`,
      typeof query.id === 'string' && query.id.length > 0,
      'Query id is required.'
    );
    addCheck(
      checks,
      `${id}:area`,
      REQUIRED_AREAS.includes(area as RequiredArea),
      `Area must be one of ${REQUIRED_AREAS.join(', ')}.`
    );
    addCheck(
      checks,
      `${id}:query_text`,
      typeof query.query === 'string' && query.query.length > 10,
      'Query text is required.'
    );
    addCheck(
      checks,
      `${id}:expected_behavior`,
      behaviors.length > 0,
      'Expected behavior list is required.'
    );

    if (area === 'rag_vector' || area === 'graph_memory' || area === 'hybrid_retrieval') {
      addCheck(
        checks,
        `${id}:source_selectors`,
        containsSelector(query),
        'Retrieval queries need expected source selectors.'
      );
    }

    if (area === 'rag_vector' || area === 'hybrid_retrieval') {
      addCheck(
        checks,
        `${id}:hit_at_k`,
        hasMetric(query, 'hit_at_k'),
        'Vector/hybrid evals need Hit@K thresholds.'
      );
    }

    if (query.requires_authenticated_fixture_user === true) {
      const userScoped =
        hasBehavior(query, 'enforce_user_scope') ||
        hasBehavior(query, 'preserve_user_scope') ||
        hasBehavior(query, 'avoid_exposing_raw_private_attempt_text_unless_needed');
      addCheck(
        checks,
        `${id}:tenant_scope`,
        userScoped,
        'Authenticated fixtures must assert tenant-scope behavior.'
      );
    }

    if (area === 'memory_safety') {
      const fixture =
        typeof query.fixture_source_text === 'string' ? query.fixture_source_text : '';
      const sanitized = sanitizeRetrievedContextText(fixture);
      addCheck(
        checks,
        `${id}:safety_fixture`,
        fixture.length > 0,
        'Safety query must include fixture source text.'
      );
      addCheck(
        checks,
        `${id}:safety_flags`,
        sanitized.flags.length > 0,
        'Safety fixture must trigger sanitizer flags.'
      );
      addCheck(
        checks,
        `${id}:unsafe_instruction_removed`,
        !/ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|reveal\s+(?:the\s+)?system\s+prompt/i.test(
          sanitized.text
        ),
        'Sanitized fixture must remove high-risk source instructions.'
      );
    }
  }

  for (const area of REQUIRED_AREAS) {
    addCheck(
      checks,
      `coverage:${area}`,
      areaCoverage[area] > 0,
      `At least one ${area} query is required.`
    );
  }

  const retrieval = fixture
    ? evaluateFixtureRetrieval(queries, fixture.documents, checks, fixture.path)
    : undefined;

  const failed = checks.filter((check) => check.status === 'fail').length;

  return {
    timestamp: new Date().toISOString(),
    input,
    version: typeof parsed.version === 'number' ? parsed.version : null,
    queryCount: queries.length,
    requiredAreas: REQUIRED_AREAS,
    areaCoverage,
    retrieval,
    checks,
    failed,
  };
}

async function loadManifest(input: string): Promise<unknown> {
  const content = await readFile(input, 'utf8');
  return yaml.load(content);
}

async function loadFixtureCorpus(input: string): Promise<FixtureDocument[]> {
  const content = await readFile(input, 'utf8');
  const parsed = JSON.parse(content) as FixtureCorpus;
  if (!Array.isArray(parsed.documents)) return [];
  return parsed.documents.filter((doc): doc is FixtureDocument => {
    return (
      isRecord(doc) &&
      typeof doc.id === 'string' &&
      typeof doc.source_type === 'string' &&
      typeof doc.text === 'string'
    );
  });
}

function parseArgs(argv: string[]): {
  input: string;
  fixtureCorpus: string | null;
  out: string | null;
  json: boolean;
} {
  let input = DEFAULT_INPUT;
  let fixtureCorpus: string | null = DEFAULT_FIXTURE_CORPUS;
  let out: string | null = null;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      input = argv[index + 1] ?? input;
      index += 1;
    } else if (arg.startsWith('--input=')) {
      input = arg.slice('--input='.length);
    } else if (arg === '--fixture-corpus') {
      fixtureCorpus = argv[index + 1] ?? fixtureCorpus;
      index += 1;
    } else if (arg.startsWith('--fixture-corpus=')) {
      fixtureCorpus = arg.slice('--fixture-corpus='.length);
    } else if (arg === '--no-fixture-corpus') {
      fixtureCorpus = null;
    } else if (arg === '--out') {
      out = argv[index + 1] ?? out;
      index += 1;
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    } else if (arg === '--json') {
      json = true;
    }
  }

  return { input, fixtureCorpus, out, json };
}

function printHumanSummary(report: MemoryEvalReport): void {
  const status = report.failed === 0 ? 'PASS' : 'FAIL';
  console.log(`Memory eval manifest: ${status}`);
  console.log(`Input: ${report.input}`);
  console.log(`Queries: ${report.queryCount}`);
  if (report.retrieval) {
    console.log(
      `Fixture retrieval: scored=${report.retrieval.scoredQueryCount}, hitAtK=${report.retrieval.hitAtK}, mrr=${report.retrieval.mrr}`
    );
  }
  console.log(
    `Coverage: ${Object.entries(report.areaCoverage)
      .map(([area, count]) => `${area}=${count}`)
      .join(', ')}`
  );

  if (report.failed > 0) {
    console.log('Failures:');
    for (const check of report.checks.filter((item) => item.status === 'fail')) {
      console.log(`- ${check.name}: ${check.detail}`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(process.cwd(), args.input);
  const manifest = await loadManifest(input);
  const fixture = args.fixtureCorpus
    ? {
        path: args.fixtureCorpus,
        documents: await loadFixtureCorpus(path.resolve(process.cwd(), args.fixtureCorpus)),
      }
    : undefined;
  const report = evaluateGoldenManifest(manifest, args.input, fixture);

  if (args.out) {
    await writeFile(path.resolve(process.cwd(), args.out), `${JSON.stringify(report, null, 2)}\n`);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanSummary(report);
  }

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  void main();
}
