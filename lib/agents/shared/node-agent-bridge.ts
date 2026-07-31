/**
 * Node Agent Bridge
 *
 * Bridges the Node-side agent orchestrator (packages/agent-orchestrator/)
 * into the Edge-side agent registry (lib/agents/). This allows the unified
 * agent interface to discover and invoke Node-side agents as if they were
 * local Edge agents.
 *
 * Design:
 * - Node agents are discovered lazily via dynamic import to avoid bundling
 *   Node-only dependencies (Express, Linear SDK, Qdrant, etc.) into Edge bundles.
 * - Each Node agent is wrapped as an AgentDefinition with the tier 'orchestrator'.
 * - Invocation delegates to the Node agent's CompiledAgent.invoke() surface.
 *
 * @module lib/agents/shared/node-agent-bridge
 */

import type { AgentDefinition, AgentContext, InvokeResult } from './types';
import { registerAgent } from './runtime';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Mirror of packages/agent-orchestrator/src/agents/registry.ts AgentDef */
interface NodeAgentDef {
  role: string;
  name: string;
  description: string;
  inputHint: string;
  build: (opts: { model?: string }) => Promise<NodeCompiledAgent>;
}

/** Mirror of packages/agent-orchestrator/src/orchestrator/factory.ts CompiledAgent */
interface NodeCompiledAgent {
  role: string;
  traceName: string;
  invoke: (input: {
    messages: Array<{ role: string; content: string }>;
    threadId?: string;
  }) => Promise<{ messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> }>;
  streamEvents?: (input: {
    messages: Array<{ role: string; content: string }>;
    threadId?: string;
  }) => AsyncIterable<{ event: string; data: unknown }>;
}

/** Cached Node agent registry — populated on first access. */
let _nodeAgentDefs: NodeAgentDef[] | null = null;
let _nodeAgentDefsError: string | null = null;

// ─── Lazy Discovery ────────────────────────────────────────────────────────

/**
 * Attempt to load the Node-side agent registry.
 * Returns null if the package isn't available (e.g., in Edge runtime).
 */
async function discoverNodeAgents(): Promise<NodeAgentDef[]> {
  if (_nodeAgentDefs) return _nodeAgentDefs;
  if (_nodeAgentDefsError) return [];

  try {
    // Dynamic import — only resolves in Node.js runtime, not Edge
    const mod = await import(
      '../../../packages/agent-orchestrator/src/agents/registry.js'
    );
    const registry = mod.AGENT_REGISTRY as Record<string, NodeAgentDef>;
    _nodeAgentDefs = Object.values(registry);
    return _nodeAgentDefs;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _nodeAgentDefsError = msg;
    // Not an error — expected in Edge runtime where the package isn't bundled
    console.debug('[NodeAgentBridge] Node agent registry unavailable:', msg);
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * List all discoverable Node-side agents.
 * Returns empty array in Edge runtime (expected).
 */
export async function listNodeAgents(): Promise<
  Array<{ name: string; description: string; tier: string; role: string }>
> {
  const defs = await discoverNodeAgents();
  return defs.map((d) => ({
    name: d.role,
    description: d.description,
    tier: 'orchestrator',
    role: d.role,
  }));
}

/**
 * Invoke a Node-side agent by role name.
 * Returns an error result if the agent isn't available.
 */
export async function invokeNodeAgent(
  role: string,
  input: unknown,
  ctx: AgentContext,
): Promise<InvokeResult<unknown>> {
  const start = Date.now();

  const defs = await discoverNodeAgents();
  const def = defs.find((d) => d.role === role);

  if (!def) {
    return {
      status: 'internal_error',
      output: null,
      error: {
        status: 'internal_error',
        message: `Node agent not found: ${role}. Available: ${defs.map((d) => d.role).join(', ') || 'none (package unavailable)'}`,
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

    // Extract final assistant response
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
        nodeAgent: true,
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

/**
 * Register all Node-side agents in the Edge registry so they appear
 * in getAllAgents() and can be invoked via invokeUnifiedAgent().
 *
 * Call this once at startup (or lazily on first access).
 */
export async function registerNodeAgentsInEdgeRegistry(): Promise<void> {
  const defs = await discoverNodeAgents();

  for (const def of defs) {
    const agentDef: AgentDefinition = {
      name: def.role,
      description: `[Node] ${def.description}`,
      tier: 'orchestrator' as AgentDefinition['tier'],
      async invoke(input: unknown, ctx: AgentContext): Promise<InvokeResult<unknown>> {
        return invokeNodeAgent(def.role, input, ctx);
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
 * Check whether the Node agent package is available in the current runtime.
 */
export async function isNodeAgentPackageAvailable(): Promise<boolean> {
  const defs = await discoverNodeAgents();
  return defs.length > 0;
}
