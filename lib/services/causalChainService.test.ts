/**
 * Unit tests for lib/services/causalChainService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   buildCausalChainPrompt(request): string
 *   validateCausalChain(raw, request, modelVersion?): CausalChain | null
 *   extractJSON(raw): unknown
 *   getChainSummary(chain): string
 *
 * Note: getCachedChain / cacheChain use module-level Map state but are
 * simple enough to test as "pure-enough" (deterministic given input).
 */

import { describe, it, expect } from 'vitest';
import {
  buildCausalChainPrompt,
  validateCausalChain,
  extractJSON,
  getChainSummary,
  getCachedChain,
  cacheChain,
} from './causalChainService';
import type {
  CausalChainGenerationRequest,
  CausalChain,
} from '@/types/causalChain';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<CausalChainGenerationRequest> = {}): CausalChainGenerationRequest {
  return {
    questionId: 'q-001',
    questionText: 'Which mechanism explains mitral regurgitation in rheumatic heart disease?',
    correctAnswer: 'Molecular mimicry causing valve fibrosis',
    condition: 'Rheumatic Heart Disease',
    system: 'Cardiology',
    ...overrides,
  };
}

function makeValidRawChain(linkCount = 4) {
  return {
    links: Array.from({ length: linkCount }, (_, i) => ({
      order: i,
      entity: `Entity ${i}`,
      mechanism: `Mechanism ${i}`,
      consequence: `Consequence ${i}`,
      linkType: 'causes',
    })),
    branchPoints: [
      {
        afterLink: 0,
        condition: 'If bacteria directly infect the valve',
        differentialDiagnosis: 'Infective Endocarditis',
        alternativePath: [
          {
            order: 0,
            entity: 'Bacteremia',
            mechanism: 'Organisms adhere to valve',
            consequence: 'Vegetation formation',
            linkType: 'causes',
          },
        ],
      },
    ],
    clinicalCorrelation: 'This explains the mitral regurgitation murmur.',
  };
}

function makeChain(questionId = 'q-001'): CausalChain {
  return {
    id: `cc_${questionId}_0`,
    questionId,
    links: [
      { order: 0, entity: 'Group A Strep', mechanism: 'Molecular mimicry', consequence: 'Inflammation', linkType: 'causes' },
      { order: 1, entity: 'Inflammation', mechanism: 'Fibrosis', consequence: 'Valve damage', linkType: 'leads_to' },
      { order: 2, entity: 'Valve damage', mechanism: 'Incomplete closure', consequence: 'Murmur', linkType: 'results_in' },
    ],
    branchPoints: [],
    clinicalCorrelation: 'Explains the patient\'s new murmur.',
    condition: 'Rheumatic Heart Disease',
    generatedAt: new Date().toISOString(),
    geminiModelVersion: 'gemini-2.5-flash',
    reviewStatus: 'auto',
  };
}

// ─── buildCausalChainPrompt ───────────────────────────────────────────────────

describe('buildCausalChainPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildCausalChainPrompt(makeRequest());
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(200);
  });

  it('includes the question text', () => {
    const prompt = buildCausalChainPrompt(makeRequest());
    expect(prompt).toContain('Which mechanism explains mitral regurgitation');
  });

  it('includes the correct answer', () => {
    const prompt = buildCausalChainPrompt(makeRequest());
    expect(prompt).toContain('Molecular mimicry causing valve fibrosis');
  });

  it('includes the condition name', () => {
    const prompt = buildCausalChainPrompt(makeRequest());
    expect(prompt).toContain('Rheumatic Heart Disease');
  });

  it('includes the organ system when provided', () => {
    const prompt = buildCausalChainPrompt(makeRequest({ system: 'Pulmonology' }));
    expect(prompt).toContain('Pulmonology');
  });

  it('includes student answer in the prompt when provided', () => {
    const prompt = buildCausalChainPrompt(
      makeRequest({ studentAnswer: 'Direct bacterial invasion' })
    );
    expect(prompt).toContain('Direct bacterial invasion');
  });

  it('uses generic branch instruction when no student answer provided', () => {
    const prompt = buildCausalChainPrompt(makeRequest());
    expect(prompt).toContain('commonly confused differential');
  });

  it('requests JSON output (contains json schema)', () => {
    const prompt = buildCausalChainPrompt(makeRequest());
    expect(prompt.toLowerCase()).toContain('json');
  });
});

// ─── extractJSON ──────────────────────────────────────────────────────────────

describe('extractJSON', () => {
  it('parses plain JSON object', () => {
    const result = extractJSON('{"key": "value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('extracts from ```json ``` fences', () => {
    const fenced = '```json\n{"key": "value"}\n```';
    expect(extractJSON(fenced)).toEqual({ key: 'value' });
  });

  it('extracts from ``` ``` fences (no "json" label)', () => {
    const fenced = '```\n{"key": "value"}\n```';
    expect(extractJSON(fenced)).toEqual({ key: 'value' });
  });

  it('extracts JSON embedded in prose text', () => {
    const prose = 'Here is the result: {"key": "value"} as you can see.';
    expect(extractJSON(prose)).toEqual({ key: 'value' });
  });

  it('handles nested JSON objects', () => {
    const json = '{"links": [{"order": 0, "entity": "A"}], "count": 1}';
    const result = extractJSON(json) as Record<string, unknown>;
    expect(result.count).toBe(1);
    expect(Array.isArray(result.links)).toBe(true);
  });

  it('throws on completely invalid input (no parseable JSON)', () => {
    expect(() => extractJSON('completely invalid no braces')).toThrow();
  });

  it('handles JSON with escaped strings', () => {
    const json = '{"text": "He said \\"hello\\""}';
    const result = extractJSON(json) as Record<string, unknown>;
    expect(result.text).toBe('He said "hello"');
  });

  it('handles arrays', () => {
    // Strategy 2 looks for { first; an array won't match. Strategy 3 will try the whole string.
    const arr = '[1, 2, 3]';
    // Strategy 3 parses the whole trimmed string
    const result = extractJSON(arr);
    expect(result).toEqual([1, 2, 3]);
  });
});

// ─── validateCausalChain ──────────────────────────────────────────────────────

describe('validateCausalChain', () => {
  it('returns null for null input', () => {
    expect(validateCausalChain(null, makeRequest())).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(validateCausalChain('string', makeRequest())).toBeNull();
    expect(validateCausalChain(42, makeRequest())).toBeNull();
  });

  it('returns null when links array is missing', () => {
    expect(validateCausalChain({}, makeRequest())).toBeNull();
  });

  it('returns null when links array is too short (< 3)', () => {
    const raw = { links: [makeValidRawChain(1).links[0]], branchPoints: [], clinicalCorrelation: 'Test' };
    expect(validateCausalChain(raw, makeRequest())).toBeNull();
  });

  it('returns a valid CausalChain for well-formed input', () => {
    const raw = makeValidRawChain(4);
    const chain = validateCausalChain(raw, makeRequest());
    expect(chain).not.toBeNull();
    expect(chain!.questionId).toBe('q-001');
    expect(chain!.links.length).toBe(4);
  });

  it('caps links at 6 (MAX_CHAIN_LINKS)', () => {
    const raw = makeValidRawChain(8); // more than max
    const chain = validateCausalChain(raw, makeRequest());
    expect(chain).not.toBeNull();
    expect(chain!.links.length).toBeLessThanOrEqual(6);
  });

  it('re-indexes links after filtering', () => {
    const raw = makeValidRawChain(3);
    const chain = validateCausalChain(raw, makeRequest());
    expect(chain).not.toBeNull();
    chain!.links.forEach((link, i) => {
      expect(link.order).toBe(i);
    });
  });

  it('filters out links with invalid linkType', () => {
    const raw = {
      links: [
        { order: 0, entity: 'E0', mechanism: 'M0', consequence: 'C0', linkType: 'causes' },
        { order: 1, entity: 'E1', mechanism: 'M1', consequence: 'C1', linkType: 'INVALID_TYPE' },
        { order: 2, entity: 'E2', mechanism: 'M2', consequence: 'C2', linkType: 'leads_to' },
      ],
      branchPoints: [],
      clinicalCorrelation: 'Test',
    };
    const chain = validateCausalChain(raw, makeRequest());
    // 2 valid links < MIN_CHAIN_LINKS (3) → null
    expect(chain).toBeNull();
  });

  it('includes validated branch points', () => {
    const raw = makeValidRawChain(4);
    const chain = validateCausalChain(raw, makeRequest());
    expect(chain).not.toBeNull();
    expect(chain!.branchPoints.length).toBe(1);
  });

  it('uses fallback clinicalCorrelation when not provided', () => {
    const raw = { ...makeValidRawChain(3), clinicalCorrelation: undefined };
    const chain = validateCausalChain(raw, makeRequest());
    expect(chain).not.toBeNull();
    expect(chain!.clinicalCorrelation).toContain('Rheumatic Heart Disease');
  });

  it('returns null when no valid links remain after filtering', () => {
    const raw = {
      links: [
        { order: 0, entity: 'E0', mechanism: 'M0', consequence: 'C0', linkType: 'BAD' },
        { order: 1, entity: '', mechanism: 'M1', consequence: 'C1', linkType: 'causes' }, // empty entity
      ],
      branchPoints: [],
      clinicalCorrelation: 'Test',
    };
    expect(validateCausalChain(raw, makeRequest())).toBeNull();
  });
});

// ─── getChainSummary ──────────────────────────────────────────────────────────

describe('getChainSummary', () => {
  it('returns a string joining entities with arrows', () => {
    const chain = makeChain();
    const summary = getChainSummary(chain);
    expect(summary).toContain('Group A Strep');
    expect(summary).toContain('→');
  });

  it('ends with the last link\'s consequence', () => {
    const chain = makeChain();
    const summary = getChainSummary(chain);
    expect(summary).toContain('Murmur');
  });

  it('returns clinicalCorrelation for chain with no links', () => {
    const chain = { ...makeChain(), links: [] };
    const summary = getChainSummary(chain);
    expect(summary).toContain('murmur');
  });

  it('includes all entities in order', () => {
    const chain = makeChain();
    const summary = getChainSummary(chain);
    const parts = summary.split(' → ');
    expect(parts[0]).toBe('Group A Strep');
    expect(parts[1]).toBe('Inflammation');
    expect(parts[2]).toBe('Valve damage');
    expect(parts[3]).toBe('Murmur');
  });
});

// ─── getCachedChain / cacheChain ─────────────────────────────────────────────

describe('getCachedChain / cacheChain', () => {
  it('returns null for a question never cached', () => {
    expect(getCachedChain('non-existent-question-id-xyz')).toBeNull();
  });

  it('returns the chain after caching', () => {
    const chain = makeChain('q-cache-test-001');
    cacheChain(chain);
    const cached = getCachedChain('q-cache-test-001');
    expect(cached).not.toBeNull();
    expect(cached!.questionId).toBe('q-cache-test-001');
  });

  it('returns the correct chain for the given questionId', () => {
    const chainA = makeChain('q-cache-a');
    const chainB = makeChain('q-cache-b');
    cacheChain(chainA);
    cacheChain(chainB);
    expect(getCachedChain('q-cache-a')?.questionId).toBe('q-cache-a');
    expect(getCachedChain('q-cache-b')?.questionId).toBe('q-cache-b');
  });
});
