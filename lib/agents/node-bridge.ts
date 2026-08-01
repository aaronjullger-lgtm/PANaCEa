/**
 * Node Agent Bridge
 *
 * Bridges Edge-side agent invocation (lib/agents/) to Node-side agents
 * (packages/agent-orchestrator/). Enables invokeUnifiedAgent to route
 * to both systems transparently.
 *
 * Design:
 * - Dynamic imports keep the Node orchestrator out of the Edge bundle.
 * - Each Node agent is wrapped as an AgentDefinition so the Edge
 *   orchestrator/supervisor can treat them identically.
 * - The bridge is lazy — agents are only loaded on first invocation.
 * - On Edge runtime (no Node deps available), the bridge degrades
 *   gracefully: agents report as unavailable rather than crashing.
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
}

/** Metadata about a Node agent, used for registration and listing. */
interface NodeAgentMeta {
  name: string;
  description: string;
  inputHint: string;
  build: (opts?: { model?: string }) => Promise<NodeCompiledAgent>;
}

// ─── Lazy Agent Cache ──────────────────────────────────────────────────────

const nodeAgentCache = new Map<string, NodeCompiledAgent>();
const nodeAgentMetaCache = new Map<string, NodeAgentMeta>();

let nodeOrchestratorAvailable: boolean | null = null;

/**
 * Check whether the Node orchestrator package is importable.
 * Cached — only probes the filesystem once.
 */
async function isNodeOrchestratorAvailable(): Promise<boolean> {
  if (nodeAgentMetaCache.size > 0) return true;
  if (nodeOrchestratorAvailable !== null) return nodeOrchestratorAvailable;

  if (typeof process === 'undefined' || !process.versions?.node) {
    nodeOrchestratorAvailable = false;
    return false;
  }

  try {
    const pkgPath = '../../packages/agent-orchestrator/src/agents/registry.js';
    const mod = await import(pkgPath);
    const { AGENT_REGISTRY } = mod as {
      AGENT_REGISTRY: Record<string, NodeAgentMeta>;
    };

    for (const [role, def] of Object.entries(AGENT_REGISTRY)) {
      // Convert kebab-case role to agent name
      const name = `node-${role}`;
      nodeAgentMetaCache.set(name, def);
    }

    // Also load specialists
    try {
      const specPkgPath = '../../packages/agent-orchestrator/src/agents/specialists.js';
      const specMod = await import(specPkgPath);
      const { SPECIALIST_DEFS } = specMod as {
        SPECIALIST_DEFS: Record<string, NodeAgentMeta & { role: string }>;
      };
      for (const [role, def] of Object.entries(SPECIALIST_DEFS)) {
        const name = `node-${role}`;
        nodeAgentMetaCache.set(name, {
          name: def.name,
          description: def.description,
          inputHint: def.inputHint,
          build: async (opts) => {
            const specPkgPath = '../../packages/agent-orchestrator/src/agents/specialists.js';
            const { buildSpecialist } = await import(specPkgPath);
            return buildSpecialist(role as Parameters<typeof buildSpecialist>[0], opts);
          },
        });
      }
    } catch {
      // Specialists are optional — registry agents are the core bridge
    }

    nodeOrchestratorAvailable = true;
    return true;
  } catch {
    nodeOrchestratorAvailable = false;
    return false;
  }
}

/**
 * Get or build a Node agent by name.
 */
async function getNodeAgent(name: string): Promise<NodeCompiledAgent | null> {
  const cached = nodeAgentCache.get(name);
  if (cached) return cached;

  const meta = nodeAgentMetaCache.get(name);
  if (!meta) return null;

  try {
    const agent = await meta.build();
    nodeAgentCache.set(name, agent);
    return agent;
  } catch (err) {
    console.warn(
      `[node-bridge] Failed to build agent "${name}":`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ─── AgentDefinition Wrapper ───────────────────────────────────────────────

/**
 * Wrap a Node agent as an Edge-compatible AgentDefinition.
 * Converts the message-based invoke to the AgentDefinition contract.
 */
function wrapNodeAgent(
  name: string,
  meta: NodeAgentMeta,
): AgentDefinition<{ message: string; threadId?: string }, { content: string }> {
  return {
    name,
    description: meta.description,
    tier: 'ops', // Node agents are ops-tier by default
    async invoke(input, ctx) {
      const start = Date.now();

      try {
        const agent = await getNodeAgent(name);
        if (!agent) {
          return {
            status: 'internal_error',
            output: null,
            error: {
              status: 'internal_error',
              message: `Node agent "${name}" failed to build`,
              cause: name,
            },
            agent: name,
            durationMs: Date.now() - start,
          };
        }

        const message =
          typeof input === 'string'
            ? input
            : (input as { message?: string })?.message ?? JSON.stringify(input);

        const threadId =
          (input as { threadId?: string })?.threadId ??
          ctx.userId ??
          `panacea-${name}-${Date.now()}`;

        const result = await agent.invoke({
          messages: [{ role: 'user', content: message }],
          threadId,
        });

        const lastMessage = result.messages.at(-1);
        const content = lastMessage?.content ?? '';

        return {
          status: 'ok',
          output: { content },
          error: null,
          agent: name,
          durationMs: Date.now() - start,
          telemetry: {
            agentTier: 'ops',
            source: 'node',
            messageCount: result.messages.length,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          status: 'internal_error',
          output: null,
          error: { status: 'internal_error', message, cause: name },
          agent: name,
          durationMs: Date.now() - start,
        };
      }
    },
  };
}

// ─── Registration ──────────────────────────────────────────────────────────

/**
 * Register all available Node agents in the Edge registry.
 * Call once at startup — idempotent (skips already-registered agents).
 *
 * On Edge runtime where the Node package isn't available, this is a no-op.
 */
export async function registerNodeAgents(): Promise<string[]> {
  const available = await isNodeOrchestratorAvailable();
  if (!available) return [];

  const registered: string[] = [];

  for (const [name, meta] of nodeAgentMetaCache) {
    // Skip if already registered (idempotent)
    try {
      const wrapped = wrapNodeAgent(name, meta);
      registerAgent(wrapped);
      registered.push(name);
    } catch {
      // Agent already registered — skip
    }
  }

  return registered;
}

/**
 * List all Node agents without building them.
 * Returns metadata for dashboard/CLI display.
 */
export async function listNodeAgents(): Promise<
  Array<{ name: string; description: string; inputHint: string }>
> {
  const available = await isNodeOrchestratorAvailable();
  if (!available) return [];

  return Array.from(nodeAgentMetaCache.entries()).map(([name, meta]) => ({
    name,
    description: meta.description,
    inputHint: meta.inputHint,
  }));
}

/**
 * Check if a given agent name is a Node-side agent.
 */
export function isNodeAgent(name: string): boolean {
  return nodeAgentMetaCache.has(name);
}

/**
 * Get the count of available Node agents.
 */
export async function getNodeAgentCount(): Promise<number> {
  const available = await isNodeOrchestratorAvailable();
  if (!available) return 0;
  return nodeAgentMetaCache.size;
}
