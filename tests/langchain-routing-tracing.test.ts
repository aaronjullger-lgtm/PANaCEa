/**
 * LangChain Router Tracing Regression Tests — First Attempt vs Retry
 *
 * Guards the router's first-attempt-only tracer attachment:
 * - The first attempt per model carries the LangSmith tracer callback
 *   plus per-model provider/cost tags and metadata.
 * - Retries keep tags/metadata but carry NO tracer callbacks, so error
 *   storms do not duplicate tracer attachment or burn trace quota.
 * - LANGSMITH_ENDPOINT is part of the declared env contract and is
 *   forwarded by the env adapter.
 *
 * All LLM providers and the LangSmith tracer are mocked. No test here
 * contacts a real API or trace endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Top-level mocks (hoisted) ───────────────────────────────────────────

const {
  mockInvoke,
  MockChatGoogleGenerativeAI,
  MockChatOpenAI,
  MockChatAnthropic,
  MockLangChainTracer,
} = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  const MockChatGoogleGenerativeAI = vi.fn();
  const MockChatOpenAI = vi.fn();
  const MockChatAnthropic = vi.fn();
  const MockLangChainTracer = vi.fn();
  return {
    mockInvoke,
    MockChatGoogleGenerativeAI,
    MockChatOpenAI,
    MockChatAnthropic,
    MockLangChainTracer,
  };
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

vi.mock('@langchain/core/tracers/tracer_langchain', () => ({
  LangChainTracer: MockLangChainTracer,
}));

function setupDefaultMocks() {
  mockInvoke.mockReset();
  MockChatGoogleGenerativeAI.mockReset();
  MockChatOpenAI.mockReset();
  MockChatAnthropic.mockReset();
  MockLangChainTracer.mockReset();

  // Must use function() not arrow so `new` works
  const makeImpl = function (this: { invoke: (...args: unknown[]) => unknown }) {
    this.invoke = (...args: unknown[]) => mockInvoke(...args);
  };
  MockChatGoogleGenerativeAI.mockImplementation(makeImpl);
  MockChatOpenAI.mockImplementation(makeImpl);
  MockChatAnthropic.mockImplementation(makeImpl);
  MockLangChainTracer.mockImplementation(function () {
    return { name: 'mock_tracer', projectName: 'panacea' };
  });
}

beforeEach(() => {
  setupDefaultMocks();
});

// ─── First Attempt vs Retry ──────────────────────────────────────────────

describe('Router tracing: first attempt vs retry', () => {
  const tracingEnv = { OPENAI_API_KEY: 'k', LANGSMITH_API_KEY: 'ls' };

  it('first attempt attaches tracer and per-model tags; retry keeps tags/metadata without callbacks', async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce({ content: 'ok', response_metadata: {} });

    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask(
      'extraction',
      tracingEnv,
      { userPrompt: 'test' },
      { forceModel: 'gpt-4o-mini' }
    );

    expect(result.attempts).toBe(2);
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    const firstConfig = mockInvoke.mock.calls[0][1];
    const retryConfig = mockInvoke.mock.calls[1][1];

    // First attempt: tracer attached, enriched with per-model tags/metadata.
    expect(firstConfig.callbacks).toHaveLength(1);
    expect(firstConfig.tags).toContain('model:gpt-4o-mini');
    expect(firstConfig.tags).toContain('provider:openai');
    expect(firstConfig.tags).toContain('cost:budget');
    expect(firstConfig.metadata.model_name).toBe('gpt-4o-mini');
    expect(firstConfig.metadata.provider).toBe('openai');
    expect(firstConfig.metadata.cost_tier).toBe('budget');

    // Retry: tags/metadata preserved, but no tracer callbacks attached.
    expect(retryConfig.callbacks).toBeUndefined();
    expect(retryConfig.tags).toContain('model:gpt-4o-mini');
    expect(retryConfig.tags).toContain('provider:openai');
    expect(retryConfig.tags).toContain('cost:budget');
    expect(retryConfig.metadata.model_name).toBe('gpt-4o-mini');
    expect(retryConfig.metadata.provider).toBe('openai');
    expect(retryConfig.metadata.cost_tier).toBe('budget');
  });

  it('constructs the tracer exactly once per route even when retries occur', async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce({ content: 'ok', response_metadata: {} });

    const { routeTask } = await import('../lib/langchain/router');
    await routeTask(
      'extraction',
      tracingEnv,
      { userPrompt: 'test' },
      { forceModel: 'gpt-4o-mini' }
    );

    expect(MockLangChainTracer).toHaveBeenCalledTimes(1);
    const tracerInstance = MockLangChainTracer.mock.results[0].value;
    const firstConfig = mockInvoke.mock.calls[0][1];
    expect(firstConfig.callbacks).toEqual([tracerInstance]);
  });

  it('sends no tracer callbacks when tracing is disabled, even on first attempt', async () => {
    mockInvoke.mockResolvedValueOnce({ content: 'ok', response_metadata: {} });

    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask(
      'extraction',
      { OPENAI_API_KEY: 'k' },
      { userPrompt: 'test' },
      { forceModel: 'gpt-4o-mini' }
    );

    expect(result.attempts).toBe(1);
    expect(MockLangChainTracer).not.toHaveBeenCalled();
    const config = mockInvoke.mock.calls[0][1];
    expect(config.callbacks).toEqual([]);
  });
});

// ─── LangSmith Endpoint Env Contract ─────────────────────────────────────

describe('LangSmith endpoint env contract', () => {
  it('envAdapter forwards LANGSMITH_ENDPOINT into AIEnvKeys', async () => {
    const { fromCloudflareEnv, fromExplicitKeys } = await import(
      '../lib/langchain/envAdapter'
    );
    const endpoint = 'https://langsmith.internal.example';

    expect(fromCloudflareEnv({ LANGSMITH_ENDPOINT: endpoint }).LANGSMITH_ENDPOINT).toBe(endpoint);
    expect(fromExplicitKeys({ LANGSMITH_ENDPOINT: endpoint }).LANGSMITH_ENDPOINT).toBe(endpoint);
  });
});
