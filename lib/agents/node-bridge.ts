/**
 * Node Agent Bridge
 *
 * Bridges Edge-side agent invocation (lib/agents/) to Node-side agents
 * (packages/agent-orchestrator/). Enables invokeUnifiedAgent to route
 * to both systems transparently.
 *
 * Two discovery strategies (tried in order):
 *   1. HTTP bridge — queries the orchestrator's REST API (production)
 *   2. Direct import — loads the orchestrator package directly (local dev)
 *
 * On Edge runtime, only the HTTP bridge is available. On Node.js, both
 * strategies work, with HTTP preferred for consistency with production.
 *
 * @module lib/agents/node-bridge
 */

import type { AgentDefinition, AgentContext, InvokeResult } from './shared/types';
import { registerAgent } from './shared/runtime';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Shape of a Node-side agent as exposed by the orchestrator package. */
interface NodeCompiledAgent {
  role: string;
  traceName: string;
  invoke(input: {
    messages: Array<{ role: string; content: string }>;
    threadId?: string;
  }): Promise<{
    messages: Array<{ role: string; content: string; tool_calls?: unknown[] }>;
  }>;
  streamEvents?: (input: {
    messages: Array<{ role: string; content: string }>;
    threadId?: string;
  }) => AsyncIterable<{ event: string; data: unknown }>;
}

/** Metadata about a Node agent, used for registration and listing. */
interface NodeAgentMeta {
  name: string;
  description: string;
  inputHint: string;
  role: string;
  build: (opts?: { model?: string }) => Promise<NodeCompiledAgent>;
}

// ─── HTTP Bridge Strategy ──────────────────────────────────────────────────

interface NodeAgentInfo {
  name: string;
  description: string;
  role: string;
  tier: 'orchestrator';
  inputHint: string;
  status: 'available' | 'unavailable';
}

let httpBridgeConfig: { baseUrl: string; timeoutMs: number } | null = null;

export function configureHttpBridge(baseUrl: string, timeoutMs = 10_000): void {
  httpBridgeConfig = { baseUrl, timeoutMs };
}

async function discoverViaHttp(): Promise<NodeAgentInfo[]> {
  if (!httpBridgeConfig) return [];

  try {
    const response = await fetch(`${httpBridgeConfig.baseUrl}/api/agents/list`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(httpBridgeConfig.timeoutMs),
    });

    if (!response.ok) return [];
    const data = await response.json() as { agents: NodeAgentInfo[] };
    return data.agents ?? [];
  } catch {
    return [];
  }
}

async function invokeViaHttp(
  role: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  const start = Date.now();

  if (!httpBridgeConfig) {
    return {
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message: 'HTTP bridge not configured', cause: role },
      agent: role,
      durationMs: 0,
    };
  }

  try {
    const response = await fetch(`${httpBridgeConfig.baseUrl}/api/agents/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        agentRole: role,
        input,
        threadId: ctx.userId ?? undefined,
      }),
      signal: ctx.signal ?? AbortSignal.timeout(httpBridgeConfig.timeoutMs),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        status: 'internal_error',
        output: null,
        error: {
          status: 'internal_error',
          message: `HTTP bridge error: HTTP ${response.status} — ${errorBody.slice(0, 200)}`,
          cause: role,
        },
        agent: role,
        durationMs: Date.now() - start,
      };
    }

    const result = await response.json() as {
      messages: Array<{ role: string; content: string }>;
      agentRole: string;
      durationMs: number;
      tokensUsed?: { input: number; output: number; total: number };
    };

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
      agent: role,
      durationMs: Date.now() - start,
      telemetry: {
        agentTier: 'orchestrator',
        source: 'node-http',
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
      error: { status: 'internal_error', message: `HTTP bridge error: ${message}`, cause: role },
      agent: role,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Direct Import Strategy (Node.js only) ─────────────────────────────────

let _nodeAgentDefs: NodeAgentMeta[] | null = null;
let _nodeAgentDefsError: string | null = null;

async function discoverViaDirectImport(): Promise<NodeAgentMeta[]> {
  if (_nodeAgentDefs) return _nodeAgentDefs;
  if (_nodeAgentDefsError) return [];

  if (typeof process === 'undefined' || !process.versions?.node) {
    _nodeAgentDefsError = 'Not running in Node.js';
    return [];
  }

  try {
    const pkgPath = '../../packages/agent-orchestrator/src/agents/registry.js';
    const mod = await import(pkgPath);
    const registry = mod.AGENT_REGISTRY as Record<string, NodeAgentMeta>;
    _nodeAgentDefs = Object.values(registry);
    return _nodeAgentDefs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _nodeAgentDefsError = msg;
    return [];
  }
}

async function invokeViaDirectImport(
  role: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  const start = Date.now();

  const defs = await discoverViaDirectImport();
  const def = defs.find((d) => d.role === role);

  if (!def) {
    return {
      status: 'internal_error',
      output: null,
      error: {
        status: 'internal_error',
        message: `Node agent not found: ${role}. Available: ${defs.map((d) => d.role).join(', ') || 'none'}`,
        cause: role,
      },
      agent: role,
      durationMs: Date.now() - start,
    };
  }

  try {
    const compiled = await def.build({});
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

    const result = await compiled.invoke({
      messages: [{ role: 'user', content: inputStr }],
      threadId: `edge-bridge-${role}-${Date.now()}`,
    });

    const finalMsg = result.messages
      .filter((m) => m.role === 'ai' || m.role === 'assistant')
      .at(-1);

    return {
      status: 'ok',
      output: finalMsg?.content ?? result.messages.at(-1)?.content ?? null,
      error: null,
      agent: role,
      durationMs: Date.now() - start,
      telemetry: {
        agentTier: 'orchestrator',
        source: 'node-direct',
        messageCount: result.messages.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message, cause: role },
      agent: role,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Unified Public API ────────────────────────────────────────────────────

/**
 * List all discoverable Node-side agents.
 * Tries HTTP bridge first, falls back to direct import.
 */
export async function listNodeAgents(): Promise<
  Array<{ name: string; description: string; tier: string; role: string }>
> {
  // Try HTTP first (production path)
  const httpAgents = await discoverViaHttp();
  if (httpAgents.length > 0) return httpAgents;

  // Fall back to direct import (local dev)
  const directDefs = await discoverViaDirectImport();
  return directDefs.map((d) => ({
    name: d.role,
    description: d.description,
    tier: 'orchestrator',
    role: d.role,
  }));
}

/**
 * Invoke a Node-side agent by role name.
 * Tries HTTP bridge first, falls back to direct import.
 */
export async function invokeNodeAgent(
  role: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  // Try HTTP first
  if (httpBridgeConfig) {
    return invokeViaHttp(role, input, ctx);
  }

  // Fall back to direct import
  return invokeViaDirectImport(role, input, ctx);
}

/**
 * Register all Node-side agents in the Edge registry.
 * Call once at startup — idempotent.
 */
export async function registerNodeAgentsInEdgeRegistry(): Promise<void> {
  const agents = await listNodeAgents();

  for (const agent of agents) {
    const agentDef: AgentDefinition = {
      name: agent.role,
      description: `[Node] ${agent.description}`,
      tier: 'orchestrator' as AgentDefinition['tier'],
      async invoke(input: unknown, ctx: AgentContext): Promise<InvokeResult<unknown>> {
        return invokeNodeAgent(agent.role, input, ctx);
      },
    };

    try {
      registerAgent(agentDef);
    } catch {
      // Agent already registered — skip
    }
  }
}

/**
 * Check whether any Node agents are available.
 */
export async function isNodeAgentPackageAvailable(): Promise<boolean> {
  const agents = await listNodeAgents();
  return agents.length > 0;
}

/**
 * Get the count of available Node agents.
 */
export async function getNodeAgentCount(): Promise<number> {
  const agents = await listNodeAgents();
  return agents.length;
}

// ─── Health Check ──────────────────────────────────────────────────────────

export interface NodeAgentHealthResponse {
  ok: boolean;
  llm: string;
  model: string;
  environment: string;
  langfuse: boolean;
  langsmith: boolean;
  qdrant: boolean;
  composio: boolean;
  linear: boolean;
  n8n: boolean;
  github: boolean;
  sentry: boolean;
  vercel: boolean;
  runnable: boolean;
}

export async function checkNodeOrchestratorHealth(): Promise<NodeAgentHealthResponse | null> {
  if (!httpBridgeConfig) return null;

  try {
    const response = await fetch(`${httpBridgeConfig.baseUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return null;
    return (await response.json()) as NodeAgentHealthResponse;
  } catch {
    return null;
  }
}

export type { NodeAgentInfo };
