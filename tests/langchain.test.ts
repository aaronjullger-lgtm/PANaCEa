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
  });

  it('TASK_MODEL_MAP has entries for core PANaCEa tasks', async () => {
    const { TASK_MODEL_MAP } = await import('../lib/langchain/config');
    expect(TASK_MODEL_MAP['question-generation']).toBeDefined();
    expect(TASK_MODEL_MAP['question-critique']).toBeDefined();
    expect(TASK_MODEL_MAP['content-generation']).toBeDefined();
    expect(TASK_MODEL_MAP['osce-chat']).toBeDefined();
    expect(TASK_MODEL_MAP['clinical-reasoning']).toBeDefined();
    expect(TASK_MODEL_MAP['extraction']).toBeDefined();
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
      expect(config.inputCostPer1M, `${name} missing inputCostPer1M`).toBeGreaterThan(0);
      expect(config.outputCostPer1M, `${name} missing outputCostPer1M`).toBeGreaterThan(0);
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
  });

  it('getAvailableProviders returns empty when no keys', async () => {
    const { getAvailableProviders } = await import('../lib/langchain/models');
    expect(getAvailableProviders({})).toEqual([]);
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
      LANGSMITH_API_KEY: 'ls',
      LANGSMITH_PROJECT: 'proj',
      DATABASE_URL: 'postgres://...',
      CLERK_SECRET_KEY: 'secret',
    });

    expect(env.GEMINI_API_KEY).toBe('gem');
    expect(env.OPENAI_API_KEY).toBe('oai');
    expect(env.ANTHROPIC_API_KEY).toBe('ant');
    expect(env.DEEPSEEK_API_KEY).toBe('ds');
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
  it('configureLangSmithEnv returns false without API key', async () => {
    const { configureLangSmithEnv } = await import('../lib/langchain/tracing');
    expect(configureLangSmithEnv({})).toBe(false);
  });

  it('configureLangSmithEnv returns true and sets globals with key', async () => {
    const { configureLangSmithEnv } = await import('../lib/langchain/tracing');
    const result = configureLangSmithEnv({ LANGSMITH_API_KEY: 'test-key' });
    expect(result).toBe(true);
    expect((globalThis as any).LANGCHAIN_TRACING_V2).toBe('true');
    expect((globalThis as any).LANGCHAIN_API_KEY).toBe('test-key');

    // Clean up globals
    delete (globalThis as any).LANGCHAIN_TRACING_V2;
    delete (globalThis as any).LANGCHAIN_API_KEY;
    delete (globalThis as any).LANGCHAIN_PROJECT;
    delete (globalThis as any).LANGCHAIN_ENDPOINT;
  });

  it('buildTracingConfig returns empty object without key', async () => {
    const { buildTracingConfig } = await import('../lib/langchain/tracing');
    expect(buildTracingConfig({})).toEqual({});
  });

  it('buildTracingConfig includes metadata when key is set', async () => {
    const { buildTracingConfig } = await import('../lib/langchain/tracing');
    const config = buildTracingConfig(
      { LANGSMITH_API_KEY: 'k' },
      { runName: 'test', tags: ['a'], metadata: { foo: 'bar' } }
    );
    expect(config.runName).toBe('test');
    expect(config.tags).toEqual(['a']);
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
    expect(result.model).toBe('gemini-2.0-flash');
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
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.provider).toBe('openai');
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
    expect(result.model).toBe('gemini-2.0-flash');
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
