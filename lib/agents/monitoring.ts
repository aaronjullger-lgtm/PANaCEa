/**
 * Agent Monitoring & LangSmith Dashboard Configuration
 *
 * Defines production monitoring dashboards, quality gates, and alerting
 * thresholds for PANaCEa's multi-agent system. Integrates with LangSmith
 * for trace-level observability and provides health metrics for both
 * Edge-side (lib/agents/) and Node-side (packages/agent-orchestrator/) agents.
 *
 * @module lib/agents/monitoring
 */

import type { AgentContext } from './shared/types';
import { listAgents } from './shared/runtime';
import { getBridgeHealth } from './bridge';

// ─── Dashboard Configuration ────────────────────────────────────────────────

export interface LangSmithDashboard {
  name: string;
  description: string;
  charts: LangSmithChart[];
  filters: LangSmithFilter[];
}

export interface LangSmithChart {
  id: string;
  title: string;
  type: 'time_series' | 'bar' | 'pie' | 'stat' | 'table';
  metric: string;
  aggregation: 'avg' | 'p95' | 'p99' | 'sum' | 'count';
  groupBy?: string;
  timeRange: '1h' | '24h' | '7d' | '30d';
}

export interface LangSmithFilter {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  value: string;
}

export interface QualityGate {
  metric: string;
  threshold: number;
  operator: 'gte' | 'lte';
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface AlertRule {
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  window: string;
  channels: string[];
  enabled: boolean;
}

// ─── Agent Quality Dashboard ─────────────────────────────────────────────────

export const AGENT_QUALITY_DASHBOARD: LangSmithDashboard = {
  name: 'PANaCEa Agent Quality',
  description: 'Production quality metrics for all PANaCEa agents (Edge + Node)',
  charts: [
    {
      id: 'agent-latency-p95',
      title: 'Agent Latency (P95)',
      type: 'time_series',
      metric: 'duration_ms',
      aggregation: 'p95',
      groupBy: 'agent_name',
      timeRange: '24h',
    },
    {
      id: 'agent-success-rate',
      title: 'Agent Success Rate',
      type: 'time_series',
      metric: 'success_rate',
      aggregation: 'avg',
      groupBy: 'agent_name',
      timeRange: '24h',
    },
    {
      id: 'agent-token-usage',
      title: 'Token Usage by Agent',
      type: 'bar',
      metric: 'total_tokens',
      aggregation: 'sum',
      groupBy: 'agent_name',
      timeRange: '7d',
    },
    {
      id: 'agent-error-count',
      title: 'Agent Errors (24h)',
      type: 'stat',
      metric: 'error_count',
      aggregation: 'sum',
      timeRange: '24h',
    },
    {
      id: 'clinical-accuracy',
      title: 'Clinical Accuracy Score',
      type: 'time_series',
      metric: 'medical_accuracy',
      aggregation: 'avg',
      groupBy: 'agent_name',
      timeRange: '7d',
    },
    {
      id: 'safety-block-rate',
      title: 'Safety Block Rate',
      type: 'time_series',
      metric: 'safety_block_rate',
      aggregation: 'avg',
      groupBy: 'agent_name',
      timeRange: '24h',
    },
    {
      id: 'bridge-health',
      title: 'Edge↔Node Bridge Health',
      type: 'stat',
      metric: 'bridge_reachable',
      aggregation: 'avg',
      timeRange: '1h',
    },
    {
      id: 'agent-invocations',
      title: 'Agent Invocations',
      type: 'bar',
      metric: 'invocation_count',
      aggregation: 'count',
      groupBy: 'agent_name',
      timeRange: '24h',
    },
  ],
  filters: [
    { field: 'environment', operator: 'eq', value: 'production' },
    { field: 'agent_tier', operator: 'neq', value: 'test' },
  ],
};

// ─── Content Quality Dashboard ──────────────────────────────────────────────

export const CONTENT_QUALITY_DASHBOARD: LangSmithDashboard = {
  name: 'PANaCEa Content Quality',
  description: 'Quality metrics for AI-generated clinical content',
  charts: [
    {
      id: 'question-generation-quality',
      title: 'Question Generation Quality',
      type: 'time_series',
      metric: 'quality_score',
      aggregation: 'avg',
      groupBy: 'organ_system',
      timeRange: '7d',
    },
    {
      id: 'content-validation-rate',
      title: 'Content Validation Pass Rate',
      type: 'time_series',
      metric: 'validation_pass_rate',
      aggregation: 'avg',
      timeRange: '7d',
    },
    {
      id: 'blueprint-coverage',
      title: 'NCCPA Blueprint Coverage',
      type: 'pie',
      metric: 'question_count',
      aggregation: 'sum',
      groupBy: 'organ_system',
      timeRange: '30d',
    },
    {
      id: 'generation-latency',
      title: 'Generation Latency (P95)',
      type: 'stat',
      metric: 'generation_duration_ms',
      aggregation: 'p95',
      timeRange: '24h',
    },
  ],
  filters: [
    { field: 'task_type', operator: 'contains', value: 'generation' },
  ],
};

// ─── Quality Gates ──────────────────────────────────────────────────────────

export const AGENT_QUALITY_GATES: QualityGate[] = [
  {
    metric: 'success_rate',
    threshold: 0.95,
    operator: 'gte',
    severity: 'critical',
    description: 'Agent success rate must be ≥ 95%',
  },
  {
    metric: 'medical_accuracy',
    threshold: 0.90,
    operator: 'gte',
    severity: 'critical',
    description: 'Clinical accuracy must be ≥ 90% for encounter agents',
  },
  {
    metric: 'latency_p95_ms',
    threshold: 5000,
    operator: 'lte',
    severity: 'warning',
    description: 'P95 latency should be ≤ 5s for interactive agents',
  },
  {
    metric: 'safety_block_rate',
    threshold: 0.05,
    operator: 'lte',
    severity: 'warning',
    description: 'Safety block rate should be ≤ 5%',
  },
  {
    metric: 'error_rate',
    threshold: 0.02,
    operator: 'lte',
    severity: 'critical',
    description: 'Error rate must be ≤ 2%',
  },
  {
    metric: 'token_cost_per_day',
    threshold: 5.00,
    operator: 'lte',
    severity: 'info',
    description: 'Daily token cost should stay under $5',
  },
];

// ─── Alert Rules ────────────────────────────────────────────────────────────

export const AGENT_ALERT_RULES: AlertRule[] = [
  {
    name: 'Agent Success Rate Drop',
    metric: 'success_rate',
    condition: 'drop > 10% in 1h',
    threshold: 0.85,
    window: '1h',
    channels: ['langsmith-dashboard', 'linear-issue'],
    enabled: true,
  },
  {
    name: 'Clinical Accuracy Degradation',
    metric: 'medical_accuracy',
    condition: 'drop > 5% in 24h',
    threshold: 0.85,
    window: '24h',
    channels: ['langsmith-dashboard', 'linear-issue'],
    enabled: true,
  },
  {
    name: 'High Latency Spike',
    metric: 'latency_p95_ms',
    condition: '> 10000ms sustained for 15min',
    threshold: 10000,
    window: '15m',
    channels: ['langsmith-dashboard'],
    enabled: true,
  },
  {
    name: 'Bridge Unreachable',
    metric: 'bridge_reachable',
    condition: 'false for > 5min',
    threshold: 0,
    window: '5m',
    channels: ['langsmith-dashboard', 'linear-issue'],
    enabled: true,
  },
  {
    name: 'Token Cost Spike',
    metric: 'token_cost_per_hour',
    condition: '> $2 in 1h',
    threshold: 2.00,
    window: '1h',
    channels: ['langsmith-dashboard'],
    enabled: true,
  },
];

// ─── Health Metrics Collection ──────────────────────────────────────────────

export interface AgentHealthSnapshot {
  timestamp: string;
  edge: {
    agentCount: number;
    agents: Array<{ name: string; tier: string; status: 'registered' }>;
  };
  node: {
    reachable: boolean;
    agentCount: number;
    agents: Array<{ role: string; name: string; status: string }>;
    latencyMs: number;
  };
  bridge: {
    enabled: boolean;
    status: 'ok' | 'degraded' | 'unavailable';
  };
  qualityGates: Array<{
    metric: string;
    threshold: number;
    current?: number;
    passing: boolean;
  }>;
}

export async function collectAgentHealthSnapshot(
  ctx?: AgentContext,
): Promise<AgentHealthSnapshot> {
  const edgeAgents = listAgents();
  const bridgeHealth = await getBridgeHealth();

  const snapshot: AgentHealthSnapshot = {
    timestamp: new Date().toISOString(),
    edge: {
      agentCount: edgeAgents.length,
      agents: edgeAgents.map((a) => ({
        name: a.name,
        tier: a.tier,
        status: 'registered' as const,
      })),
    },
    node: {
      reachable: bridgeHealth.node.reachable,
      agentCount: bridgeHealth.node.agentCount,
      agents: [],
      latencyMs: bridgeHealth.node.latencyMs,
    },
    bridge: {
      enabled: bridgeHealth.bridgeEnabled,
      status: bridgeHealth.node.reachable
        ? bridgeHealth.node.agentCount > 0
          ? 'ok'
          : 'degraded'
        : 'unavailable',
    },
    qualityGates: AGENT_QUALITY_GATES.map((gate) => ({
      metric: gate.metric,
      threshold: gate.threshold,
      passing: true, // Will be updated with real metrics from LangSmith API
    })),
  };

  ctx?.log?.('info', 'Agent health snapshot collected', {
    edgeCount: snapshot.edge.agentCount,
    nodeReachable: snapshot.node.reachable,
    bridgeStatus: snapshot.bridge.status,
  });

  return snapshot;
}

// ─── LangSmith Metric Export ────────────────────────────────────────────────

export interface LangSmithMetricPayload {
  timestamp: string;
  metrics: Array<{
    name: string;
    value: number;
    tags: Record<string, string>;
  }>;
}

export function buildAgentMetricsPayload(
  snapshot: AgentHealthSnapshot,
): LangSmithMetricPayload {
  const metrics: LangSmithMetricPayload['metrics'] = [];

  metrics.push({
    name: 'panacea.agents.edge.count',
    value: snapshot.edge.agentCount,
    tags: { source: 'edge' },
  });

  metrics.push({
    name: 'panacea.agents.node.count',
    value: snapshot.node.agentCount,
    tags: { source: 'node' },
  });

  metrics.push({
    name: 'panacea.agents.node.reachable',
    value: snapshot.node.reachable ? 1 : 0,
    tags: { source: 'node' },
  });

  metrics.push({
    name: 'panacea.agents.bridge.status',
    value: snapshot.bridge.status === 'ok' ? 1 : snapshot.bridge.status === 'degraded' ? 0.5 : 0,
    tags: { component: 'bridge' },
  });

  metrics.push({
    name: 'panacea.agents.node.latency_ms',
    value: snapshot.node.latencyMs,
    tags: { source: 'node', metric: 'latency' },
  });

  return {
    timestamp: snapshot.timestamp,
    metrics,
  };
}

// ─── Dashboard Export ───────────────────────────────────────────────────────

export function getAllDashboards(): LangSmithDashboard[] {
  return [AGENT_QUALITY_DASHBOARD, CONTENT_QUALITY_DASHBOARD];
}

export function getQualityGates(): QualityGate[] {
  return AGENT_QUALITY_GATES;
}

export function getAlertRules(): AlertRule[] {
  return AGENT_ALERT_RULES;
}
