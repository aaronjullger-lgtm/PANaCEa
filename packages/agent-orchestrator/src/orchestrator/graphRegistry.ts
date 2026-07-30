/**
 * LangGraph Studio graph registry.
 *
 * Each `graphs/*.graph.ts` file calls into here to build a compiled graph at
 * module-load time so LangGraph Studio (`langgraph dev`) can import it.
 *
 * Studio requires a *compiled* CompiledStateGraph as the default export. Our
 * agent factories are async (LLM + tracing deps load dynamically), so we
 * build once at import and cache. If a build fails (e.g. no LLM key in the
 * Studio shell), we throw a descriptive error — Studio surfaces it cleanly.
 *
 * @module packages/agent-orchestrator/src/orchestrator/graphRegistry
 */

import type { CompiledAgent } from './factory.js';
import type { AgentRole } from '../tools/index.js';

export type CompiledStateGraph = {
  invoke: (input: unknown, config?: unknown) => Promise<unknown>;
  stream: (input: unknown, config?: unknown, options?: unknown) => AsyncIterable<unknown>;
};

const _cache = new Map<AgentRole, CompiledStateGraph>();
const _builders = new Map<AgentRole, () => Promise<CompiledAgent>>();

export function registerGraphBuilder(role: AgentRole, build: () => Promise<CompiledAgent>): void {
  _builders.set(role, build);
}

export async function getCompiledGraph(role: AgentRole): Promise<CompiledStateGraph> {
  const cached = _cache.get(role);
  if (cached) return cached;

  const build = _builders.get(role);
  if (!build) throw new Error(`[graphRegistry] no builder registered for role "${role}"`);

  const agent = await build();
  // The CompiledAgent.invoke wraps the underlying graph. Studio wants the raw
  // compiled graph object — so we expose a minimal CompiledStateGraph surface
  // that delegates to the agent's invoke/stream contract.
  const graph: CompiledStateGraph = {
    async invoke(input, _config) {
      const r = await agent.invoke(input as Parameters<typeof agent.invoke>[0]);
      return { messages: r.messages };
    },
    async *stream(input, _config) {
      const r = await agent.invoke(input as Parameters<typeof agent.invoke>[0]);
      yield { messages: r.messages };
    },
  };
  _cache.set(role, graph);
  return graph;
}