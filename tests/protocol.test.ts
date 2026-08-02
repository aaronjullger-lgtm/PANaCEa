/**
 * Tests for the Agent Protocol adapter (lib/agents/protocol.ts).
 *
 * Verifies:
 * - Status/error conversion helpers
 * - AgentResponse wrapping (toAgentResponse)
 * - Request ID generation
 * - AgentProtocolAdapter invoke / timeout / destroy lifecycle
 * - Adapter registry
 * - Request/response serialization round-trips
 *
 * @module tests/protocol.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/agents/unified', async () => {
  const actual = await vi.importActual('@/lib/agents/unified');
  return {
    ...(actual as object),
    invokeUnifiedAgent: vi.fn(),
  };
});

import {
  toTaskStatus,
  toErrorCode,
  toAgentResponse,
  generateRequestId,
  AgentProtocolAdapter,
  registerProtocolAdapter,
  getProtocolAdapter,
  listProtocolAdapters,
  destroyAllAdapters,
  serializeRequest,
  deserializeRequest,
  serializeResponse,
  deserializeResponse,
} from '@/lib/agents/protocol';
import { invokeUnifiedAgent } from '@/lib/agents/unified';

const ctx = { env: { GEMINI_API_KEY: 'test-key' } };

function okResult(output: unknown) {
  return {
    status: 'ok',
    output,
    error: null,
    agent: 'content-audit',
    durationMs: 12,
    telemetry: { tokensUsed: 30, model: 'gemini-2.5-flash' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('status conversion', () => {
  it('toTaskStatus maps every AgentStatus', () => {
    expect(toTaskStatus('ok')).toBe('completed');
    expect(toTaskStatus('no_input')).toBe('invalid_input');
    expect(toTaskStatus('schema_invalid')).toBe('invalid_input');
    expect(toTaskStatus('rate_limited')).toBe('rate_limited');
    expect(toTaskStatus('safety_blocked')).toBe('safety_blocked');
    expect(toTaskStatus('env_missing')).toBe('failed');
    expect(toTaskStatus('internal_error')).toBe('failed');
  });

  it('toErrorCode maps every non-ok AgentStatus', () => {
    expect(toErrorCode('no_input')).toBe('INVALID_INPUT');
    expect(toErrorCode('schema_invalid')).toBe('INVALID_INPUT');
    expect(toErrorCode('rate_limited')).toBe('RATE_LIMITED');
    expect(toErrorCode('safety_blocked')).toBe('SAFETY_BLOCKED');
    expect(toErrorCode('env_missing')).toBe('ENV_MISSING');
    expect(toErrorCode('internal_error')).toBe('INTERNAL_ERROR');
  });
});

describe('toAgentResponse()', () => {
  it('wraps a successful result', () => {
    const response = toAgentResponse('req-1', okResult('output') as never);

    expect(response.requestId).toBe('req-1');
    expect(response.agent).toBe('content-audit');
    expect(response.status).toBe('completed');
    expect(response.output).toBe('output');
    expect(response.error).toBeNull();
    expect(response.telemetry?.tokensUsed).toBe(30);
    expect(response.telemetry?.model).toBe('gemini-2.5-flash');
  });

  it('maps error details for failed results', () => {
    const response = toAgentResponse('req-2', {
      status: 'rate_limited',
      output: null,
      error: { status: 'rate_limited', message: 'slow down', cause: 'quota' },
      agent: 'content-audit',
      durationMs: 3,
    } as never);

    expect(response.status).toBe('rate_limited');
    expect(response.error?.code).toBe('RATE_LIMITED');
    expect(response.error?.message).toBe('slow down');
    expect(response.error?.cause).toBe('quota');
  });
});

describe('generateRequestId()', () => {
  it('produces UUID v4-shaped ids that are unique', () => {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);

    for (const id of ids) {
      expect(id).toMatch(uuidPattern);
    }
  });
});

describe('AgentProtocolAdapter', () => {
  it('invoke resolves via handleResponse with the agent response', async () => {
    vi.mocked(invokeUnifiedAgent).mockResolvedValueOnce(okResult('audited') as never);

    const adapter = new AgentProtocolAdapter({ agentName: 'test-adapter' });
    const response = await adapter.invoke('content-audit', { q: 1 }, ctx);

    expect(response.status).toBe('completed');
    expect(response.output).toBe('audited');
    expect(response.requestId.length).toBeGreaterThan(0);
    expect(adapter.getPendingCount()).toBe(0);

    const call = vi.mocked(invokeUnifiedAgent).mock.calls[0]?.[0];
    expect(call?.name).toBe('content-audit');
    expect(call?.trace?.tags).toContain('agent-protocol');
  });

  it('invoke rejects on protocol timeout', async () => {
    vi.mocked(invokeUnifiedAgent).mockImplementationOnce(
      () => new Promise(() => {}) as never,
    );

    const adapter = new AgentProtocolAdapter({ agentName: 'slow-adapter' }, 30);
    await expect(adapter.invoke('content-audit', { q: 1 }, ctx)).rejects.toThrow(
      /Protocol timeout/,
    );
    expect(adapter.getPendingCount()).toBe(0);
  });

  it('destroy rejects pending requests', async () => {
    vi.mocked(invokeUnifiedAgent).mockImplementationOnce(
      () => new Promise(() => {}) as never,
    );

    const adapter = new AgentProtocolAdapter({ agentName: 'doomed-adapter' }, 60_000);
    const pending = adapter.invoke('content-audit', { q: 1 }, ctx);

    adapter.destroy();

    await expect(pending).rejects.toThrow(/Adapter destroyed/);
    expect(adapter.getPendingCount()).toBe(0);
  });
});

describe('adapter registry', () => {
  it('registers, retrieves, lists, and clears adapters', () => {
    const adapter = new AgentProtocolAdapter({ agentName: 'registry-adapter' });

    registerProtocolAdapter('registry-adapter', adapter);

    expect(getProtocolAdapter('registry-adapter')).toBe(adapter);
    expect(listProtocolAdapters()).toContainEqual(
      expect.objectContaining({ agentName: 'registry-adapter' }),
    );

    destroyAllAdapters();
    expect(getProtocolAdapter('registry-adapter')).toBeUndefined();
    expect(listProtocolAdapters()).toHaveLength(0);
  });
});

describe('serialization', () => {
  it('round-trips requests', () => {
    const request = {
      requestId: 'req-1',
      agent: 'content-audit',
      task: 'audit',
      input: { q: 1 },
      metadata: { userId: 'user-1' },
    };

    const restored = deserializeRequest(serializeRequest(request));
    expect(restored).toEqual(request);
  });

  it('round-trips responses', () => {
    const response = {
      requestId: 'req-1',
      agent: 'content-audit',
      status: 'completed',
      output: 'done',
      error: null,
      durationMs: 5,
      telemetry: { tokensUsed: 10 },
    };

    const restored = deserializeResponse(serializeResponse(response));
    expect(restored).toEqual(response);
  });

  it('rejects requests missing required fields', () => {
    expect(() => deserializeRequest('{"task":"audit"}')).toThrow(
      /Invalid AgentRequest/,
    );
    expect(() => deserializeRequest('not json')).toThrow();
  });
});
