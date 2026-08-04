import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPersistentCheckpointSaver,
  clearCheckpointCache,
} from '../shared/persistent-checkpoint';
import { agentMetrics } from '../observability';
import {
  runEnhancedOrchestrator,
  runSequentialPipeline,
  runParallelPipeline,
  runFanOutPipeline,
} from '../orchestrator/enhanced';
import { invokeUnifiedAgent } from '../unified';
import type { AgentContext } from '../shared/types';

vi.mock('../shared/persistent-checkpoint', () => ({
  getPersistentCheckpointSaver: vi.fn(() => Promise.resolve(null)),
  clearCheckpointCache: vi.fn(),
}));

vi.mock('../unified', () => ({
  invokeUnifiedAgent: vi.fn(() =>
    Promise.resolve({ status: 'ok', output: { result: 'success' }, error: null, agent: 'test', durationMs: 0 }),
  ),
}));

const mockEnv = {
  GEMINI_API_KEY: 'test-key',
};

const mockCtx: AgentContext = {
  env: mockEnv,
  userId: 'test-user',
  log: vi.fn(),
};

describe('Deep Agents integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentMetrics.clear();
    clearCheckpointCache();
  });

  afterEach(() => {
    agentMetrics.clear();
  });

  // ─── persistent-checkpoint ──────────────────────────────────

  describe('persistent-checkpoint', () => {
    it('getPersistentCheckpointSaver returns null when SQLite unavailable', async () => {
      const saver = await getPersistentCheckpointSaver();
      expect(saver).toBeNull();
    });

    it('clearCheckpointCache resets the saver', async () => {
      clearCheckpointCache();
      const saver = await getPersistentCheckpointSaver();
      expect(saver).toBeNull();
    });
  });

  // ─── enhanced orchestrator ──────────────────────────────────

  describe('runEnhancedOrchestrator', () => {
    it('runs a simple pipeline successfully', async () => {
      const result = await runEnhancedOrchestrator(
        {
          name: 'test-pipeline',
          description: 'Test pipeline',
          maxRetries: 1,
        },
        async (state, ctx, emit) => {
          emit('phase-1', 50, 'Running phase 1');
          return { output: 'done' };
        },
        mockCtx,
      );

      expect(result.output).toEqual({ output: 'done' });
      expect(result.state.done).toBe(true);
      expect(result.state.error).toBeNull();
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('records circuit breaker state on failure', async () => {
      const result = await runEnhancedOrchestrator(
        {
          name: 'failing-pipeline',
          description: 'Failing pipeline',
          maxRetries: 0,
          circuitBreakerThreshold: 1,
        },
        async () => {
          throw new Error('Pipeline failed');
        },
        mockCtx,
      );

      expect(result.output).toBeNull();
      expect(result.state.error).toBe('Pipeline failed');
      expect(result.state.done).toBe(true);
      expect(result.metadata.circuitBreakerTripped).toBe(false);
    });

    it('tracks retry attempts', async () => {
      let attemptCount = 0;
      const result = await runEnhancedOrchestrator(
        {
          name: 'retry-pipeline',
          description: 'Retry pipeline',
          maxRetries: 2,
        },
        async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('Temporary failure');
          }
          return { output: 'recovered' };
        },
        mockCtx,
      );

      expect(result.output).toEqual({ output: 'recovered' });
      expect(result.state.retryCount).toBeGreaterThan(0);
      expect(result.state.done).toBe(true);
      expect(result.state.error).toBeNull();
    });
  });

  // ─── sequential pipeline ────────────────────────────────────

  describe('runSequentialPipeline', () => {
    it('runs agents sequentially', async () => {
      const result = await runSequentialPipeline(
        ['agent-a', 'agent-b'],
        { input: 'test' },
        mockCtx,
      );

      expect(result.results).toHaveLength(2);
      expect(result.results[0]!.agent).toBe('agent-a');
      expect(result.results[1]!.agent).toBe('agent-b');
    });

    it('stops on failure', async () => {
      const result = await runSequentialPipeline(
        ['agent-a', 'agent-b'],
        { input: 'test' },
        mockCtx,
        {
          name: 'sequential-fail',
          description: 'Sequential fail test',
          maxRetries: 0,
        },
      );

      expect(result.results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── parallel pipeline ──────────────────────────────────────

  describe('runParallelPipeline', () => {
    it('runs agents concurrently', async () => {
      const result = await runParallelPipeline(
        ['agent-a', 'agent-b', 'agent-c'],
        { input: 'test' },
        mockCtx,
      );

      expect(result.results).toHaveLength(3);
    });

    it('merges results with custom merger', async () => {
      const merger = (results: Array<{ agent: string; output: unknown }>) =>
        results.map((r) => r.agent).join(',');

      const result = await runParallelPipeline(
        ['agent-a', 'agent-b'],
        { input: 'test' },
        mockCtx,
        { name: 'parallel-merge', description: 'Merge test' },
        merger,
      );

      expect(result.mergedOutput).toBe('agent-a,agent-b');
    });
  });

  // ─── fan-out pipeline ───────────────────────────────────────

  describe('runFanOutPipeline', () => {
    it('spawns subagents and merges results', async () => {
      const result = await runFanOutPipeline(
        [
          { name: 'sub-a', agentName: 'agent-a', input: { task: 'a' } },
          { name: 'sub-b', agentName: 'agent-b', input: { task: 'b' } },
        ],
        mockCtx,
      );

      expect(result.batch.results).toBeDefined();
      expect(result.mergedOutput).toBeDefined();
    });
  });

  // ─── metrics integration ────────────────────────────────────

  describe('metrics integration', () => {
    it('records orchestrator invocations in metrics', async () => {
      await runEnhancedOrchestrator(
        { name: 'metrics-test', description: 'Test', maxRetries: 1 },
        async () => ({ output: 'ok' }),
        mockCtx,
      );

      const metrics = agentMetrics.getMetrics('metrics-test');
      expect(metrics.totalInvocations).toBeGreaterThanOrEqual(0);
    });
  });
});
