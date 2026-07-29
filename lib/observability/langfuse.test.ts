import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('langfuse', () => {
  const generation = vi.fn();
  const flushAsync = vi.fn();
  const trace = vi.fn(() => ({ id: 'trace-test-id', generation }));
  const shutdownAsync = vi.fn();
  function MockLangfuse() {
    return { trace, flushAsync, shutdownAsync };
  }
  return {
    Langfuse: MockLangfuse,
    __mocks: { trace, generation, flushAsync, shutdownAsync },
  };
});

import { traceGatewayCall, shutdownLangfuse, type GatewayTraceInput, type LangfuseEnv } from './langfuse';
import * as langfuseModule from 'langfuse';

const mocks = (
  langfuseModule as unknown as {
    __mocks: {
      trace: ReturnType<typeof vi.fn>;
      generation: ReturnType<typeof vi.fn>;
      flushAsync: ReturnType<typeof vi.fn>;
      shutdownAsync: ReturnType<typeof vi.fn>;
    };
  }
).__mocks;

const keysEnv: LangfuseEnv = {
  LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
  LANGFUSE_SECRET_KEY: 'sk-lf-test',
};

const baseInput = (overrides: Partial<GatewayTraceInput> = {}): GatewayTraceInput => ({
  env: keysEnv,
  traceId: 'trace-abc',
  requestId: 'req-123',
  task: 'generation',
  endpoint: '/api/test',
  model: 'gemini-2.5-pro',
  provider: 'gemini',
  userPrompt: 'Generate a question about MI.',
  ...overrides,
});

describe('traceGatewayCall', () => {
  beforeEach(async () => {
    mocks.trace.mockClear();
    mocks.generation.mockClear();
    mocks.flushAsync.mockClear();
    mocks.shutdownAsync.mockClear();
    // Pitfall: vi.fn().mockResolvedValue() inside the vi.mock factory is
    // stripped at the module boundary. Implementation must be (re)applied here.
    mocks.flushAsync.mockResolvedValue(undefined);
    mocks.shutdownAsync.mockResolvedValue(undefined);
    await shutdownLangfuse();
  });

  it('is a no-op when Langfuse keys are absent', () => {
    traceGatewayCall(baseInput({ env: {} }));
    expect(mocks.trace).not.toHaveBeenCalled();
    expect(mocks.generation).not.toHaveBeenCalled();
  });

  it('is a no-op when only one key is set', () => {
    traceGatewayCall(baseInput({ env: { LANGFUSE_PUBLIC_KEY: 'pk-only' } }));
    expect(mocks.trace).not.toHaveBeenCalled();
  });

  it('creates a trace named ai-gateway:<task> with task tag', () => {
    traceGatewayCall(baseInput());
    expect(mocks.trace).toHaveBeenCalledTimes(1);
    expect(mocks.trace.mock.calls[0]?.[0]).toMatchObject({
      name: 'ai-gateway:generation',
      userId: undefined,
      tags: ['ai-gateway', 'generation'],
    });
  });

  it('passes userId through to the trace', () => {
    traceGatewayCall(baseInput({ userId: 'user-42' }));
    expect(mocks.trace.mock.calls[0]?.[0]).toMatchObject({ userId: 'user-42' });
  });

  it('emits a generation with model, input, and generation-typed observation', () => {
    traceGatewayCall(
      baseInput({
        systemPrompt: 'You are a tutor.',
        userPrompt: 'Explain LV dysfunction.',
        output: 'LV dysfunction reduces cardiac output.',
        usage: { inputTokens: 12, outputTokens: 30, totalTokens: 42 },
      }),
    );
    expect(mocks.generation).toHaveBeenCalledTimes(1);
    const gen = mocks.generation.mock.calls[0]?.[0];
    expect(gen.model).toBe('gemini-2.5-pro');
    expect(gen.input).toEqual({
      system: 'You are a tutor.',
      user: 'Explain LV dysfunction.',
    });
    expect(gen.output).toBe('LV dysfunction reduces cardiac output.');
    expect(gen.usage).toEqual({
      promptTokens: 12,
      completionTokens: 30,
      totalTokens: 42,
    });
  });

  it('uses plain userPrompt as input when no systemPrompt is set', () => {
    traceGatewayCall(baseInput({ systemPrompt: undefined }));
    expect(mocks.generation.mock.calls[0]?.[0].input).toBe(
      'Generate a question about MI.',
    );
  });

  it('marks level DEFAULT on success, ERROR on errorMessage', () => {
    traceGatewayCall(baseInput());
    expect(mocks.generation.mock.calls[0]?.[0].level).toBe('DEFAULT');

    mocks.generation.mockClear();
    traceGatewayCall(baseInput({ errorMessage: 'upstream 500' }));
    expect(mocks.generation.mock.calls[0]?.[0].level).toBe('ERROR');
  });

  it('respects an explicit WARNING level (e.g. schema repair used)', () => {
    traceGatewayCall(baseInput({ level: 'WARNING' }));
    expect(mocks.generation.mock.calls[0]?.[0].level).toBe('WARNING');
  });

  it('carries traceId + requestId in metadata for cross-correlation', () => {
    traceGatewayCall(baseInput());
    const meta = mocks.trace.mock.calls[0]?.[0].metadata;
    expect(meta.traceId).toBe('trace-abc');
    expect(meta.requestId).toBe('req-123');
    expect(meta.endpoint).toBe('/api/test');
  });

  it('only includes latencyMs when provided (avoids undefined in metadata)', () => {
    traceGatewayCall(baseInput());
    let meta = mocks.trace.mock.calls[0]?.[0].metadata;
    expect(meta).not.toHaveProperty('latencyMs');

    mocks.trace.mockClear();
    traceGatewayCall(baseInput({ latencyMs: 543 }));
    meta = mocks.trace.mock.calls[0]?.[0].metadata;
    expect(meta.latencyMs).toBe(543);
  });

  it('only includes errorMessage in metadata when set', () => {
    traceGatewayCall(baseInput());
    let meta = mocks.trace.mock.calls[0]?.[0].metadata;
    expect(meta).not.toHaveProperty('errorMessage');

    mocks.trace.mockClear();
    traceGatewayCall(baseInput({ errorMessage: 'boom' }));
    meta = mocks.trace.mock.calls[0]?.[0].metadata;
    expect(meta.errorMessage).toBe('boom');
  });

  it('schedules a flush via waitUntil when provided (Edge-safe)', async () => {
    const waitUntil = vi.fn();
    traceGatewayCall(baseInput({ waitUntil }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const scheduled = waitUntil.mock.calls[0]?.[0];
    expect(scheduled).toBeInstanceOf(Promise);
    await scheduled;
    expect(mocks.flushAsync).toHaveBeenCalledTimes(1);
  });

  it('does not throw if waitUntil is absent (Node script mode)', () => {
    expect(() => traceGatewayCall(baseInput())).not.toThrow();
  });

  it('swallows errors from the Langfuse SDK so tracing never breaks the request', () => {
    mocks.trace.mockImplementationOnce(() => {
      throw new Error('SDK explosion');
    });
    expect(() => traceGatewayCall(baseInput())).not.toThrow();
  });

  it('forwards extra tags alongside the defaults', () => {
    traceGatewayCall(baseInput({ tags: ['osce', 'experimental'] }));
    expect(mocks.trace.mock.calls[0]?.[0].tags).toEqual([
      'ai-gateway',
      'generation',
      'osce',
      'experimental',
    ]);
  });

  it('only sets modelParameters that are provided', () => {
    traceGatewayCall(baseInput());
    let params = mocks.generation.mock.calls[0]?.[0].modelParameters;
    expect(params).toEqual({});

    mocks.generation.mockClear();
    traceGatewayCall(baseInput({ temperature: 0.7, maxOutputTokens: 2048 }));
    params = mocks.generation.mock.calls[0]?.[0].modelParameters;
    expect(params).toEqual({ temperature: 0.7, maxOutputTokens: 2048 });
  });
});
