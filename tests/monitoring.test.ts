/**
 * Tests for agent monitoring & LangSmith dashboard config (lib/agents/monitoring.ts).
 *
 * Verifies:
 * - Health snapshot collection (edge count, node reachability, bridge status)
 * - LangSmith metric payload building
 * - Dashboard / quality gate / alert rule exports
 *
 * @module tests/monitoring.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/agents/shared/runtime', async () => {
  const actual = await vi.importActual('@/lib/agents/shared/runtime');
  return {
    ...(actual as object),
    listAgents: vi.fn(),
  };
});

vi.mock('@/lib/agents/bridge', async () => {
  const actual = await vi.importActual('@/lib/agents/bridge');
  return {
    ...(actual as object),
    getBridgeHealth: vi.fn(),
  };
});

import {
  collectAgentHealthSnapshot,
  buildAgentMetricsPayload,
  getAllDashboards,
  getQualityGates,
  getAlertRules,
  type AgentHealthSnapshot,
} from '@/lib/agents/monitoring';
import { listAgents } from '@/lib/agents/shared/runtime';
import { getBridgeHealth } from '@/lib/agents/bridge';

const ctx = { env: { GEMINI_API_KEY: 'test-key' } };

const edgeAgents = [
  { name: 'content-audit', tier: 'orchestrator' },
  { name: 'intent-router', tier: 'encounter' },
];

function bridgeHealth(reachable: boolean, agentCount: number) {
  return {
    node: {
      reachable,
      agentCount,
      status: (reachable
        ? agentCount > 0
          ? 'ok'
          : 'degraded'
        : 'unavailable') as 'ok' | 'degraded' | 'unavailable',
      latencyMs: 42,
    },
    bridgeEnabled: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAgents).mockReturnValue(edgeAgents as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collectAgentHealthSnapshot()', () => {
  it('reports edge agents and ok bridge when node is reachable', async () => {
    vi.mocked(getBridgeHealth).mockResolvedValue(bridgeHealth(true, 6) as never);

    const snapshot = await collectAgentHealthSnapshot(ctx);

    expect(snapshot.edge.agentCount).toBe(2);
    expect(snapshot.edge.agents.every((a) => a.status === 'registered')).toBe(true);
    expect(snapshot.node.reachable).toBe(true);
    expect(snapshot.node.agentCount).toBe(6);
    expect(snapshot.node.latencyMs).toBe(42);
    expect(snapshot.bridge.status).toBe('ok');
    expect(snapshot.qualityGates.length).toBeGreaterThan(0);
  });

  it('marks bridge degraded when node is reachable with zero agents', async () => {
    vi.mocked(getBridgeHealth).mockResolvedValue(bridgeHealth(true, 0) as never);

    const snapshot = await collectAgentHealthSnapshot(ctx);

    expect(snapshot.bridge.status).toBe('degraded');
  });

  it('marks bridge unavailable when node is unreachable', async () => {
    vi.mocked(getBridgeHealth).mockResolvedValue(bridgeHealth(false, 0) as never);

    const snapshot = await collectAgentHealthSnapshot(ctx);

    expect(snapshot.node.reachable).toBe(false);
    expect(snapshot.bridge.status).toBe('unavailable');
  });
});

describe('buildAgentMetricsPayload()', () => {
  it('emits all five metrics with correct values', () => {
    const snapshot: AgentHealthSnapshot = {
      timestamp: '2026-01-01T00:00:00.000Z',
      edge: { agentCount: 2, agents: [] },
      node: { reachable: true, agentCount: 6, agents: [], latencyMs: 42 },
      bridge: { enabled: true, status: 'ok' },
      qualityGates: [],
    };

    const payload = buildAgentMetricsPayload(snapshot);

    expect(payload.timestamp).toBe(snapshot.timestamp);
    expect(payload.metrics).toHaveLength(5);

    const byName = Object.fromEntries(payload.metrics.map((m) => [m.name, m.value]));
    expect(byName['panacea.agents.edge.count']).toBe(2);
    expect(byName['panacea.agents.node.count']).toBe(6);
    expect(byName['panacea.agents.node.reachable']).toBe(1);
    expect(byName['panacea.agents.bridge.status']).toBe(1);
    expect(byName['panacea.agents.node.latency_ms']).toBe(42);
  });

  it('maps degraded bridge to 0.5 and unreachable to 0', () => {
    const base = {
      timestamp: '2026-01-01T00:00:00.000Z',
      edge: { agentCount: 2, agents: [] },
      node: { reachable: false, agentCount: 0, agents: [], latencyMs: 0 },
      qualityGates: [],
    };

    const degraded = buildAgentMetricsPayload({
      ...base,
      node: { ...base.node, reachable: true, agentCount: 0 },
      bridge: { enabled: true, status: 'degraded' },
    });
    const degradedValue = degraded.metrics.find((m) => m.name === 'panacea.agents.bridge.status')?.value;
    expect(degradedValue).toBe(0.5);

    const unavailable = buildAgentMetricsPayload({
      ...base,
      bridge: { enabled: true, status: 'unavailable' },
    });
    const unavailableValue = unavailable.metrics.find((m) => m.name === 'panacea.agents.bridge.status')?.value;
    expect(unavailableValue).toBe(0);
  });
});

describe('dashboard configuration', () => {
  it('exports both dashboards with charts and filters', () => {
    const dashboards = getAllDashboards();

    expect(dashboards).toHaveLength(2);
    for (const dashboard of dashboards) {
      expect(dashboard.name.length).toBeGreaterThan(0);
      expect(dashboard.charts.length).toBeGreaterThan(0);
      expect(dashboard.filters.length).toBeGreaterThan(0);
    }
  });

  it('exports quality gates with valid operators and thresholds', () => {
    const gates = getQualityGates();

    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) {
      expect(['gte', 'lte']).toContain(gate.operator);
      expect(typeof gate.threshold).toBe('number');
      expect(['critical', 'warning', 'info']).toContain(gate.severity);
    }
  });

  it('exports alert rules with channels and thresholds', () => {
    const rules = getAlertRules();

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.name.length).toBeGreaterThan(0);
      expect(rule.channels.length).toBeGreaterThan(0);
      expect(typeof rule.threshold).toBe('number');
    }
  });
});
