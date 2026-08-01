/**
 * Agent Tool Registry
 *
 * A typed registry of tools the agent runner can dispatch. Provides:
 *   1. `defineTool()` — factory with full generic inference for tool authors
 *   2. `ToolRegistry` — lookup + filtering by name and category
 *   3. `buildFunctionDeclarations()` — translates a filtered view of the
 *      registry into the JSON structure Gemini expects under `tools[]`.
 *
 * Registries are plain objects, so you can compose them: merge a "core"
 * registry with a domain-specific one (e.g., OSCE tools, drill tools).
 */

import type { ToolCategory, ToolDefinition } from './types';

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Type-safe factory for tool definitions. Using this keeps generic
 * inference clean at the call site:
 *
 *   const myTool = defineTool({
 *     name: 'clinical_library_search',
 *     inputSchema: z.object({ query: z.string() }),
 *     // …
 *     execute: async ({ query }, ctx) => { … }
 *   });
 */
export function defineTool<TInput, TOutput>(
  def: ToolDefinition<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
  return def;
}

// ─── Registry ───────────────────────────────────────────────────────────────

/**
 * Stored tools are typed as `any` generics internally because TypeScript's
 * function parameter contravariance prevents `ToolDefinition<{id: string}>`
 * from being assignable to `ToolDefinition<unknown>`. Using `any` at the
 * storage boundary lets authors preserve full type safety at the
 * `defineTool()` call site while still allowing the registry to hold a
 * heterogeneous collection. The runner validates inputs with Zod before
 * invoking `execute`, so the loss of static typing here is contained.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any, any>;

export class ToolRegistry {
  private readonly tools: Map<string, AnyToolDefinition>;

  constructor(initial: AnyToolDefinition[] = []) {
    this.tools = new Map();
    for (const tool of initial) {
      this.register(tool);
    }
  }

  /**
   * Add or replace a tool. Enforces snake_case naming because Gemini's
   * function-call convention is snake_case and mismatches cause the model
   * to emit names the runner cannot match.
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      throw new Error(
        `Tool name "${tool.name}" must be snake_case (matching /^[a-z][a-z0-9_]*$/)`
      );
    }
    this.tools.set(tool.name, tool as AnyToolDefinition);
  }

  /** Retrieve a tool by name. Returns undefined if absent. */
  get(name: string): AnyToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Returns true when the registry contains every name in `names`. */
  hasAll(names: string[]): boolean {
    return names.every((n) => this.tools.has(n));
  }

  /** Raw list of every registered tool. */
  list(): AnyToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Filter the registry by a selection + category allow-list. Used by the
   * runner to translate `AgentRunConfig.allowedTools` into a concrete list.
   * Throws if any requested name is missing or in a disallowed category.
   */
  select(
    names: string[],
    allowedCategories: ToolCategory[] = ['read', 'compute']
  ): AnyToolDefinition[] {
    const allowed = new Set(allowedCategories);
    const selected: AnyToolDefinition[] = [];
    for (const name of names) {
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: "${name}"`);
      }
      if (!allowed.has(tool.category)) {
        throw new Error(
          `Tool "${name}" is in category "${tool.category}", which is not allowed for this agent (allowed: ${[...allowed].join(', ')})`
        );
      }
      selected.push(tool);
    }
    return selected;
  }
}

// ─── Gemini function declaration transform ────────────────────────────────

/**
 * Gemini expects tools in the shape:
 *   tools: [{ functionDeclarations: [{ name, description, parameters }] }]
 *
 * This helper converts a list of internal tool definitions into that
 * shape. It never ships the full Zod schema over the wire — only the
 * JSON Schema the author provided in `parametersJsonSchema`.
 */
export function buildFunctionDeclarations(
  tools: AnyToolDefinition[]
): Array<Record<string, unknown>> {
  if (tools.length === 0) return [];
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parametersJsonSchema,
      })),
    },
  ];
}

// ─── Convenience factories ─────────────────────────────────────────────────

/**
 * Build the default PANaCEa tool registry with all 10 tools.
 * Use the tool-set constants (CLINICAL_TOOLS, QUALITY_TOOLS, etc.)
 * to build restricted registries for specific agent domains.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  // Lazy-import to avoid circular dependency with tools/index.ts
  const { ALL_TOOLS } = require('./tools/index') as { ALL_TOOLS: AnyToolDefinition[] };
  return new ToolRegistry(ALL_TOOLS);
}

/**
 * Build a registry restricted to clinical study tools (student-facing).
 */
export function createClinicalToolRegistry(): ToolRegistry {
  const { CLINICAL_TOOLS } = require('./tools/index') as { CLINICAL_TOOLS: AnyToolDefinition[] };
  return new ToolRegistry(CLINICAL_TOOLS);
}

/**
 * Build a registry for content quality verification agents.
 */
export function createQualityToolRegistry(): ToolRegistry {
  const { QUALITY_TOOLS } = require('./tools/index') as { QUALITY_TOOLS: AnyToolDefinition[] };
  return new ToolRegistry(QUALITY_TOOLS);
}
