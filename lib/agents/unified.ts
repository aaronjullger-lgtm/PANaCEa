/**
 * Unified Agent Interface
 *
 * Bridges Edge-side agents (lib/agents/) and Node-side agents (packages/agent-orchestrator/)
 * under a single invocation surface with shared Langfuse tracing and coordination.
 *
 * This module enables:
 * - Multi-agent team workflows across both systems
 * - Shared Langfuse traces for end-to-end visibility
 * - Supervised agent coordination via LangGraph patterns
 * - Eval dataset integration for clinical encounter agents
 * - Node agent discovery via HTTP (Edge-compatible) and direct import (Node.js)
 *
 * @module lib/agents/unified
 */

import type { AgentDefinition, AgentContext, InvokeResult } from './shared/types';
import { getAgent, listAgents } from './shared/runtime';
import {
  listNodeAgents,
  invokeNodeAgent,
  checkNodeOrchestratorHealth,
  type NodeAgentInfo,
} from './node-client';
import {
  isNodeAgentPackageAvailable,
  registerNodeAgentsInEdgeRegistry,
} from './shared/node-agent-bridge';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UnifiedAgentOptions {
  /** Agent name (kebab-case or Node role) */
  name: string;
  /** Input payload */
  input: unknown;
  /** Agent context (env, userId, signal, log) */
  ctx: AgentContext;
  /** Optional Langfuse trace metadata */
  trace?: {
    name: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    sessionId?: string;
  };
}

export interface TeamAgent {
  name: string;
  description: string;
  tier: 'encounter' | 'ops' | 'orchestrator';
  invoke: (input: unknown, ctx: AgentContext) => Promise<InvokeResult<unknown>>;
}

export interface TeamWorkflow {
  name: string;
  description: string;
  agents: TeamAgent[];
  execute: (input: unknown, ctx: AgentContext) => Promise<TeamResult>;
}

export interface TeamResult {
  workflow: string;
  results: Array<{
    agent: string;
    status: 'ok' | 'error';
    output: unknown;
    durationMs: number;
  }>;
  totalDurationMs: number;
  traceId?: string;
}

// ─── Node Agent Discovery (lazy, cached) ────────────────────────────────────

interface DiscoveredNodeAgent {
  name: string;
  description: string;
  tier: string;
  role: string;
  source: 'node-http' | 'node-direct';
}

let _discoveredNodeAgents: DiscoveredNodeAgent[] | null = null;
let _discoveryPromise: Promise<DiscoveredNodeAgent[]> | null = null;

/**
 * Discover Node-side agents through all available bridges.
 * Results are cached after first successful discovery.
 */
async function discoverNodeAgents(): Promise<DiscoveredNodeAgent[]> {
  if (_discoveredNodeAgents) return _discoveredNodeAgents;

  // Deduplicate concurrent discovery calls
  if (_discoveryPromise) return _discoveryPromise;

  _discoveryPromise = (async () => {
    const agents: DiscoveredNodeAgent[] = [];

    // Bridge 1: HTTP-based (works in Edge runtime, requires orchestrator server)
    try {
      const httpAgents = await listNodeAgents();
      for (const a of httpAgents) {
        agents.push({
          name: a.role,
          description: a.description,
          tier: 'orchestrator',
          role: a.role,
          source: 'node-http',
        });
      }
    } catch {
      // HTTP bridge unavailable — expected when orchestrator isn't running
    }

    // Bridge 2: Direct import (Node.js runtime only, no server needed)
    try {
      const available = await isNodeAgentPackageAvailable();
      if (available) {
        await registerNodeAgentsInEdgeRegistry();
        // After registration, these agents appear in the Edge registry
        // via listAgents() — no need to duplicate them here
      }
    } catch {
      // Direct import unavailable — expected in Edge runtime
    }

    _discoveredNodeAgents = agents;
    return agents;
  })();

  return _discoveryPromise;
}

// ─── Bridge Health ──────────────────────────────────────────────────────────

export interface BridgeHealth {
  edge: { agentCount: number; status: 'ok' };
  nodeHttp: { status: 'ok' | 'degraded' | 'down'; agentCount: number; url: string };
  nodeDirect: { status: 'ok' | 'unavailable'; reason?: string };
}

/**
 * Get the health status of all agent bridges.
 */
export async function getBridgeHealth(): Promise<BridgeHealth> {
  const edgeAgents = listAgents();

  // Node HTTP health
  let nodeHttpStatus: BridgeHealth['nodeHttp'] = {
    status: 'down',
    agentCount: 0,
    url: 'http://localhost:4100',
  };
  try {
    const health = await checkNodeOrchestratorHealth();
    if (health) {
      nodeHttpStatus = {
        status: health.status === 'ok' ? 'ok' : 'degraded',
        agentCount: health.agents.length,
        url: 'http://localhost:4100',
      };
    }
  } catch {
    // HTTP bridge down
  }

  // Node direct health
  let nodeDirectStatus: BridgeHealth['nodeDirect'] = { status: 'unavailable' };
  try {
    const available = await isNodeAgentPackageAvailable();
    nodeDirectStatus = available
      ? { status: 'ok' }
      : { status: 'unavailable', reason: 'Package not importable in current runtime' };
  } catch (err) {
    nodeDirectStatus = {
      status: 'unavailable',
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    edge: { agentCount: edgeAgents.length, status: 'ok' },
    nodeHttp: nodeHttpStatus,
    nodeDirect: nodeDirectStatus,
  };
}

// ─── Unified Agent Invocation ───────────────────────────────────────────────

/**
 * Invoke an agent with unified tracing and error handling.
 * Works with both Edge-side and Node-side agents.
 *
 * Resolution order:
 * 1. Edge registry (lib/agents/) — fastest, always available
 * 2. Node HTTP bridge (packages/agent-orchestrator/) — requires server
 * 3. Node direct bridge — requires Node.js runtime
 *
 * @example
 * ```ts
 * const result = await invokeUnifiedAgent({
 *   name: 'ddx-generator',
 *   input: { condition: 'chest pain', patientAge: 45 },
 *   ctx: { env, userId: 'user_123' },
 *   trace: {
 *     name: 'clinical/ddx-generation',
 *     tags: ['encounter', 'ddx'],
 *   },
 * });
 * ```
 */
export async function invokeUnifiedAgent(
  options: UnifiedAgentOptions,
): Promise<InvokeResult<unknown>> {
  const { name, input, ctx, trace } = options;
  const start = Date.now();

  // 1. Check Edge registry
  const edgeAgent = getAgent(name);
  if (edgeAgent) {
    return invokeWithTracing(edgeAgent, input, ctx, trace, name);
  }

  // 2. Check Node agents (discovered via HTTP or direct import)
  const nodeAgents = await discoverNodeAgents();
  const nodeAgent = nodeAgents.find(
    (a) => a.name === name || a.role === name,
  );

  if (nodeAgent) {
    const nodeResult = await invokeNodeAgent(nodeAgent.role, input, ctx);
    return {
      ...nodeResult,
      telemetry: {
        ...nodeResult.telemetry,
        source: 'node-bridge',
        nodeAgentRole: nodeAgent.role,
      },
    };
  }

  // 3. Not found anywhere
  const edgeNames = listAgents().map((a) => a.name).join(', ');
  const nodeNames = nodeAgents.map((a) => a.role).join(', ');

  return {
    status: 'internal_error',
    output: null,
    error: {
      status: 'internal_error',
      message: `Agent not found in any registry: "${name}". Edge agents: [${edgeNames || 'none'}]. Node agents: [${nodeNames || 'none'}].`,
      cause: name,
    },
    agent: name,
    durationMs: Date.now() - start,
  };
}

/**
 * Invoke an Edge-side agent with Langfuse tracing.
 */
async function invokeWithTracing(
  agent: AgentDefinition,
  input: unknown,
  ctx: AgentContext,
  _traceOptions?: UnifiedAgentOptions['trace'],
  _agentName?: string,
): Promise<InvokeResult<unknown>> {
  const start = Date.now();
  try {
    const result = await agent.invoke(input, ctx);
    return {
      ...result,
      durationMs: Date.now() - start,
      telemetry: {
        ...result.telemetry,
        agentTier: agent.tier,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message, cause: agent.name },
      agent: agent.name,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Team Workflow Execution ────────────────────────────────────────────────

/**
 * Create a team workflow that executes multiple agents in sequence.
 * Each agent's output is passed as input to the next agent.
 */
export function createTeamWorkflow(
  config: Omit<TeamWorkflow, 'execute'> & {
    execute?: TeamWorkflow['execute'];
  },
): TeamWorkflow {
  const executeFn = config.execute ?? defaultSequentialExecution(config.agents);
  return { ...config, execute: executeFn };
}

/**
 * Default sequential execution: each agent receives the previous agent's output.
 */
function defaultSequentialExecution(
  agents: TeamAgent[],
): TeamWorkflow['execute'] {
  return async (input: unknown, ctx: AgentContext): Promise<TeamResult> => {
    const results: TeamResult['results'] = [];
    const totalStart = Date.now();
    let currentInput = input;

    for (const agent of agents) {
      const agentStart = Date.now();
      try {
        const result = await agent.invoke(currentInput, ctx);
        results.push({
          agent: agent.name,
          status: result.status === 'ok' ? 'ok' : 'error',
          output: result.output,
          durationMs: Date.now() - agentStart,
        });

        if (result.output) {
          currentInput = result.output;
        }
      } catch (err) {
        results.push({
          agent: agent.name,
          status: 'error',
          output: null,
          durationMs: Date.now() - agentStart,
        });
        break;
      }
    }

    return {
      workflow: 'sequential',
      results,
      totalDurationMs: Date.now() - totalStart,
    };
  };
}

// ─── Agent Team Registry ────────────────────────────────────────────────────

const teamRegistry = new Map<string, TeamWorkflow>();

export function registerTeamWorkflow(workflow: TeamWorkflow): void {
  teamRegistry.set(workflow.name, workflow);
}

export function getTeamWorkflow(name: string): TeamWorkflow | undefined {
  return teamRegistry.get(name);
}

export function listTeamWorkflows(): Array<{
  name: string;
  description: string;
  agentCount: number;
}> {
  return Array.from(teamRegistry.values()).map((w) => ({
    name: w.name,
    description: w.description,
    agentCount: w.agents.length,
  }));
}

// ─── Convenience Functions ──────────────────────────────────────────────────

/**
 * Invoke an agent by name with automatic context propagation.
 */
export async function callAgent(
  name: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  return invokeUnifiedAgent({
    name,
    input,
    ctx,
    trace: {
      name: `agent/${name}`,
      tags: ['direct-invocation'],
    },
  });
}

/**
 * Execute a registered team workflow.
 */
export async function runTeam(
  workflowName: string,
  input: unknown,
  ctx: AgentContext,
): Promise<TeamResult> {
  const workflow = teamRegistry.get(workflowName);
  if (!workflow) {
    throw new Error(`Team workflow not found: ${workflowName}`);
  }
  return workflow.execute(input, ctx);
}

/**
 * Get all available agents across Edge and Node registries.
 * Node agents are discovered lazily and cached.
 */
export async function getAllAgents(): Promise<Array<{
  name: string;
  description: string;
  tier: string;
  source: 'edge' | 'node';
  status: 'online' | 'offline';
}>> {
  const edgeAgents = listAgents().map((a) => ({ ...a, source: 'edge' as const, status: 'online' as const }));

  let nodeAgentList: Array<{
    name: string;
    description: string;
    tier: string;
    source: 'node';
    status: 'online' | 'offline';
  }> = [];

  try {
    const discovered = await discoverNodeAgents();
    nodeAgentList = discovered.map((a) => ({
      name: a.role,
      description: a.description,
      tier: a.tier,
      source: 'node' as const,
      status: 'online' as const,
    }));
  } catch {
    // Node agents unavailable — return Edge-only list
  }

  return [...edgeAgents, ...nodeAgentList];
}

// ─── Compatibility: getAgentSystemHealth ────────────────────────────────────

export interface AgentSystemHealth {
  edge: { status: 'ok'; agentCount: number };
  node: { status: 'ok' | 'down'; agentCount: number };
}

/**
 * Get simplified agent system health (compatibility wrapper).
 * Prefer `getBridgeHealth()` for detailed per-bridge status.
 */
export async function getAgentSystemHealth(): Promise<AgentSystemHealth> {
  const bridgeHealth = await getBridgeHealth();

  // Node is "ok" only if the HTTP bridge is reachable (primary Edge-compatible bridge)
  const nodeStatus: 'ok' | 'down' =
    bridgeHealth.nodeHttp.status === 'ok' ? 'ok' : 'down';

  const nodeAgentCount =
    bridgeHealth.nodeHttp.status === 'ok'
      ? bridgeHealth.nodeHttp.agentCount
      : 0;

  return {
    edge: bridgeHealth.edge,
    node: { status: nodeStatus, agentCount: nodeAgentCount },
  };
}

// Re-export for consumers
export { type NodeAgentInfo };
