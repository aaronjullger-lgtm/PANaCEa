/**
 * Tests for aistack.md upgrades:
 * - Vercel AI SDK providers module
 * - RxNorm medical API service
 * - Hybrid search utilities
 * - Contextual retrieval preprocessing
 * - Langfuse observability
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── AI SDK Providers ──────────────────────────────────────────────────────

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({ modelId: 'gemini-2.0-flash' }))),
}));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'gpt-4o-mini' }))),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => ({ modelId: 'claude-3-5-haiku' }))),
}));

describe('AI SDK Providers', () => {
  it('exports model catalog with all providers', async () => {
    const { AI_MODELS } = await import('@/lib/ai-sdk/providers');
    expect(Object.keys(AI_MODELS).length).toBeGreaterThanOrEqual(7);
    expect(AI_MODELS['gemini-2.0-flash'].provider).toBe('google');
    expect(AI_MODELS['gpt-4o-mini'].provider).toBe('openai');
    expect(AI_MODELS['claude-haiku-3.5'].provider).toBe('anthropic');
  });

  it('createAIModel creates Google model with API key', async () => {
    const { createAIModel } = await import('@/lib/ai-sdk/providers');
    const model = createAIModel('gemini-2.0-flash', { GEMINI_API_KEY: 'test-key' });
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gemini-2.0-flash');
  });

  it('createAIModel throws without API key', async () => {
    const { createAIModel } = await import('@/lib/ai-sdk/providers');
    expect(() => createAIModel('gemini-2.0-flash', {})).toThrow('GEMINI_API_KEY required');
  });

  it('createAIModel throws for unknown model', async () => {
    const { createAIModel } = await import('@/lib/ai-sdk/providers');
    expect(() => createAIModel('nonexistent-model', { GEMINI_API_KEY: 'key' })).toThrow('Unknown model');
  });

  it('selectModelForTier prefers cheapest available', async () => {
    const { selectModelForTier } = await import('@/lib/ai-sdk/providers');
    const model = selectModelForTier('fast', { GEMINI_API_KEY: 'key' });
    expect(model).toBe('gemini-2.0-flash');
  });

  it('selectModelForTier throws with no keys', async () => {
    const { selectModelForTier } = await import('@/lib/ai-sdk/providers');
    expect(() => selectModelForTier('fast', {})).toThrow('No API key');
  });

  it('getAvailableProviders returns configured providers', async () => {
    const { getAvailableProviders } = await import('@/lib/ai-sdk/providers');
    expect(getAvailableProviders({ GEMINI_API_KEY: 'k' })).toEqual(['google']);
    expect(getAvailableProviders({ GEMINI_API_KEY: 'k', OPENAI_API_KEY: 'k' })).toEqual(['google', 'openai']);
    expect(getAvailableProviders({})).toEqual([]);
  });

  it('getFallbackChain returns primary + same-tier alternatives', async () => {
    const { getFallbackChain } = await import('@/lib/ai-sdk/providers');
    const chain = getFallbackChain('gemini-2.0-flash', {
      GEMINI_API_KEY: 'k',
      OPENAI_API_KEY: 'k',
    });
    expect(chain[0]).toBe('gemini-2.0-flash');
    expect(chain.length).toBeGreaterThan(1);
    expect(chain).toContain('gpt-4o-mini');
  });
});

// ─── RxNorm API ────────────────────────────────────────────────────────────

describe('RxNorm Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validateDrugName returns valid for exact match', async () => {
    const { validateDrugName } = await import('@/lib/services/medical-apis/rxnorm');

    // Mock fetch for RxNorm API
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ idGroup: { rxnormId: ['6918'] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          properties: { rxcui: '6918', name: 'metoprolol', tty: 'IN' },
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateDrugName('metoprolol');
    expect(result.isValid).toBe(true);
    expect(result.rxcui).toBe('6918');
    expect(result.normalizedName).toBe('metoprolol');
  });

  it('validateDrugName returns invalid with suggestions for misspelling', async () => {
    const { validateDrugName } = await import('@/lib/services/medical-apis/rxnorm');

    const mockFetch = vi.fn()
      // First call: getRxCUI returns no exact match
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ idGroup: {} }),
      })
      // Second call: approximate search
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          approximateGroup: {
            candidate: [{ rxcui: '6918', name: 'metoprolol' }],
          },
        }),
      })
      // Third call: properties lookup
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          properties: { rxcui: '6918', name: 'metoprolol', tty: 'IN' },
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateDrugName('metaprolol');
    expect(result.isValid).toBe(false);
    expect(result.suggestions).toContain('metoprolol');
  });

  it('checkInteractions requires at least 2 RxCUIs', async () => {
    const { checkInteractions } = await import('@/lib/services/medical-apis/rxnorm');
    const result = await checkInteractions(['6918']);
    expect(result.hasInteractions).toBe(false);
    expect(result.drugCount).toBe(1);
  });

  it('handles network errors gracefully', async () => {
    const { validateDrugName } = await import('@/lib/services/medical-apis/rxnorm');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await validateDrugName('aspirin');
    expect(result.isValid).toBe(false);
    expect(result.suggestions).toEqual([]);
  });
});

// ─── Query Classification ──────────────────────────────────────────────────

describe('Hybrid Search - Query Classification', () => {
  it('classifies short factual queries as simple', async () => {
    const { classifyQuery } = await import('@/lib/services/search/hybridSearch');
    expect(classifyQuery('metoprolol')).toBe('simple');
    expect(classifyQuery('half-life of warfarin')).toBe('simple');
    expect(classifyQuery('ICD-10 code for STEMI')).toBe('simple');
  });

  it('classifies reasoning queries as complex', async () => {
    const { classifyQuery } = await import('@/lib/services/search/hybridSearch');
    expect(classifyQuery('how to manage a diabetic patient with renal complications and contraindications to metformin')).toBe('complex');
    expect(classifyQuery('differential diagnosis for patient with chest pain presenting with shortness of breath and elevated troponin')).toBe('complex');
  });
});

// ─── Contextual Retrieval ──────────────────────────────────────────────────

describe('Contextual Retrieval', () => {
  it('buildContextPrompt includes source and section', async () => {
    const { buildContextPrompt } = await import('@/lib/services/search/contextualRetrieval');
    const prompt = buildContextPrompt({
      id: 'chunk-1',
      text: 'The treatment protocol involves daily subcutaneous injections.',
      sourceTitle: 'Type 2 Diabetes Management Guidelines',
      section: 'Insulin Therapy',
    });
    expect(prompt).toContain('Type 2 Diabetes');
    expect(prompt).toContain('Insulin Therapy');
    expect(prompt).toContain('subcutaneous injections');
  });

  it('contextualizeChunk prepends context to text', async () => {
    const { contextualizeChunk } = await import('@/lib/services/search/contextualRetrieval');
    const mockGenerate = vi.fn().mockResolvedValue(
      'This section from the DM2 guidelines describes the insulin therapy protocol.'
    );

    const result = await contextualizeChunk(
      {
        id: 'chunk-1',
        text: 'The treatment involves daily injections.',
        sourceTitle: 'DM2 Guidelines',
      },
      mockGenerate
    );

    expect(result.contextPrefix).toContain('insulin therapy');
    expect(result.contextualizedText).toContain('insulin therapy');
    expect(result.contextualizedText).toContain('daily injections');
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('batchContextualize handles failures gracefully', async () => {
    const { batchContextualize } = await import('@/lib/services/search/contextualRetrieval');
    const mockGenerate = vi.fn()
      .mockResolvedValueOnce('Context for chunk 1')
      .mockRejectedValueOnce(new Error('LLM failed'))
      .mockResolvedValueOnce('Context for chunk 3');

    const chunks = [
      { id: '1', text: 'Chunk one', sourceTitle: 'Doc' },
      { id: '2', text: 'Chunk two', sourceTitle: 'Doc' },
      { id: '3', text: 'Chunk three', sourceTitle: 'Doc' },
    ];

    const results = await batchContextualize(chunks, mockGenerate, { concurrency: 3 });
    expect(results).toHaveLength(3);
    // Failed chunk should have empty context but still be included
    expect(results[1].contextPrefix).toBe('');
    expect(results[1].contextualizedText).toBe('Chunk two');
  });

  it('splitIntoParentChild creates two-tier hierarchy', async () => {
    const { splitIntoParentChild } = await import('@/lib/services/search/contextualRetrieval');
    const longText = Array(20).fill(
      'This is a paragraph about clinical pharmacology and drug interactions. ' +
      'It contains important information about dosing and adverse effects. ' +
      'The mechanism of action involves receptor binding and enzyme inhibition.'
    ).join('\n\n');

    const result = splitIntoParentChild(longText, {
      parentMaxChars: 500,
      childMaxChars: 200,
    });

    expect(result.length).toBeGreaterThan(1);
    for (const parent of result) {
      expect(parent.parent.length).toBeGreaterThan(0);
      expect(parent.children.length).toBeGreaterThan(0);
      for (const child of parent.children) {
        expect(child.length).toBeLessThanOrEqual(500); // some tolerance
      }
    }
  });
});

// ─── Langfuse Observability ────────────────────────────────────────────────

const { MockLangfuse } = vi.hoisted(() => {
  // Use a real class so `new Langfuse(...)` works
  class MockLangfuse {
    trace = vi.fn(() => ({
      id: 'trace-123',
      generation: vi.fn(),
      span: vi.fn(),
    }));
    score = vi.fn();
    flushAsync = vi.fn().mockResolvedValue(undefined);
    shutdownAsync = vi.fn().mockResolvedValue(undefined);
  }
  return { MockLangfuse };
});

vi.mock('langfuse', () => ({
  Langfuse: MockLangfuse,
}));

describe('Langfuse Observability', () => {
  beforeEach(async () => {
    // Reset the singleton _client by calling shutdownLangfuse
    const mod = await import('@/lib/observability/langfuse');
    await mod.shutdownLangfuse();
  });

  it('isLangfuseEnabled returns false without keys', async () => {
    const { isLangfuseEnabled } = await import('@/lib/observability/langfuse');
    expect(isLangfuseEnabled({})).toBe(false);
  });

  it('isLangfuseEnabled returns true with keys', async () => {
    const { isLangfuseEnabled } = await import('@/lib/observability/langfuse');
    expect(isLangfuseEnabled({
      LANGFUSE_PUBLIC_KEY: 'pk-test',
      LANGFUSE_SECRET_KEY: 'sk-test',
    })).toBe(true);
  });

  it('createTrace returns null without keys', async () => {
    const { createTrace } = await import('@/lib/observability/langfuse');
    const trace = createTrace({}, { name: 'test' });
    expect(trace).toBeNull();
  });

  it('createTrace returns trace object with keys', async () => {
    const { createTrace } = await import('@/lib/observability/langfuse');
    const trace = createTrace(
      { LANGFUSE_PUBLIC_KEY: 'pk-test', LANGFUSE_SECRET_KEY: 'sk-test' },
      { name: '/api/ai/generate-mnemonic', userId: 'user-1', tags: ['test'] }
    );
    expect(trace).not.toBeNull();
    expect(trace!.traceId).toBe('trace-123');
    expect(typeof trace!.generation).toBe('function');
    expect(typeof trace!.span).toBe('function');
    expect(typeof trace!.score).toBe('function');
    expect(typeof trace!.flush).toBe('function');
  });
});

// ─── Corrective RAG ──────────────────────────────────────────────────────

describe('Corrective RAG Grader', () => {
  it('gradeDocument returns relevant for high keyword overlap', async () => {
    const { gradeDocument } = await import('@/lib/services/search/correctiveRag');
    const result = gradeDocument('metoprolol beta blocker hypertension', {
      id: 'doc-1',
      text: 'Metoprolol is a selective beta-1 blocker used for hypertension and heart failure.',
      score: 0.85,
      source: 'medical-content',
    });
    expect(result.relevant).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('gradeDocument returns irrelevant for unrelated content', async () => {
    const { gradeDocument } = await import('@/lib/services/search/correctiveRag');
    const result = gradeDocument('metoprolol beta blocker', {
      id: 'doc-2',
      text: 'Cooking recipes for Italian pasta with tomato sauce.',
      score: 0.2,
      source: 'random',
    });
    expect(result.relevant).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('gradeDocuments computes quality score', async () => {
    const { gradeDocuments } = await import('@/lib/services/search/correctiveRag');
    const result = await gradeDocuments('CHF management', [
      { id: '1', text: 'Heart failure management includes ACE inhibitors and beta blockers.', score: 0.9, source: 'mc' },
      { id: '2', text: 'Irrelevant content about cooking.', score: 0.1, source: 'mc' },
    ]);
    expect(result.qualityScore).toBeGreaterThan(0);
    expect(result.accepted.length).toBeGreaterThanOrEqual(1);
  });

  it('buildCRAGContext formats documents with source attribution', async () => {
    const { buildCRAGContext } = await import('@/lib/services/search/correctiveRag');
    const context = buildCRAGContext([
      { id: '1', text: 'ACE inhibitors reduce mortality in CHF.', score: 0.9, source: 'guidelines' },
    ]);
    expect(context).toContain('ACE inhibitors');
    expect(context).toContain('guidelines');
  });
});

// ─── OpenFDA Integration ─────────────────────────────────────────────────

describe('OpenFDA Integration', () => {
  it('searchOpenFDA returns empty for network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const { searchOpenFDA } = await import('@/lib/services/medical-apis/openfda');
    const results = await searchOpenFDA('nonexistentdrug');
    expect(results).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('searchAdverseEvents returns empty for 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));
    const { searchAdverseEvents } = await import('@/lib/services/medical-apis/openfda');
    const events = await searchAdverseEvents('nonexistentdrug');
    expect(events).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('lookupDrugLabel handles valid response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{
          openfda: {
            brand_name: ['Lopressor'],
            generic_name: ['metoprolol tartrate'],
            manufacturer_name: ['Novartis'],
            route: ['ORAL'],
            substance_name: ['METOPROLOL TARTRATE'],
          },
          indications_and_usage: ['Treatment of hypertension.'],
          contraindications: ['Sinus bradycardia.'],
          mechanism_of_action: ['Beta-1 selective blocker.'],
        }],
      }),
    }));
    const { lookupDrugLabel } = await import('@/lib/services/medical-apis/openfda');
    const result = await lookupDrugLabel('metoprolol');
    expect(result).not.toBeNull();
    expect(result!.brandName).toBe('Lopressor');
    expect(result!.genericName).toBe('metoprolol tartrate');
    expect(result!.indications).toContain('hypertension');
    expect(result!.mechanismOfAction).toContain('Beta-1');
    vi.unstubAllGlobals();
  });
});

// ─── Barrel Exports ──────────────────────────────────────────────────────

describe('Barrel Exports', () => {
  it('search barrel exports all modules', async () => {
    const search = await import('@/lib/services/search');
    expect(typeof search.hybridSearchRRF).toBe('function');
    expect(typeof search.classifyQuery).toBe('function');
    expect(typeof search.contextualizeChunk).toBe('function');
    expect(typeof search.batchContextualize).toBe('function');
    expect(typeof search.gradeDocument).toBe('function');
    expect(typeof search.gradeDocuments).toBe('function');
    expect(typeof search.buildCRAGContext).toBe('function');
  });

  it('ai-sdk barrel exports all modules', async () => {
    const aiSdk = await import('@/lib/ai-sdk');
    expect(typeof aiSdk.createAIModel).toBe('function');
    expect(typeof aiSdk.selectModelForTier).toBe('function');
    expect(typeof aiSdk.aiGenerateText).toBe('function');
    expect(typeof aiSdk.aiGenerateObject).toBe('function');
    expect(typeof aiSdk.aiStreamText).toBe('function');
  });
});
