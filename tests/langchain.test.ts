/**
 * LangChain Integration Tests
 *
 * Tests the pure logic in lib/langchain/: config validation,
 * model chain resolution, env adapters, and JSON parsing.
 * LLM provider calls are fully mocked.
 *
 * Sprint: LangChain Integration — Sprint 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Top-level mocks (hoisted) ───────────────────────────────────────────

const { mockInvoke, MockChatGoogleGenerativeAI, MockChatOpenAI, MockChatAnthropic } = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  const MockChatGoogleGenerativeAI = vi.fn();
  const MockChatOpenAI = vi.fn();
  const MockChatAnthropic = vi.fn();
  return { mockInvoke, MockChatGoogleGenerativeAI, MockChatOpenAI, MockChatAnthropic };
});

vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: MockChatGoogleGenerativeAI,
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: MockChatOpenAI,
}));

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: MockChatAnthropic,
}));

vi.mock('@langchain/core/prompts', () => {
  // Real implementation for ChatPromptTemplate — needed for LCEL chain tests
  return vi.importActual('@langchain/core/prompts');
});

vi.mock('@langchain/core/tracers/tracer_langchain', () => ({
  LangChainTracer: vi.fn().mockImplementation(() => ({
    name: 'mock_tracer',
    projectName: 'panacea',
    client: {},
    usesRunTreeMap: false,
  })),
}));

function setupDefaultMocks() {
  mockInvoke.mockResolvedValue({
    content: '{"test": true}',
    response_metadata: {
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    },
  });

  // Must use function() not arrow so `new` works
  const makeImpl = function(this: any) {
    this.invoke = (...args: unknown[]) => mockInvoke(...args);
  };
  MockChatGoogleGenerativeAI.mockImplementation(makeImpl);
  MockChatOpenAI.mockImplementation(makeImpl);
  MockChatAnthropic.mockImplementation(makeImpl);
}

beforeEach(() => {
  setupDefaultMocks();
});

// ─── Config Tests ─────────────────────────────────────────────────────────

describe('LangChain Config', () => {
  it('MODEL_REGISTRY contains all expected providers', async () => {
    const { MODEL_REGISTRY } = await import('../lib/langchain/config');
    const providers = new Set(Object.values(MODEL_REGISTRY).map((m) => m.provider));
    expect(providers).toContain('gemini');
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('deepseek');
    expect(providers).toContain('openrouter');
  });

  it('TASK_MODEL_MAP has entries for core PANaCEa tasks', async () => {
    const { TASK_MODEL_MAP } = await import('../lib/langchain/config');
    expect(TASK_MODEL_MAP['question-generation']).toBeDefined();
    expect(TASK_MODEL_MAP['question-critique']).toBeDefined();
    expect(TASK_MODEL_MAP['content-generation']).toBeDefined();
    expect(TASK_MODEL_MAP['osce-chat']).toBeDefined();
    expect(TASK_MODEL_MAP['clinical-reasoning']).toBeDefined();
    expect(TASK_MODEL_MAP['extraction']).toBeDefined();
    expect(TASK_MODEL_MAP['socratic-tutoring']).toBeDefined();
    expect(TASK_MODEL_MAP['bulk-enrichment']).toBeDefined();
  });

  it('clinical-critical tasks route to Claude Sonnet as primary', async () => {
    const { TASK_MODEL_MAP } = await import('../lib/langchain/config');
    expect(TASK_MODEL_MAP['question-generation'].primary).toBe('claude-sonnet-5');
    expect(TASK_MODEL_MAP['question-critique'].primary).toBe('claude-sonnet-5');
    expect(TASK_MODEL_MAP['clinical-reasoning'].primary).toBe('claude-sonnet-5');
    expect(TASK_MODEL_MAP['osce-chat'].primary).toBe('claude-sonnet-5');
  });

  it('cost-sensitive tasks route to cheaper models', async () => {
    const { TASK_MODEL_MAP, MODEL_REGISTRY } = await import('../lib/langchain/config');
    const contentCost = MODEL_REGISTRY[TASK_MODEL_MAP['content-generation'].primary].inputCostPer1M;
    const extractionCost = MODEL_REGISTRY[TASK_MODEL_MAP['extraction'].primary].inputCostPer1M;
    expect(contentCost).toBeLessThan(1.0);
    expect(extractionCost).toBeLessThan(0.5);
  });

  it('bulk-enrichment routes to cheapest capable model', async () => {
    const { TASK_MODEL_MAP } = await import('../lib/langchain/config');
    expect(TASK_MODEL_MAP['bulk-enrichment'].primary).toBe('deepseek-v4-pro');
  });

  it('DeepInfra models are in the registry', async () => {
    const { MODEL_REGISTRY } = await import('../lib/langchain/config');
    expect(MODEL_REGISTRY['qwen3-235b']).toBeDefined();
    expect(MODEL_REGISTRY['qwen3-235b'].provider).toBe('deepinfra');
    expect(MODEL_REGISTRY['qwen-2.5-72b']).toBeDefined();
    expect(MODEL_REGISTRY['qwen-2.5-72b'].provider).toBe('deepinfra');
  });

  it('every task mapping has a primary and fallbacks array', async () => {
    const { TASK_MODEL_MAP, MODEL_REGISTRY } = await import('../lib/langchain/config');
    const validModels = Object.keys(MODEL_REGISTRY);

    for (const [task, mapping] of Object.entries(TASK_MODEL_MAP)) {
      expect(mapping.primary, `${task} missing primary`).toBeDefined();
      expect(validModels, `${task} primary not in registry`).toContain(mapping.primary);
      expect(Array.isArray(mapping.fallbacks), `${task} fallbacks not array`).toBe(true);
      for (const fb of mapping.fallbacks) {
        expect(validModels, `${task} fallback ${fb} not in registry`).toContain(fb);
      }
    }
  });

  it('all models have cost information', async () => {
    const { MODEL_REGISTRY } = await import('../lib/langchain/config');
    for (const [name, config] of Object.entries(MODEL_REGISTRY)) {
      expect(config.inputCostPer1M, `${name} missing inputCostPer1M`).toBeGreaterThanOrEqual(0);
      expect(config.outputCostPer1M, `${name} missing outputCostPer1M`).toBeGreaterThanOrEqual(0);
    }
  });

  it('getTracingConfig returns enabled when LANGSMITH_API_KEY is set', async () => {
    const { getTracingConfig } = await import('../lib/langchain/config');
    const config = getTracingConfig({ LANGSMITH_API_KEY: 'test-key' });
    expect(config.enabled).toBe(true);
    expect(config.projectName).toBe('panacea');
  });

  it('getTracingConfig returns disabled when no key', async () => {
    const { getTracingConfig } = await import('../lib/langchain/config');
    const config = getTracingConfig({});
    expect(config.enabled).toBe(false);
  });
});

// ─── Model Factory Tests ──────────────────────────────────────────────────

describe('LangChain Models', () => {
  it('getAvailableProviders returns providers with keys', async () => {
    const { getAvailableProviders } = await import('../lib/langchain/models');
    const providers = getAvailableProviders({
      GEMINI_API_KEY: 'gk',
      OPENAI_API_KEY: 'ok',
    });
    expect(providers).toContain('gemini');
    expect(providers).toContain('openai');
    expect(providers).not.toContain('anthropic');
    expect(providers).not.toContain('deepseek');
    expect(providers).not.toContain('openrouter');
  });

  it('getAvailableProviders returns empty when no keys', async () => {
    const { getAvailableProviders } = await import('../lib/langchain/models');
    expect(getAvailableProviders({})).toEqual([]);
  });

  it('getAvailableProviders includes deepinfra when key present', async () => {
    const { getAvailableProviders } = await import('../lib/langchain/models');
    const providers = getAvailableProviders({ DEEPINFRA_API_KEY: 'dk' });
    expect(providers).toContain('deepinfra');
  });

  it('getAvailableProviders includes openrouter when key present', async () => {
    const { getAvailableProviders } = await import('../lib/langchain/models');
    const providers = getAvailableProviders({ OPENROUTER_API_KEY: 'ork' });
    expect(providers).toContain('openrouter');
    expect(providers).toHaveLength(1);
  });

  it('isModelAvailable checks provider key', async () => {
    const { isModelAvailable } = await import('../lib/langchain/models');
    expect(isModelAvailable('gemini-2.0-flash', { GEMINI_API_KEY: 'k' })).toBe(true);
    expect(isModelAvailable('gemini-2.0-flash', {})).toBe(false);
    expect(isModelAvailable('gpt-4o-mini', { OPENAI_API_KEY: 'k' })).toBe(true);
    expect(isModelAvailable('gpt-4o-mini', { GEMINI_API_KEY: 'k' })).toBe(false);
  });

  it('createModel throws for unknown model name', async () => {
    const { createModel } = await import('../lib/langchain/models');
    expect(() =>
      createModel('nonexistent-model' as any, { GEMINI_API_KEY: 'k' })
    ).toThrow('Unknown model');
  });

  it('createModel throws when API key missing', async () => {
    const { createModel } = await import('../lib/langchain/models');
    expect(() =>
      createModel('gemini-2.0-flash', {})
    ).toThrow('GEMINI_API_KEY not configured');
  });

  it('createModel throws when OpenRouter key missing', async () => {
    const { createModel } = await import('../lib/langchain/models');
    expect(() =>
      createModel('openrouter-free', {})
    ).toThrow('OPENROUTER_API_KEY not configured');
  });

  it('createModel succeeds for OpenRouter with key', async () => {
    const { createModel } = await import('../lib/langchain/models');
    const model = createModel('openrouter-free', { OPENROUTER_API_KEY: 'ork' });
    expect(model).toBeDefined();
    expect(MockChatOpenAI).toHaveBeenCalled();
  });
});

// ─── Environment Adapter Tests ────────────────────────────────────────────

describe('LangChain Env Adapter', () => {
  it('fromCloudflareEnv extracts all AI keys', async () => {
    const { fromCloudflareEnv } = await import('../lib/langchain/envAdapter');
    const env = fromCloudflareEnv({
      GEMINI_API_KEY: 'gem',
      OPENAI_API_KEY: 'oai',
      ANTHROPIC_API_KEY: 'ant',
      DEEPSEEK_API_KEY: 'ds',
      OPENROUTER_API_KEY: 'or',
      LANGSMITH_API_KEY: 'ls',
      LANGSMITH_PROJECT: 'proj',
      DATABASE_URL: 'postgres://...',
      CLERK_SECRET_KEY: 'secret',
    });

    expect(env.GEMINI_API_KEY).toBe('gem');
    expect(env.OPENAI_API_KEY).toBe('oai');
    expect(env.ANTHROPIC_API_KEY).toBe('ant');
    expect(env.DEEPSEEK_API_KEY).toBe('ds');
    expect(env.OPENROUTER_API_KEY).toBe('or');
    expect(env.LANGSMITH_API_KEY).toBe('ls');
    expect(env.LANGSMITH_PROJECT).toBe('proj');
  });

  it('fromCloudflareEnv treats empty strings as undefined', async () => {
    const { fromCloudflareEnv } = await import('../lib/langchain/envAdapter');
    const env = fromCloudflareEnv({
      GEMINI_API_KEY: '',
      OPENAI_API_KEY: undefined,
    });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('fromExplicitKeys creates env from partial input', async () => {
    const { fromExplicitKeys } = await import('../lib/langchain/envAdapter');
    const env = fromExplicitKeys({ GEMINI_API_KEY: 'test' });
    expect(env.GEMINI_API_KEY).toBe('test');
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });
});

// ─── Tracing Tests ────────────────────────────────────────────────────────

describe('LangChain Tracing', () => {
  it('buildTracingConfig returns default config without key', async () => {
    const { buildTracingConfig } = await import('../lib/langchain/tracing');
    const config = buildTracingConfig({});
    expect(config.callbacks).toEqual([]);
    expect(config.metadata).toMatchObject({ app: 'panacea' });
    expect(config.runName).toBeUndefined();
  });

  it('buildTracingConfig includes metadata when key is set', async () => {
    const { buildTracingConfig } = await import('../lib/langchain/tracing');
    const config = buildTracingConfig(
      { LANGSMITH_API_KEY: 'k' },
      { runName: 'test', tags: ['a'], metadata: { foo: 'bar' } }
    );
    expect(config.runName).toBe('test');
    expect(config.tags).toEqual(['panacea', 'a']);
    expect((config.metadata as any).app).toBe('panacea');
    expect((config.metadata as any).foo).toBe('bar');
  });

  it('isTracingEnabled reflects API key presence', async () => {
    const { isTracingEnabled } = await import('../lib/langchain/tracing');
    expect(isTracingEnabled({})).toBe(false);
    expect(isTracingEnabled({ LANGSMITH_API_KEY: 'k' })).toBe(true);
  });
});

// ─── Router Tests ─────────────────────────────────────────────────────────

describe('LangChain Router', () => {
  it('routeTask succeeds with Gemini key', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask('question-generation', { GEMINI_API_KEY: 'k' }, {
      userPrompt: 'test prompt',
    });

    expect(result.output).toBe('{"test": true}');
    expect(result.model).toBe('gemini-2.5-pro');
    expect(result.provider).toBe('gemini');
    expect(result.attempts).toBe(1);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('routeTask falls back when primary provider fails', async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error('Gemini rate limit'))
      .mockRejectedValueOnce(new Error('Gemini still failing'))
      .mockResolvedValueOnce({
        content: 'fallback response',
        response_metadata: {},
      });

    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask(
      'question-generation',
      { GEMINI_API_KEY: 'gk', OPENAI_API_KEY: 'ok' },
      { userPrompt: 'test' },
      { maxAttempts: 10 }
    );

    expect(result.output).toBe('fallback response');
    expect(result.model).toBe('gemini-2.5-pro');
    expect(result.provider).toBe('gemini');
    expect(result.attempts).toBe(3);
  });

  it('routeTask throws when all providers fail', async () => {
    mockInvoke.mockRejectedValue(new Error('all dead'));

    const { routeTask } = await import('../lib/langchain/router');
    await expect(
      routeTask('question-generation', { GEMINI_API_KEY: 'k' }, { userPrompt: 'test' })
    ).rejects.toThrow('All models failed');
  });

  it('routeTask throws when no API keys are available', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    await expect(
      routeTask('question-generation', {}, { userPrompt: 'test' })
    ).rejects.toThrow('No available models');
  });

  it('routeTask respects forceModel option', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask(
      'question-generation',
      { OPENAI_API_KEY: 'k' },
      { userPrompt: 'test' },
      { forceModel: 'gpt-4o-mini' }
    );

    expect(result.model).toBe('gpt-4o-mini');
    expect(result.provider).toBe('openai');
  });

  it('routeTask throws when forceModel key is missing', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    await expect(
      routeTask(
        'question-generation',
        { GEMINI_API_KEY: 'k' },
        { userPrompt: 'test' },
        { forceModel: 'gpt-4o-mini' }
      )
    ).rejects.toThrow('not available');
  });

  it('routeStructured parses and validates JSON output', async () => {
    const { z } = await import('zod');
    const { routeStructured } = await import('../lib/langchain/router');

    mockInvoke.mockResolvedValue({
      content: '{"name": "test", "value": 42}',
      response_metadata: {},
    });

    const schema = z.object({ name: z.string(), value: z.number() });
    const result = await routeStructured(
      'extraction',
      { OPENAI_API_KEY: 'k' },
      { userPrompt: 'extract data' },
      schema
    );

    expect(result.output).toEqual({ name: 'test', value: 42 });
  });

  it('routeStructured throws on invalid JSON', async () => {
    const { z } = await import('zod');
    const { routeStructured } = await import('../lib/langchain/router');

    mockInvoke.mockResolvedValue({
      content: 'not json at all',
      response_metadata: {},
    });

    const schema = z.object({ name: z.string() });
    await expect(
      routeStructured(
        'extraction',
        { OPENAI_API_KEY: 'k' },
        { userPrompt: 'test' },
        schema
      )
    ).rejects.toThrow();
  });

  it('routeTask extracts usage metadata', async () => {
    mockInvoke.mockResolvedValue({
      content: 'ok',
      response_metadata: {
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      },
    });

    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask(
      'extraction',
      { OPENAI_API_KEY: 'k' },
      { userPrompt: 'test' }
    );

    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
  });

  it('routeTask handles unknown task by trying all models in cost order', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask(
      'unknown-task-type',
      { GEMINI_API_KEY: 'gk', OPENAI_API_KEY: 'ok' },
      { userPrompt: 'test' }
    );

    expect(result.output).toBe('{"test": true}');
    expect(result.attempts).toBe(1);
  });
});

// ─── Question Generation Chain Tests ──────────────────────────────────────

describe('LangChain Question Generation Chain', () => {
  it('generateQuestions returns parsed question array', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify([{
        type: 'vignette',
        question: 'A 65-year-old male presents with...',
        options: ['A. CHF', 'B. COPD', 'C. PE', 'D. Pneumonia'],
        correctAnswer: 'A. CHF',
        explanation: { rationale: 'Test rationale' },
        difficulty: 0.5,
      }]),
      response_metadata: {},
    });

    const { generateQuestions } = await import('../lib/langchain/chains/questionGeneration');

    const result = await generateQuestions(
      { GEMINI_API_KEY: 'k' },
      {
        conditionName: 'CHF',
        system: 'Cardiovascular',
        count: 1,
        questionType: 'vignette',
        formattedContext: 'Test clinical context about CHF...',
      }
    );

    expect(result.questions).toHaveLength(1);
    expect((result.questions[0] as any).type).toBe('vignette');
    expect(result.model).toBe('gemini-2.5-pro');
  });

  it('critiqueQuestion routes to question-critique task', async () => {
    mockInvoke.mockResolvedValue({
      content: '{"overallScore": 0.9, "issues": []}',
      response_metadata: {},
    });

    const { critiqueQuestion } = await import('../lib/langchain/chains/questionGeneration');
    const result = await critiqueQuestion(
      { GEMINI_API_KEY: 'k' },
      'Critique this question: ...'
    );

    expect(result.output).toContain('overallScore');
  });
});

// ─── Content Generation Chain Tests ─────────────────────────────────────

describe('LangChain Content Generation Chains', () => {
  it('generateConditionContentLC returns validated condition content', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        overview: 'CHF is a syndrome...',
        symptoms: ['Dyspnea', 'Edema'],
        riskFactors: ['HTN', 'CAD'],
        diagnosis: 'Echo is gold standard',
        treatment: 'ACE inhibitors, diuretics',
        clinicalPearls: ['S3 gallop is classic'],
      }),
      response_metadata: {},
    });

    const { generateConditionContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generateConditionContentLC(
      { GEMINI_API_KEY: 'k' },
      { conditionName: 'CHF', system: 'Cardiovascular' }
    );

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect((result.content as any).overview).toBe('CHF is a syndrome...');
    expect((result.content as any).symptoms).toHaveLength(2);
    expect(result.modelUsed).toBe('gemini-2.0-flash');
  });

  it('generateConditionContentLC returns error on invalid JSON', async () => {
    mockInvoke.mockResolvedValue({
      content: 'not valid json at all',
      response_metadata: {},
    });

    const { generateConditionContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generateConditionContentLC(
      { GEMINI_API_KEY: 'k' },
      { conditionName: 'CHF', system: 'Cardiovascular' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('parse');
  });

  it('generateConditionContentLC returns error on schema validation failure', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ wrongField: 'missing required fields' }),
      response_metadata: {},
    });

    const { generateConditionContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generateConditionContentLC(
      { GEMINI_API_KEY: 'k' },
      { conditionName: 'CHF', system: 'Cardiovascular' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('validation failed');
  });

  it('generateLabContentLC returns validated lab content', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        description: 'Measures serum troponin',
        typicalNormalRange: '< 0.04 ng/mL',
        commonAbnormalities: ['Elevated in MI'],
        indications: ['Chest pain evaluation'],
      }),
      response_metadata: {},
    });

    const { generateLabContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generateLabContentLC({ GEMINI_API_KEY: 'k' }, 'Troponin');

    expect(result.success).toBe(true);
    expect((result.content as any).description).toContain('troponin');
    expect((result.content as any).commonAbnormalities).toHaveLength(1);
  });

  it('generateImagingContentLC returns validated imaging content', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        description: 'Chest X-ray visualization',
        bestFor: ['Pneumonia evaluation'],
        limitations: ['Cannot detect PE'],
        radiationRisk: true,
      }),
      response_metadata: {},
    });

    const { generateImagingContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generateImagingContentLC({ GEMINI_API_KEY: 'k' }, 'Chest X-ray');

    expect(result.success).toBe(true);
    expect((result.content as any).radiationRisk).toBe(true);
  });

  it('generateTreatmentContentLC returns validated treatment content', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        description: 'ACE inhibitor',
        mechanismOfAction: 'Blocks ACE conversion',
        commonIndications: ['Hypertension', 'CHF'],
        seriousSideEffects: ['Angioedema', 'Hyperkalemia'],
      }),
      response_metadata: {},
    });

    const { generateTreatmentContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generateTreatmentContentLC({ GEMINI_API_KEY: 'k' }, 'Lisinopril');

    expect(result.success).toBe(true);
    expect((result.content as any).mechanismOfAction).toBeDefined();
    expect((result.content as any).seriousSideEffects).toHaveLength(2);
  });

  it('generatePhysiologyContentLC returns validated physiology content', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        description: 'Frank-Starling mechanism',
        mechanism: 'Increased preload stretches ventricular walls',
        clinicalSignificance: 'Explains why volume resuscitation helps in hypovolemic shock',
      }),
      response_metadata: {},
    });

    const { generatePhysiologyContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generatePhysiologyContentLC({ GEMINI_API_KEY: 'k' }, 'Frank-Starling Law');

    expect(result.success).toBe(true);
    expect((result.content as any).clinicalSignificance).toBeDefined();
  });

  it('generateConditionContentLC passes through provider and latencyMs', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        overview: 'Test',
        symptoms: ['S1'],
        diagnosis: 'D1',
        treatment: 'T1',
        clinicalPearls: ['P1'],
      }),
      response_metadata: {},
    });

    const { generateConditionContentLC } = await import('../lib/langchain/chains/contentGeneration');
    const result = await generateConditionContentLC(
      { GEMINI_API_KEY: 'k' },
      { conditionName: 'Test', system: 'Test' }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('gemini');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
