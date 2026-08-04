import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getLangSmithClient,
  traceAgentInvocation,
  recordAgentMetric,
} from '../langsmith-edge';
import { agentMetrics } from '../observability';

vi.mock('langsmith/traceable', () => ({
  traceable: vi.fn((fn) => fn),
}));

vi.mock('langsmith', () => ({
  Client: vi.fn(function(this: any) {
    this.flush = vi.fn();
  }),
}));

describe('langsmith-edge observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentMetrics.clear();
  });

  afterEach(() => {
    agentMetrics.getAllMetrics();
  });

  // ─── getLangSmithClient ──────────────────────────────────────

  describe('getLangSmithClient', () => {
    it('returns null when LANGSMITH_API_KEY is missing', () => {
      const client = getLangSmithClient({
        LANGSMITH_API_KEY: '',
        LANGSMITH_PROJECT: 'panacea',
      });
      expect(client).toBeNull();
    });

    it('returns a Client when LANGSMITH_API_KEY is present', () => {
      const client = getLangSmithClient({
        LANGSMITH_API_KEY: 'test-key',
        LANGSMITH_PROJECT: 'panacea',
      });
      expect(client).not.toBeNull();
    });
  });

  // ─── traceAgentInvocation ────────────────────────────────────

  describe('traceAgentInvocation', () => {
    it('runs invoke when tracing is disabled (no API key)', async () => {
      const invoke = vi.fn().mockResolvedValue({ status: 'ok' });
      const result = await traceAgentInvocation({
        agent: 'test-agent',
        input: { q: 'hello' },
        userId: 'user-1',
        env: { LANGSMITH_API_KEY: '', LANGSMITH_PROJECT: 'panacea' },
        invoke,
      });
      expect(invoke).toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });
    });

    it('runs invoke when tracing is enabled', async () => {
      const invoke = vi.fn().mockResolvedValue({ status: 'ok' });
      const result = await traceAgentInvocation({
        agent: 'test-agent',
        input: { q: 'hello' },
        userId: 'user-1',
        env: { LANGSMITH_API_KEY: 'test-key', LANGSMITH_PROJECT: 'panacea' },
        invoke,
      });
      expect(invoke).toHaveBeenCalled();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  // ─── recordAgentMetric ───────────────────────────────────────

  describe('recordAgentMetric', () => {
    it('records a successful invocation', () => {
      recordAgentMetric('test-agent', 150, true);
      const metrics = agentMetrics.getMetrics('test-agent');
      expect(metrics.totalInvocations).toBe(1);
      expect(metrics.successfulInvocations).toBe(1);
      expect(metrics.failedInvocations).toBe(0);
      expect(metrics.averageDurationMs).toBe(150);
    });

    it('records a failed invocation', () => {
      recordAgentMetric('test-agent', 500, false);
      const metrics = agentMetrics.getMetrics('test-agent');
      expect(metrics.totalInvocations).toBe(1);
      expect(metrics.successfulInvocations).toBe(0);
      expect(metrics.failedInvocations).toBe(1);
      expect(metrics.errorRate).toBe(1);
    });

    it('accumulates multiple invocations', () => {
      recordAgentMetric('test-agent', 100, true);
      recordAgentMetric('test-agent', 200, true);
      recordAgentMetric('test-agent', 300, false);
      const metrics = agentMetrics.getMetrics('test-agent');
      expect(metrics.totalInvocations).toBe(3);
      expect(metrics.successfulInvocations).toBe(2);
      expect(metrics.failedInvocations).toBe(1);
      expect(metrics.averageDurationMs).toBe(200);
    });

    it('returns zero metrics for unknown agent', () => {
      const metrics = agentMetrics.getMetrics('unknown-agent');
      expect(metrics.totalInvocations).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });
  });

  // ─── agentMetrics ────────────────────────────────────────────

  describe('agentMetrics', () => {
    it('getAllMetrics returns metrics for all agents', () => {
      recordAgentMetric('agent-a', 100, true);
      recordAgentMetric('agent-b', 200, false);
      const all = agentMetrics.getAllMetrics();
      expect(Object.keys(all)).toContain('agent-a');
      expect(Object.keys(all)).toContain('agent-b');
    });

    it('p95DurationMs is calculated correctly', () => {
      for (let i = 0; i < 20; i++) {
        recordAgentMetric('perf-agent', i * 10, true);
      }
      const metrics = agentMetrics.getMetrics('perf-agent');
      expect(metrics.p95DurationMs).toBeGreaterThan(0);
    });

    it('p99DurationMs is calculated correctly', () => {
      for (let i = 0; i < 100; i++) {
        recordAgentMetric('perf-agent-2', i * 5, true);
      }
      const metrics = agentMetrics.getMetrics('perf-agent-2');
      expect(metrics.p99DurationMs).toBeGreaterThan(0);
    });
  });
});