import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateRequestId,
  toAgentResponse,
  toTaskStatus,
  toErrorCode,
  serializeRequest,
  deserializeRequest,
  serializeResponse,
  deserializeResponse,
  registerProtocolAdapter,
  getProtocolAdapter,
  listProtocolAdapters,
  destroyAllAdapters,
  AgentProtocolAdapter,
} from './protocol';
import type { AgentRequest, AgentResponse } from './protocol';
import type { AgentStatus } from './shared/types';

// Mock invokeUnifiedAgent
vi.mock('./unified', () => ({
  invokeUnifiedAgent: vi.fn(),
}));

describe('protocol utilities', () => {
  describe('generateRequestId', () => {
    it('generates unique UUIDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('toTaskStatus', () => {
    it('maps ok to completed', () => {
      expect(toTaskStatus('ok' as AgentStatus)).toBe('completed');
    });
    it('maps internal_error to failed', () => {
      expect(toTaskStatus('internal_error' as AgentStatus)).toBe('failed');
    });
    it('maps rate_limited to rate_limited', () => {
      expect(toTaskStatus('rate_limited' as AgentStatus)).toBe('rate_limited');
    });
    it('maps safety_blocked to safety_blocked', () => {
      expect(toTaskStatus('safety_blocked' as AgentStatus)).toBe('safety_blocked');
    });
  });

  describe('toErrorCode', () => {
    it('maps internal_error to INTERNAL_ERROR', () => {
      expect(toErrorCode('internal_error')).toBe('INTERNAL_ERROR');
    });
    it('maps rate_limited to RATE_LIMITED', () => {
      expect(toErrorCode('rate_limited')).toBe('RATE_LIMITED');
    });
  });

  describe('toAgentResponse', () => {
    it('converts InvokeResult to AgentResponse', () => {
      const result = {
        status: 'ok' as const,
        output: { answer: 'hello' },
        error: null,
        agent: 'tutor',
        durationMs: 50,
        telemetry: { model: 'gemini-flash' },
      };
      const response = toAgentResponse('req_123', result);

      expect(response.requestId).toBe('req_123');
      expect(response.agent).toBe('tutor');
      expect(response.status).toBe('completed');
      expect(response.output).toEqual({ answer: 'hello' });
      expect(response.error).toBeNull();
      expect(response.durationMs).toBe(50);
    });

    it('maps error status to failed', () => {
      const result = {
        status: 'internal_error' as const,
        output: null,
        error: { status: 'internal_error' as const, message: 'fail', cause: undefined },
        agent: 'tutor',
        durationMs: 10,
      };
      const response = toAgentResponse('req_456', result);

      expect(response.status).toBe('failed');
      expect(response.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'fail',
        cause: undefined,
      });
    });
  });

  describe('serialization roundtrip', () => {
    it('serializeRequest/deserializeRequest roundtrip', () => {
      const request: AgentRequest = {
        requestId: 'req_test',
        agent: 'clinical-tutor',
        task: 'explain',
        input: { question: 'What is CHF?' },
        metadata: { userId: 'user_1', tags: ['test'] },
      };

      const serialized = serializeRequest(request);
      const deserialized = deserializeRequest(serialized);

      expect(deserialized).toEqual(request);
    });

    it('serializeResponse/deserializeResponse roundtrip', () => {
      const response: AgentResponse = {
        requestId: 'req_test',
        agent: 'clinical-tutor',
        status: 'completed',
        output: { answer: 'CHF is...' },
        error: null,
        durationMs: 100,
      };

      const serialized = serializeResponse(response);
      const deserialized = deserializeResponse(serialized);

      expect(deserialized).toEqual(response);
    });

    it('deserializeRequest throws on invalid JSON', () => {
      expect(() => deserializeRequest('not json')).toThrow();
    });

    it('deserializeRequest throws on missing fields', () => {
      expect(() => deserializeRequest('{}')).toThrow('missing required fields');
    });

    it('deserializeResponse throws on missing fields', () => {
      expect(() => deserializeResponse('{}')).toThrow('missing required fields');
    });
  });
});

describe('AgentProtocolAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    destroyAllAdapters();
  });

  describe('constructor', () => {
    it('sets defaults', () => {
      const adapter = new AgentProtocolAdapter({ agentName: 'test' });
      expect(adapter.getPendingCount()).toBe(0);
      expect(adapter.getUptimeMs()).toBeGreaterThanOrEqual(0);
    });

    it('accepts custom config', () => {
      const adapter = new AgentProtocolAdapter({
        agentName: 'test',
        agentVersion: '2.0',
        tier: 'ops',
        defaultTarget: 'supervisor',
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('invoke', () => {
    it('dispatches request and resolves with response', async () => {
      const adapter = new AgentProtocolAdapter({ agentName: 'test' });
      const { invokeUnifiedAgent } = await import('./unified');

      vi.mocked(invokeUnifiedAgent).mockResolvedValueOnce({
        status: 'ok',
        output: { answer: 'response' },
        error: null,
        agent: 'clinical-tutor',
        durationMs: 50,
      });

      const response = await adapter.invoke(
        'clinical-tutor',
        { question: 'What is CHF?' },
        { userId: 'user_1', env: { GEMINI_API_KEY: 'test' } } as any,
        'explain',
      );

      expect(response.status).toBe('completed');
      expect(response.requestId).toMatch(/^[0-9a-f-]+$/);
      expect(response.output).toEqual({ answer: 'response' });
      expect(adapter.getPendingCount()).toBe(0);
    });

    it('rejects on timeout', async () => {
      const adapter = new AgentProtocolAdapter({ agentName: 'test' }, 100);
      const { invokeUnifiedAgent } = await import('./unified');

      vi.mocked(invokeUnifiedAgent).mockImplementation(
        () => new Promise(() => {}),
      );

      await expect(
        adapter.invoke('clinical-tutor', {}, { userId: 'user_1', env: { GEMINI_API_KEY: 'test' } } as any),
      ).rejects.toThrow('Protocol timeout');
    });
  });

  describe('handleResponse', () => {
    it('warns on unknown requestId', () => {
      const adapter = new AgentProtocolAdapter({ agentName: 'test' });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      adapter.handleResponse({
        requestId: 'req_unknown',
        agent: 'test',
        status: 'completed',
        output: null,
        error: null,
        durationMs: 0,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pending request'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    it('cancels all pending requests', () => {
      const adapter = new AgentProtocolAdapter({ agentName: 'test' });
      adapter.destroy();
      expect(adapter.getPendingCount()).toBe(0);
    });
  });
});

describe('protocol registry', () => {
  afterEach(() => {
    destroyAllAdapters();
  });

  it('registerProtocolAdapter / getProtocolAdapter', () => {
    const adapter = new AgentProtocolAdapter({ agentName: 'tutor' });
    registerProtocolAdapter('tutor', adapter);

    expect(getProtocolAdapter('tutor')).toBe(adapter);
    expect(getProtocolAdapter('unknown')).toBeUndefined();
  });

  it('listProtocolAdapters returns all registered', () => {
    const a1 = new AgentProtocolAdapter({ agentName: 'tutor' });
    const a2 = new AgentProtocolAdapter({ agentName: 'researcher' });
    registerProtocolAdapter('tutor', a1);
    registerProtocolAdapter('researcher', a2);

    const list = listProtocolAdapters();
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.agentName)).toContain('tutor');
    expect(list.map((a) => a.agentName)).toContain('researcher');
  });

  it('destroyAllAdapters clears registry', () => {
    registerProtocolAdapter('tutor', new AgentProtocolAdapter({ agentName: 'tutor' }));
    destroyAllAdapters();

    expect(listProtocolAdapters()).toHaveLength(0);
  });
});
