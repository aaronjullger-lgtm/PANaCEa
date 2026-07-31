/**
 * Tests for the unified agent bridge (Edge ↔ Node).
 *
 * Verifies:
 * - Edge agent resolution (in-process)
 * - Node agent discovery (HTTP, mocked)
 * - Fallback when Node orchestrator is unreachable
 * - getAllAgents() returns both Edge and Node agents
 * - getAgentSystemHealth() reports both systems
 *
 * @module tests/agents-unified-bridge.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock the node-client module's fetch calls
vi.mock('@/lib/agents/node-client', async () => {
  const actual = await vi.importActual('@/lib/agents/node-client');
  return {
    ...(actual as object),
    listNodeAgents: vi.fn(),
    invokeNodeAgent: vi.fn(),
    checkNodeOrchestratorHealth: vi.fn(),
  };
});

import { listNodeAgents, invokeNodeAgent, checkNodeOrchestratorHealth } from '@/lib/agents/node-client';
import { clearRegistryForTests } from '@/lib/agents/shared/runtime';

const ctx = { env: { GEMINI_API_KEY: 'test-key' } };

beforeEach(async () => {
  vi.clearAllMocks();
  clearRegistryForTests();
  vi.resetModules();

  // Register a test Edge agent
  await import('@/lib/agents/encounter/standardizedPatient');
  await import('@/lib/agents/encounter/intentRouter');

  // Default: Node orchestrator is unreachable
  vi.mocked(listNodeAgents).mockResolvedValue([]);
  vi.mocked(checkNodeOrchestratorHealth).mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('unified agent bridge', () => {
  describe('getAllAgents()', () => {
    it('returns Edge agents when Node orchestrator is offline', async () => {
      const { getAllAgents } = await import('@/lib/agents/unified');
      const agents = await getAllAgents();

      const edgeAgents = agents.filter((a) => a.source === 'edge');
      expect(edgeAgents.length).toBeGreaterThanOrEqual(2);
      expect(edgeAgents.every((a) => a.status === 'online')).toBe(true);

      const nodeAgents = agents.filter((a) => a.source === 'node');
      expect(nodeAgents.length).toBe(0); // orchestrator offline
    });

    it('returns both Edge and Node agents when orchestrator is online', async () => {
      vi.mocked(listNodeAgents).mockResolvedValue([
        { role: 'content-audit', name: 'Content Audit', description: 'Audit content', inputHint: 'JSON', status: 'online' },
        { role: 'pr-triage', name: 'PR Triage', description: 'Triage PRs', inputHint: 'PR number', status: 'online' },
      ]);

      const { getAllAgents } = await import('@/lib/agents/unified');
      const agents = await getAllAgents();

      const edgeAgents = agents.filter((a) => a.source === 'edge');
      expect(edgeAgents.length).toBeGreaterThanOrEqual(2);

      const nodeAgents = agents.filter((a) => a.source === 'node');
      expect(nodeAgents.length).toBe(2);
      expect(nodeAgents.map((a) => a.name)).toContain('content-audit');
      expect(nodeAgents.map((a) => a.name)).toContain('pr-triage');
    });
  });

  describe('invokeUnifiedAgent()', () => {
    it('resolves Edge agents in-process', async () => {
      const { invokeUnifiedAgent } = await import('@/lib/agents/unified');

      const result = await invokeUnifiedAgent({
        name: 'intent-router',
        input: { studentUtterance: 'test' },
        ctx,
      });

      // Should find the Edge agent (even if it fails on missing AI call, it should be found)
      expect(result.agent).toBe('intent-router');
      // The agent will fail because routeStructured is not mocked here,
      // but the key assertion is that it was found in the Edge registry
      expect(result.status).toBeDefined();
    });

    it('returns error for unknown agent when orchestrator is offline', async () => {
      const { invokeUnifiedAgent } = await import('@/lib/agents/unified');

      const result = await invokeUnifiedAgent({
        name: 'nonexistent-agent',
        input: {},
        ctx,
      });

      expect(result.status).toBe('internal_error');
      expect(result.error?.message).toContain('not found');
      expect(result.error?.message).toContain('nonexistent-agent');
    });

    it('proxies to Node agent when orchestrator is online', async () => {
      vi.mocked(listNodeAgents).mockResolvedValue([
        { role: 'content-audit', name: 'Content Audit', description: 'Audit content', inputHint: 'JSON', status: 'online' },
      ]);
      vi.mocked(invokeNodeAgent).mockResolvedValue({
        status: 'ok',
        output: { findings: ['Issue 1', 'Issue 2'] },
        error: null,
        agent: 'node:content-audit',
        durationMs: 500,
        telemetry: { source: 'node-orchestrator' },
      });

      const { invokeUnifiedAgent } = await import('@/lib/agents/unified');

      const result = await invokeUnifiedAgent({
        name: 'content-audit',
        input: { query: 'audit cardiology content' },
        ctx,
      });

      expect(result.status).toBe('ok');
      expect(result.agent).toBe('node:content-audit');
      expect(result.telemetry?.source).toBe('node-bridge');
      expect(invokeNodeAgent).toHaveBeenCalledWith('content-audit', expect.any(Object), ctx);
    });

    it('returns error when Node agent invocation fails', async () => {
      vi.mocked(listNodeAgents).mockResolvedValue([
        { role: 'pr-triage', name: 'PR Triage', description: 'Triage PRs', inputHint: 'PR number', status: 'online' },
      ]);
      vi.mocked(invokeNodeAgent).mockResolvedValue({
        status: 'internal_error',
        output: null,
        error: { status: 'internal_error', message: 'Orchestrator timeout', cause: 'pr-triage' },
        agent: 'node:pr-triage',
        durationMs: 30000,
      });

      const { invokeUnifiedAgent } = await import('@/lib/agents/unified');

      const result = await invokeUnifiedAgent({
        name: 'pr-triage',
        input: { prNumber: 123 },
        ctx,
      });

      expect(result.status).toBe('internal_error');
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('getAgentSystemHealth()', () => {
    it('reports Edge as healthy and Node as down when offline', async () => {
      const { getAgentSystemHealth } = await import('@/lib/agents/unified');

      const health = await getAgentSystemHealth();

      expect(health.edge.status).toBe('ok');
      expect(health.edge.agentCount).toBeGreaterThanOrEqual(2);
      expect(health.node.status).toBe('down');
      expect(health.node.agentCount).toBe(0);
    });

    it('reports both systems healthy when orchestrator is online', async () => {
      vi.mocked(listNodeAgents).mockResolvedValue([
        { role: 'content-audit', name: 'Content Audit', description: 'Audit', inputHint: 'JSON', status: 'online' },
      ]);
      vi.mocked(checkNodeOrchestratorHealth).mockResolvedValue({
        status: 'ok',
        agents: [{ role: 'content-audit', name: 'Content Audit', description: 'Audit', inputHint: 'JSON', status: 'online' }],
        uptime: 3600,
        version: '2.0.0',
      });

      const { getAgentSystemHealth } = await import('@/lib/agents/unified');

      const health = await getAgentSystemHealth();

      expect(health.edge.status).toBe('ok');
      expect(health.node.status).toBe('ok');
      expect(health.node.agentCount).toBe(1);
    });
  });

  describe('callAgent() convenience', () => {
    it('delegates to invokeUnifiedAgent', async () => {
      const { callAgent } = await import('@/lib/agents/unified');

      const result = await callAgent('intent-router', { studentUtterance: 'test' }, ctx);

      expect(result.agent).toBe('intent-router');
      expect(result.status).toBeDefined();
    });
  });
});

describe('node-client', () => {
  describe('listNodeAgents()', () => {
    it('returns empty array when orchestrator is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const { listNodeAgents: actualListNodeAgents } = await vi.importActual<typeof import('@/lib/agents/node-client')>('@/lib/agents/node-client');
      const agents = await actualListNodeAgents();

      expect(agents).toEqual([]);
    });

    it('returns agents when orchestrator responds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          agents: [
            { role: 'content-audit', name: 'Content Audit', description: 'Audit', inputHint: 'JSON' },
          ],
        }),
      });

      const { listNodeAgents: actualListNodeAgents } = await vi.importActual<typeof import('@/lib/agents/node-client')>('@/lib/agents/node-client');
      const agents = await actualListNodeAgents();

      expect(agents.length).toBe(1);
      expect(agents[0]?.role).toBe('content-audit');
      expect(agents[0]?.status).toBe('online');
    });
  });

  describe('checkNodeOrchestratorHealth()', () => {
    it('returns null when orchestrator is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const { checkNodeOrchestratorHealth: actualCheck } = await vi.importActual<typeof import('@/lib/agents/node-client')>('@/lib/agents/node-client');
      const health = await actualCheck();

      expect(health).toBeNull();
    });

    it('returns health data when orchestrator responds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          agents: [],
          uptime: 3600,
          version: '2.0.0',
        }),
      });

      const { checkNodeOrchestratorHealth: actualCheck } = await vi.importActual<typeof import('@/lib/agents/node-client')>('@/lib/agents/node-client');
      const health = await actualCheck();

      expect(health?.status).toBe('ok');
      expect(health?.uptime).toBe(3600);
    });
  });
});
