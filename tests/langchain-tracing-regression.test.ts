/**
 * Regression tests for the M27 tracing compile repair
 * (AAR-418 / production typecheck run 0e975ecf).
 *
 * Covers the four repaired diagnostics:
 * - router.ts(208,13),(209,21),(209,51): undefined `tracingConfig` in the
 *   retry loop → now uses the per-model `modelTracingConfig`.
 * - tracing.ts(255,26): `LANGSMITH_ENDPOINT` missing on `AIEnvKeys` →
 *   optional env type added in models.ts.
 *
 * Verifies behavior, not just compilation: first-attempt-per-model tracer
 * attachment, retry-without-callbacks, per-model metadata enrichment,
 * optional endpoint override/default, and no-key no-tracing.
 *
 * LLM provider calls are fully mocked (same pattern as tests/langchain.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Top-level mocks (hoisted) — same pattern as tests/langchain.test.ts ──

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

vi.mock('@langchain/core/tracers/tracer_langchain', () => ({
  LangChainTracer: vi.fn(
    class {
      name = 'mock_tracer';
      projectName = 'panacea';
      client = {};
      usesRunTreeMap = false;
    }
  ),
}));

function setupDefaultMocks() {
  mockInvoke.mockResolvedValue({
    content: '{"test": true}',
    response_metadata: {
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    },
  });

  const makeImpl = function(this: any) {
    this.invoke = (...args: unknown[]) => mockInvoke(...args);
  };
  MockChatGoogleGenerativeAI.mockImplementation(makeImpl);
  MockChatOpenAI.mockImplementation(makeImpl);
  MockChatAnthropic.mockImplementation(makeImpl);
}

beforeEach(() => {
  setupDefaultMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── AIEnvKeys optional LANGSMITH_ENDPOINT type (tracing.ts:255 repair) ────

describe('AIEnvKeys LANGSMITH_ENDPOINT (AAR-418 tracing.ts:255 repair)', () => {
  it('AIEnvKeys accepts LANGSMITH_ENDPOINT without type error', async () => {
    const env: import('../lib/langchain/models').AIEnvKeys = {
      LANGSMITH_API_KEY: 'k',
      LANGSMITH_ENDPOINT: 'https://langsmith.example.internal',
    };
    expect(env.LANGSMITH_ENDPOINT).toBe('https://langsmith.example.internal');
  });

  it('submitTraceFeedback defaults endpoint to api.smith.langchain.com', async () => {
    const { submitTraceFeedback } = await import('../lib/langchain/tracing');
    await submitTraceFeedback(
      { runId: 'run-1', score: 0.9 },
      { LANGSMITH_API_KEY: 'k' }
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url).startsWith('https://api.smith.langchain.com/')).toBe(true);
  });

  it('submitTraceFeedback honors LANGSMITH_ENDPOINT override', async () => {
    const { submitTraceFeedback } = await import('../lib/langchain/tracing');
    await submitTraceFeedback(
      { runId: 'run-2', score: 0.5 },
      { LANGSMITH_API_KEY: 'k', LANGSMITH_ENDPOINT: 'https://ls.private.example' }
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url).startsWith('https://ls.private.example/api/v1/feedback')).toBe(true);
  });

  it('submitTraceFeedback sends nothing without LANGSMITH_API_KEY', async () => {
    const { submitTraceFeedback } = await import('../lib/langchain/tracing');
    await submitTraceFeedback(
      { runId: 'run-3', score: 1 },
      { LANGSMITH_ENDPOINT: 'https://ls.private.example' }
    );

    expect(fetch).not.toHaveBeenCalled();
  });
});

// ─── Router retry-loop tracing config (router.ts:208/209 repair) ───────────

describe('Router per-model tracing config (AAR-418 router.ts:208/209 repair)', () => {
  it('first attempt per model carries the tracer callbacks and enriched per-model metadata', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    await routeTask('question-generation', { GEMINI_API_KEY: 'k' }, { userPrompt: 't' });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const config = mockInvoke.mock.calls[0][1] as Record<string, unknown>;

    // Per-model enrichment preserved on the traced first attempt.
    const tags = config.tags as string[];
    expect(tags).toContain('model:gemini-2.5-pro');
    expect(tags).toContain('provider:gemini');
    const metadata = config.metadata as Record<string, unknown>;
    expect(metadata.model_name).toBe('gemini-2.5-pro');
    expect(metadata.provider).toBe('gemini');
    // gemini-2.5-pro inputCostPer1M is 1.25 (config.ts), and router.ts
    // classifies inputCostPer1M <= 2.00 as 'mid' — not 'premium'.
    expect(metadata.cost_tier).toBe('mid');
  });

  it('retry (second attempt same model) drops callbacks but keeps tags and metadata', async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ content: 'ok', response_metadata: {} });

    const { routeTask } = await import('../lib/langchain/router');
    const result = await routeTask('question-generation', { GEMINI_API_KEY: 'k' }, { userPrompt: 't' });

    expect(result.attempts).toBe(2);
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    const retryConfig = mockInvoke.mock.calls[1][1] as Record<string, unknown>;
    expect(retryConfig.callbacks).toBeUndefined();
    const tags = retryConfig.tags as string[];
    expect(tags).toContain('model:gemini-2.5-pro');
    const metadata = retryConfig.metadata as Record<string, unknown>;
    expect(metadata.model_name).toBe('gemini-2.5-pro');
  });

  it('with LANGSMITH_API_KEY the first attempt config includes exactly one tracer callback', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    await routeTask('question-generation', { GEMINI_API_KEY: 'k', LANGSMITH_API_KEY: 'ls' }, { userPrompt: 't' });

    const firstConfig = mockInvoke.mock.calls[0][1] as Record<string, unknown>;
    const callbacks = firstConfig.callbacks as unknown[];
    expect(callbacks).toHaveLength(1);
  });

  it('without LANGSMITH_API_KEY the first attempt config has no callbacks (no tracing without key)', async () => {
    const { routeTask } = await import('../lib/langchain/router');
    await routeTask('question-generation', { GEMINI_API_KEY: 'k' }, { userPrompt: 't' });

    const firstConfig = mockInvoke.mock.calls[0][1] as Record<string, unknown>;
    expect(firstConfig.callbacks).toEqual([]);
  });
});
