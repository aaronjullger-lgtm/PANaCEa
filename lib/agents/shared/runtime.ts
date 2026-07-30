/**
 * LangGraph runtime agent registry and dispatcher.
 *
 * @module lib/agents/shared/runtime
 */

import type {
  AgentDefinition,
  AgentContext,
  InvokeResult,
  RegisteredAgent,
  AnyAgentDefinition,
} from './types';
const registry = new Map<string, RegisteredAgent>();

export function registerAgent<I, O>(def: AgentDefinition<I, O>): void {
  if (registry.has(def.name)) {
    const existing = registry.get(def.name);
    if (existing && existing.def === (def as AnyAgentDefinition)) return;
    throw new Error(
      `Agent registry conflict: name "${def.name}" is already registered by a different definition.`,
    );
  }
  registry.set(def.name, { def: def as AnyAgentDefinition });
}

export function listAgents(): ReadonlyArray<{ name: string; description: string; tier: string }> {
  return Array.from(registry.values()).map((r) => ({
    name: r.def.name,
    description: r.def.description,
    tier: r.def.tier,
  }));
}

export function getAgent(name: string): AgentDefinition | undefined {
  return registry.get(name)?.def;
}

export async function invokeAgent<I = unknown, O = unknown>(
  name: string,
  input: I,
  ctx: AgentContext,
): Promise<InvokeResult<O>> {
  const def = registry.get(name)?.def as AgentDefinition<I, O> | undefined;
  if (!def) {
    return {
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message: `Agent not found: ${name}`, cause: name },
      agent: name,
      durationMs: 0,
    };
  }
  const start = Date.now();
  try {
    const result = await def.invoke(input, ctx);
    return { ...result, durationMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'internal_error',
      output: null,
      error: { status: 'internal_error', message, cause: name },
      agent: def.name,
      durationMs: Date.now() - start,
    };
  }
}

export function clearRegistryForTests(): void {
  registry.clear();
}