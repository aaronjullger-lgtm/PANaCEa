import { describe, it, expect } from 'vitest';
import {
  tokenize,
  computeLexicalScore,
  computeClinicalScore,
  computeContentTypePriority,
  computeSystemAlignment,
  rerankFast,
  rerankPipeline,
  DEFAULT_WEIGHTS,
  CONTENT_TYPE_PRIORITY,
} from './rerankService';
// Define types locally to avoid loading ragContextService (heavy module chain)
type ContentType = 'pathophysiology' | 'treatment' | 'diagnostics' | 'clinical_pearls' | 'overview' | 'symptoms';
interface RAGChunk {
  sourceId: string;
  content: string;
  system: string;
  condition: string;
  contentType: ContentType;
  similarity: number;
}
interface RAGContext {
  chunks: RAGChunk[];
  totalTokensEstimate: number;
  retrievalScores: number[];
  isGrounded: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChunk(overrides: Partial<RAGChunk> = {}): RAGChunk {
  return {
    sourceId: 'src-1',
    content: 'The patient presents with chest pain and shortness of breath.',
    system: 'Cardiovascular',
    condition: 'Heart Failure',
    contentType: 'treatment',
    similarity: 0.75,
    ...overrides,
  };
}

function makeContext(chunks: RAGChunk[]): RAGContext {
  return {
    chunks,
    totalTokensEstimate: chunks.reduce((s, c) => s + Math.ceil(c.content.length * 0.25), 0),
    retrievalScores: chunks.map((c) => c.similarity),
    isGrounded: true,
  };
}

// ─── tokenize ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('lowercases all tokens', () => {
    const tokens = tokenize('HEART FAILURE');
    expect(tokens).toContain('heart');
    expect(tokens).toContain('failure');
  });

  it('removes punctuation', () => {
    const tokens = tokenize('chest pain; shortness-of-breath.');
    expect(tokens.every((t) => !/[.,;!?]/.test(t))).toBe(true);
  });

  it('filters tokens shorter than 3 characters', () => {
    const tokens = tokenize('go to the ER now and do PE exam');
    // "go" (2), "to" (2) filtered; but stopwords also removed
    expect(tokens.every((t) => t.length >= 3)).toBe(true);
  });

  it('removes stopwords', () => {
    const tokens = tokenize('the patient is in the hospital');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('is');
    expect(tokens).not.toContain('in');
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toHaveLength(0);
  });

  it('returns empty array for string with only stopwords', () => {
    expect(tokenize('the is are')).toHaveLength(0);
  });

  it('keeps meaningful clinical terms', () => {
    const tokens = tokenize('first-line treatment for hypertension');
    expect(tokens).toContain('treatment');
    expect(tokens).toContain('hypertension');
  });

  it('returns no duplicates is not guaranteed but does return all occurrences', () => {
    const tokens = tokenize('pain pain pain');
    expect(tokens.filter((t) => t === 'pain')).toHaveLength(3);
  });
});

// ─── computeLexicalScore ──────────────────────────────────────────────────────

describe('computeLexicalScore', () => {
  it('returns 0 for empty query terms', () => {
    const score = computeLexicalScore('some content here', [], new Set());
    expect(score).toBe(0);
  });

  it('returns 0 when no query terms appear in content', () => {
    const terms = tokenize('hypertension cardiovascular');
    const score = computeLexicalScore('infectious disease pneumonia antibiotic', terms, new Set(terms));
    expect(score).toBe(0);
  });

  it('returns > 0 when query terms appear in content', () => {
    const terms = ['hypertension'];
    const score = computeLexicalScore('hypertension is a common cardiovascular condition', terms, new Set(terms));
    expect(score).toBeGreaterThan(0);
  });

  it('score is between 0 and 1', () => {
    const terms = tokenize('heart failure treatment');
    const score = computeLexicalScore(
      'heart failure treatment with diuretics and ACE inhibitors',
      terms,
      new Set(terms)
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('down-weights common clinical terms relative to uncommon ones in multi-term query', () => {
    // Query has one common term ('treatment', IDF=0.3) and one uncommon term ('hypertension', IDF=1.0)
    // Content matches hypertension but NOT treatment → uncommon term drives score more
    const mixedTerms = ['treatment', 'hypertension'];
    const mixedSet = new Set(mixedTerms);

    const contentWithUncommon = 'hypertension managed with lisinopril and beta blockers';
    const contentWithCommon = 'treatment of pneumonia with antibiotics and supportive care';

    const scoreUncommonMatch = computeLexicalScore(contentWithUncommon, mixedTerms, mixedSet);
    const scoreCommonMatch = computeLexicalScore(contentWithCommon, mixedTerms, mixedSet);

    // Content matching the uncommon (high-IDF) term should score higher
    expect(scoreUncommonMatch).toBeGreaterThan(scoreCommonMatch);
  });

  it('higher score for more term matches', () => {
    const terms = ['heart', 'failure', 'treatment'];
    const contentAll = 'heart failure treatment with diuretics';
    const contentOne = 'diuretics for hypertension';

    const scoreAll = computeLexicalScore(contentAll, terms, new Set(terms));
    const scoreOne = computeLexicalScore(contentOne, terms, new Set(terms));

    expect(scoreAll).toBeGreaterThan(scoreOne);
  });
});

// ─── computeClinicalScore ────────────────────────────────────────────────────

describe('computeClinicalScore', () => {
  it('returns 0 for generic non-clinical text', () => {
    const score = computeClinicalScore('the weather is nice today');
    expect(score).toBe(0);
  });

  it('detects sensitivity/specificity pattern', () => {
    const score = computeClinicalScore('Sensitivity: 95% and specificity: 80% for this test');
    expect(score).toBeGreaterThan(0);
  });

  it('detects first-line treatment', () => {
    const score = computeClinicalScore('First-line treatment is lisinopril');
    expect(score).toBeGreaterThan(0);
  });

  it('detects dosage information', () => {
    const score = computeClinicalScore('Give 500 mg twice daily for 7 days');
    expect(score).toBeGreaterThan(0);
  });

  it('detects guideline references', () => {
    const score = computeClinicalScore('Per ACC/AHA guidelines, start statin therapy');
    expect(score).toBeGreaterThan(0);
  });

  it('detects pathognomonic/classic buzzwords', () => {
    const score = computeClinicalScore('This is pathognomonic for pulmonary embolism');
    expect(score).toBeGreaterThan(0);
  });

  it('returns higher score for content with multiple clinical features', () => {
    const rich = 'First-line treatment: lisinopril 10 mg daily per ACC guidelines. Sensitivity: 90%.';
    const sparse = 'First-line treatment: lisinopril.';
    expect(computeClinicalScore(rich)).toBeGreaterThan(computeClinicalScore(sparse));
  });

  it('caps score at 1.0', () => {
    // Pack many clinical features → would exceed 1.0 without cap
    const packed = [
      'Sensitivity: 90% and specificity: 80% for this test.',
      'Positive likelihood ratio LR+ = 9.',
      'First-line gold standard treatment: 500 mg.',
      'ACC/AHA guideline Grade A recommendation.',
      'Classic pathognomonic hallmark triad finding.',
      'Contraindicated in patients with renal failure.',
    ].join(' ');
    expect(computeClinicalScore(packed)).toBeLessThanOrEqual(1.0);
  });
});

// ─── computeContentTypePriority ──────────────────────────────────────────────

describe('computeContentTypePriority', () => {
  it('uses DEFAULT priority table when no preferences specified', () => {
    expect(computeContentTypePriority('pathophysiology')).toBe(CONTENT_TYPE_PRIORITY['pathophysiology']);
    expect(computeContentTypePriority('overview')).toBe(CONTENT_TYPE_PRIORITY['overview']);
  });

  it('returns 1.0 for first item in preference list', () => {
    const score = computeContentTypePriority('treatment', ['treatment', 'diagnostics']);
    expect(score).toBe(1.0);
  });

  it('returns lower score for second item in preference list', () => {
    const first = computeContentTypePriority('treatment', ['treatment', 'diagnostics', 'symptoms']);
    const second = computeContentTypePriority('diagnostics', ['treatment', 'diagnostics', 'symptoms']);
    expect(first).toBeGreaterThan(second);
  });

  it('returns 0.3 for content type not in preference list', () => {
    const score = computeContentTypePriority('overview', ['treatment', 'diagnostics']);
    expect(score).toBe(0.3);
  });

  it('higher priority types score higher in default table', () => {
    const pathScore = computeContentTypePriority('pathophysiology', undefined);
    const overviewScore = computeContentTypePriority('overview', undefined);
    expect(pathScore).toBeGreaterThan(overviewScore);
  });

  it('all content types in CONTENT_TYPE_PRIORITY table have scores 0-1', () => {
    for (const [, score] of Object.entries(CONTENT_TYPE_PRIORITY)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ─── computeSystemAlignment ──────────────────────────────────────────────────

describe('computeSystemAlignment', () => {
  it('returns 0.5 baseline when no targets specified', () => {
    expect(computeSystemAlignment('Cardiovascular', 'Heart Failure', 'some content')).toBe(0.5);
  });

  it('adds 0.3 when system matches target exactly', () => {
    const score = computeSystemAlignment('Cardiovascular', '', 'content', 'Cardiovascular');
    expect(score).toBeCloseTo(0.8, 5);
  });

  it('is case-insensitive for system matching', () => {
    const score = computeSystemAlignment('cardiovascular', '', 'content', 'CARDIOVASCULAR');
    expect(score).toBeCloseTo(0.8, 5);
  });

  it('adds 0.2 when condition matches exactly', () => {
    const score = computeSystemAlignment('', 'Heart Failure', 'content', undefined, 'Heart Failure');
    expect(score).toBeCloseTo(0.7, 5);
  });

  it('adds 0.1 when condition is mentioned in content but not exact match', () => {
    const score = computeSystemAlignment('', 'Other', 'heart failure management strategies', undefined, 'Heart Failure');
    expect(score).toBeCloseTo(0.6, 5);
  });

  it('caps score at 1.0', () => {
    const score = computeSystemAlignment('Cardio', 'Heart Failure', 'heart failure in cardio patients', 'Cardio', 'Heart Failure');
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('does not boost score when system does not match', () => {
    const noMatch = computeSystemAlignment('Pulmonary', '', 'content', 'Cardiovascular');
    const noTarget = computeSystemAlignment('Pulmonary', '', 'content');
    expect(noMatch).toBe(noTarget); // no boost
  });
});

// ─── rerankFast ───────────────────────────────────────────────────────────────

describe('rerankFast', () => {
  it('returns scored chunks sorted by rerankScore descending', () => {
    const chunks = [
      makeChunk({ content: 'generic overview', similarity: 0.5, contentType: 'overview' }),
      makeChunk({ content: 'first-line treatment: lisinopril 10mg per ACC guideline', similarity: 0.8, contentType: 'treatment' }),
    ];
    const result = rerankFast(makeContext(chunks), 'treatment for heart failure');
    // Clinical-rich chunk should rank higher
    expect(result.chunks[0]!.chunk.similarity).toBe(0.8);
  });

  it('returns all chunks when topK not specified', () => {
    const chunks = [makeChunk(), makeChunk(), makeChunk()];
    const result = rerankFast(makeContext(chunks), 'query');
    expect(result.chunks).toHaveLength(3);
  });

  it('respects topK option', () => {
    const chunks = [makeChunk(), makeChunk(), makeChunk()];
    const result = rerankFast(makeContext(chunks), 'query', { topK: 2 });
    expect(result.chunks).toHaveLength(2);
  });

  it('returns mode: fast', () => {
    const result = rerankFast(makeContext([makeChunk()]), 'query');
    expect(result.mode).toBe('fast');
  });

  it('durationMs is a non-negative number', () => {
    const result = rerankFast(makeContext([makeChunk()]), 'query');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('each scored chunk has rerankScore between 0 and 1', () => {
    const result = rerankFast(makeContext([makeChunk()]), 'test query');
    for (const sc of result.chunks) {
      expect(sc.rerankScore).toBeGreaterThanOrEqual(0);
      expect(sc.rerankScore).toBeLessThanOrEqual(1);
    }
  });

  it('context.isGrounded is true when avg score >= 0.40', () => {
    // high similarity chunk
    const result = rerankFast(makeContext([makeChunk({ similarity: 0.9 })]), 'treatment heart failure');
    expect(result.context.isGrounded).toBe(true);
  });

  it('scoreBreakdown has all expected keys', () => {
    const result = rerankFast(makeContext([makeChunk()]), 'query');
    const breakdown = result.chunks[0]!.scoreBreakdown;
    expect(breakdown).toHaveProperty('vectorComponent');
    expect(breakdown).toHaveProperty('lexicalComponent');
    expect(breakdown).toHaveProperty('clinicalComponent');
    expect(breakdown).toHaveProperty('contentTypePriority');
    expect(breakdown).toHaveProperty('systemAlignment');
  });
});

// ─── rerankPipeline ───────────────────────────────────────────────────────────

describe('rerankPipeline', () => {
  it('returns empty result for empty context', () => {
    const emptyCtx = makeContext([]);
    const result = rerankPipeline(emptyCtx, 'query');
    expect(result.chunks).toHaveLength(0);
    expect(result.context).toBe(emptyCtx);
    expect(result.durationMs).toBe(0);
  });

  it('delegates to rerankFast for non-empty context', () => {
    const ctx = makeContext([makeChunk()]);
    const result = rerankPipeline(ctx, 'query');
    expect(result.mode).toBe('fast');
    expect(result.chunks).toHaveLength(1);
  });
});

// ─── DEFAULT_WEIGHTS sanity ───────────────────────────────────────────────────

describe('DEFAULT_WEIGHTS', () => {
  it('all weights sum to 1.0', () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('all weights are between 0 and 1', () => {
    for (const [, v] of Object.entries(DEFAULT_WEIGHTS)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
