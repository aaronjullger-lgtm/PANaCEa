/**
 * Unified Agent Bridge
 *
 * Single dispatch surface that routes agent invocations to the correct
 * backend across all three PANaCEa agent systems:
 *
 *   1. Edge agents (lib/agents/) — LangGraph-based, typed I/O contracts
 *   2. Tool-loop agents (lib/services/agents/) — Gemini-native ReAct loop
 *   3. Node agents (packages/agent-orchestrator/) — separate Node.js process
 *
 * Resolution order:
 *   1. 'tool:' prefix → tool-loop agent
 *   2. 'node:' prefix → Node orchestrator agent
 *   3. Edge registry lookup → Edge agent
 *   4. Known tool-loop name → tool-loop agent
 *   5. Fallback → Node orchestrator
 *
 * Architecture:
 *   invokeBridge({ agent, input, ctx })
 *     → resolveAgent(agent)
 *       → 'edge'    → getAgent(name).invoke(input, ctx)
 *       → 'tool-loop' → runAgent({ userMessage, registry, config, ... })
 *       → 'node'    → HTTP POST /api/agents/invoke
 *
 * @module lib/agents/bridge
 */

import type { AgentContext, InvokeResult, AgentStatus } from './shared/types';
import type { AgentRunConfig, AgentRunResult, ToolExecutionContext } from '../services/agents/types';
import type { AgentTurnContext } from '../services/agents/geminiAgentClient';

// ─── Types ─────────────────────────────────────────────────────────────────

export type AgentBackend = 'edge' | 'tool-loop' | 'node';

export interface BridgeResolveResult {
  backend: AgentBackend;
  agentName: string;
  /** Edge agent definition if backend is 'edge'. */
  edgeDef?: import('./shared/types').AgentDefinition;
  /** Whether this is a tool-loop agent. */
  isToolLoop?: boolean;
}

export interface BridgeInvokeOptions {
  /** Agent name (supports 'tool:' and 'node:' prefixes). */
  agent: string;
  /** Input payload. */
  input: unknown;
  /** Agent context (env, userId, signal, log). */
  ctx: AgentContext;
  /** Optional trace metadata. */
  trace?: {
    name: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    sessionId?: string;
  };
  /** Tool-loop specific: run configuration. */
  toolLoopConfig?: AgentRunConfig;
  /** Tool-loop specific: execution context. */
  toolLoopContext?: ToolExecutionContext;
  /** Tool-loop specific: Gemini call context. */
  toolLoopGeminiContext?: AgentTurnContext;
}

export interface NodeAgentInfo {
  name: string;
  description: string;
  role: string;
  tier: 'orchestrator' | 'ops';
  inputHint: string;
  status: 'available' | 'unavailable' | 'degraded';
}

export interface NodeAgentInvokeRequest {
  agentRole: string;
  input: unknown;
  threadId?: string;
  model?: string;
}

export interface NodeAgentInvokeResponse {
  messages: Array<{ role: string; content: string }>;
  agentRole: string;
  durationMs: number;
  tokensUsed?: { input: number; output: number; total: number };
}

export interface BridgeConfig {
  /** Base URL of the Node orchestrator API (e.g. http://localhost:3002 or https://agents.panacea.internal) */
  orchestratorBaseUrl: string;
  /** API key for authenticating with the orchestrator */
  apiKey?: string;
  /** Timeout for HTTP requests (ms) */
  timeoutMs: number;
  /** Whether the bridge is enabled */
  enabled: boolean;
}

// ─── Known Tool-Loop Agents ─────────────────────────────────────────────────

/**
 * Agent names that route to the Gemini-native ReAct tool-loop
 * (lib/services/agents/) even without the 'tool:' prefix.
 */
const KNOWN_TOOL_LOOP_AGENTS = new Set([
  'clinical-study-agent',
  'content-quality-agent',
  'coverage-audit-agent',
  'infra-health-agent',
]);

// ─── Agent Resolution ──────────────────────────────────────────────────────

/**
 * Resolve an agent name to its backend and definition.
 * Does NOT invoke — callers use the result to dispatch.
 */
export function resolveAgent(name: string): BridgeResolveResult {
  // Explicit tool-loop prefix
  if (name.startsWith('tool:')) {
    return { backend: 'tool-loop', agentName: name.slice(5), isToolLoop: true };
  }

  // Explicit node prefix
  if (name.startsWith('node:')) {
    return { backend: 'node', agentName: name.slice(5) };
  }

  // Check Edge registry (lazy import to avoid circular deps)
  const { getAgent } = require('./shared/runtime') as { getAgent: (n: string) => import('./shared/types').AgentDefinition | undefined };
  const edgeDef = getAgent(name);
  if (edgeDef) {
    return { backend: 'edge', agentName: name, edgeDef };
  }

  // Check known tool-loop agent names
  if (KNOWN_TOOL_LOOP_AGENTS.has(name)) {
    return { backend: 'tool-loop', agentName: name, isToolLoop: true };
  }

  // Fall through to Node orchestrator
  return { backend: 'node', agentName: name };
}

/**
 * List all available agents across all backends.
 */
export function listAllAgents(): Array<{
  name: string;
  description: string;
  backend: AgentBackend;
  tier?: string;
}> {
  const agents: Array<{
    name: string;
    description: string;
    backend: AgentBackend;
    tier?: string;
  }> = [];

  // Edge agents
  try {
    const { listAgents } = require('./shared/runtime') as { listAgents: () => ReadonlyArray<{ name: string; description: string; tier: string }> };
    for (const a of listAgents()) {
      agents.push({ name: a.name, description: a.description, backend: 'edge', tier: a.tier });
    }
  } catch { /* registry not loaded yet */ }

  // Tool-loop agents
  for (const name of KNOWN_TOOL_LOOP_AGENTS) {
    agents.push({
      name: `tool:${name}`,
      description: `Gemini-native ReAct agent: ${name}`,
      backend: 'tool-loop',
    });
  }

  // Node agents (static list; dynamic discovery via discoverNodeAgents())
  const nodeAgentNames = [
    'content-audit', 'pr-triage', 'incident-responder',
    'content-enrichment', 'weekly-report',
  ];
  for (const name of nodeAgentNames) {
    agents.push({
      name: `node:${name}`,
      description: `Node orchestrator agent: ${name}`,
      backend: 'node',
    });
  }

  return agents;
}

// ─── Unified Invocation ────────────────────────────────────────────────────

/**
 * Invoke an agent through the unified bridge.
 * Routes to the correct backend based on agent name resolution.
 */
export async function invokeBridge(
  options: BridgeInvokeOptions,
): Promise<InvokeResult<unknown>> {
  const resolved = resolveAgent(options.agent);
  const start = Date.now();

  switch (resolved.backend) {
    case 'edge':
      return invokeEdgeAgent(resolved, options, start);
    case 'tool-loop':
      return invokeToolLoopAgent(resolved, options, start);
    case 'node':
      return invokeNodeAgentBridge(resolved, options, start);
    default:
      return {
        status: 'internal_error' as AgentStatus,
        output: null,
        error: { status: 'internal_error' as AgentStatus, message: `Unknown backend: ${resolved.backend}`, cause: options.agent },
        agent: options.agent,
        durationMs: Date.now() - start,
      };
  }
}

async function invokeEdgeAgent(
  resolved: BridgeResolveResult,
  options: BridgeInvokeOptions,
  start: number,
): Promise<InvokeResult<unknown>> {
  const def = resolved.edgeDef;
  if (!def) {
    return {
      status: 'internal_error' as AgentStatus,
      output: null,
      error: { status: 'internal_error' as AgentStatus, message: `Edge agent not found: ${resolved.agentName}`, cause: resolved.agentName },
      agent: options.agent,
      durationMs: Date.now() - start,
    };
  }

  try {
    const result = await def.invoke(options.input, options.ctx);
    return {
      ...result,
      durationMs: Date.now() - start,
      telemetry: { ...result.telemetry, backend: 'edge', agentTier: def.tier },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'internal_error' as AgentStatus,
      output: null,
      error: { status: 'internal_error' as AgentStatus, message, cause: def.name },
      agent: options.agent,
      durationMs: Date.now() - start,
    };
  }
}

async function invokeToolLoopAgent(
  resolved: BridgeResolveResult,
  options: BridgeInvokeOptions,
  start: number,
): Promise<InvokeResult<unknown>> {
  try {
    const { runAgent } = await import('../services/agents/agentRunner');
    const { createDefaultToolRegistry } = await import('../services/agents/tools');

    const registry = createDefaultToolRegistry();
    const config: AgentRunConfig = options.toolLoopConfig ?? {
      allowedTools: ['clinical_library_search', 'user_progress_summary', 'fsrs_due_count'],
      allowedCategories: ['read', 'compute'],
      maxIterations: 6,
    };

    const toolContext: ToolExecutionContext = options.toolLoopContext ?? {
      userId: options.ctx.userId ?? 'anonymous',
      env: options.ctx.env as Record<string, unknown>,
      signal: options.ctx.signal,
      log: options.ctx.log,
    };

    const geminiContext: AgentTurnContext = options.toolLoopGeminiContext ?? {
      env: options.ctx.env as Record<string, unknown>,
      waitUntil: undefined,
    };

    const userMessage = typeof options.input === 'string'
      ? options.input
      : JSON.stringify(options.input);

    const result: AgentRunResult = await runAgent({
      userMessage,
      registry,
      config,
      toolContext,
      geminiContext,
    });

    const status: AgentStatus = result.stopReason === 'completed' ? 'ok'
      : result.stopReason === 'safety_block' ? 'safety_blocked'
      : 'internal_error';

    return {
      status,
      output: { finalText: result.finalText, steps: result.steps, iterations: result.iterations, tokensUsed: result.tokensUsed, stopReason: result.stopReason },
      error: result.error ? { status: 'internal_error' as AgentStatus, message: result.error.message, cause: result.error.code } : null,
      agent: options.agent,
      durationMs: Date.now() - start,
      telemetry: { backend: 'tool-loop', iterations: result.iterations, tokensUsed: result.tokensUsed },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'internal_error' as AgentStatus,
      output: null,
      error: { status: 'internal_error' as AgentStatus, message, cause: 'tool-loop-import' },
      agent: options.agent,
      durationMs: Date.now() - start,
    };
  }
}

async function invokeNodeAgentBridge(
  resolved: BridgeResolveResult,
  options: BridgeInvokeOptions,
  start: number,
): Promise<InvokeResult<unknown>> {
  return invokeNodeAgent(resolved.agentName, options.input, options.ctx);
}

// ─── Default Config ────────────────────────────────────────────────────────

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  orchestratorBaseUrl: 'http://localhost:3002',
  timeoutMs: 10_000,
  enabled: false,
};

let bridgeConfig: BridgeConfig = { ...DEFAULT_BRIDGE_CONFIG };

// ─── Bridge API ────────────────────────────────────────────────────────────

/**
 * Configure the Edge↔Node bridge. Call once at startup.
 */
export function configureBridge(config: Partial<BridgeConfig>): void {
  bridgeConfig = { ...bridgeConfig, ...config };
}

/**
 * Get current bridge configuration.
 */
export function getBridgeConfig(): Readonly<BridgeConfig> {
  return bridgeConfig;
}

/**
 * Check if the Node orchestrator is reachable.
 */
export async function pingOrchestrator(): Promise<{
  reachable: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!bridgeConfig.enabled) {
    return { reachable: false, latencyMs: 0, error: 'Bridge disabled' };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${bridgeConfig.orchestratorBaseUrl}/health`, {
      method: 'GET',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(bridgeConfig.timeoutMs),
    });

    return {
      reachable: response.ok,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Discover all available Node-side agents.
 * Returns an empty array if the bridge is disabled or unreachable.
 */
export async function discoverNodeAgents(): Promise<NodeAgentInfo[]> {
  if (!bridgeConfig.enabled) return [];

  try {
    const response = await fetch(`${bridgeConfig.orchestratorBaseUrl}/api/agents/list`, {
      method: 'GET',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(bridgeConfig.timeoutMs),
    });

    if (!response.ok) {
      console.warn(`[agent-bridge] Agent discovery failed: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json() as { agents: NodeAgentInfo[] };
    return data.agents ?? [];
  } catch (err) {
    console.warn('[agent-bridge] Agent discovery error:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Invoke a Node-side agent via the orchestrator API.
 */
export async function invokeNodeAgent(
  agentRole: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  const start = Date.now();

  if (!bridgeConfig.enabled) {
    return {
      status: 'internal_error',
      output: null,
      error: {
        status: 'internal_error',
        message: 'Node agent bridge is disabled',
        cause: 'bridge_disabled',
      },
      agent: agentRole,
      durationMs: 0,
    };
  }

  try {
    const requestBody: NodeAgentInvokeRequest = {
      agentRole,
      input,
      threadId: ctx.userId ?? undefined,
    };

    const response = await fetch(`${bridgeConfig.orchestratorBaseUrl}/api/agents/invoke`, {
      method: 'POST',
      headers: {
        ...buildHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: ctx.signal ?? AbortSignal.timeout(bridgeConfig.timeoutMs),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        status: 'internal_error',
        output: null,
        error: {
          status: 'internal_error',
          message: `Node agent invocation failed: HTTP ${response.status} — ${errorBody.slice(0, 200)}`,
          cause: agentRole,
        },
        agent: agentRole,
        durationMs: Date.now() - start,
      };
    }

    const result = await response.json() as NodeAgentInvokeResponse;

    // Extract the final assistant response
    const finalMessage = [...result.messages].reverse().find(
      (m) => m.role === 'ai' || m.role === 'assistant',
    );

    return {
      status: 'ok',
      output: {
        messages: result.messages,
        finalResponse: finalMessage?.content ?? '',
        agentRole: result.agentRole,
        tokensUsed: result.tokensUsed,
      },
      error: null,
      agent: agentRole,
      durationMs: Date.now() - start,
      telemetry: {
        nodeAgentRole: result.agentRole,
        nodeDurationMs: result.durationMs,
        tokensUsed: result.tokensUsed,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'internal_error',
      output: null,
      error: {
        status: 'internal_error',
        message: `Node agent bridge error: ${message}`,
        cause: agentRole,
      },
      agent: agentRole,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Get combined agent health status across Edge and Node systems.
 */
export async function getBridgeHealth(): Promise<{
  edge: { agentCount: number; status: 'ok' | 'degraded' };
  node: { reachable: boolean; agentCount: number; status: 'ok' | 'unavailable' | 'degraded'; latencyMs: number };
  bridgeEnabled: boolean;
}> {
  const { listAgents } = await import('./shared/runtime');
  const edgeAgents = listAgents();

  const ping = await pingOrchestrator();
  let nodeAgents: NodeAgentInfo[] = [];
  if (ping.reachable) {
    nodeAgents = await discoverNodeAgents();
  }

  return {
    edge: {
      agentCount: edgeAgents.length,
      status: edgeAgents.length > 0 ? 'ok' : 'degraded',
    },
    node: {
      reachable: ping.reachable,
      agentCount: nodeAgents.length,
      status: ping.reachable
        ? nodeAgents.length > 0
          ? 'ok'
          : 'degraded'
        : 'unavailable',
      latencyMs: ping.latencyMs,
    },
    bridgeEnabled: bridgeConfig.enabled,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'PANaCEa-Edge-Agent-Bridge/1.0',
  };

  if (bridgeConfig.apiKey) {
    headers['Authorization'] = `Bearer ${bridgeConfig.apiKey}`;
  }

  return headers;
}
