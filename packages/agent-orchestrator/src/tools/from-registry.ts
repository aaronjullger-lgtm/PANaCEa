/**
 * Tool adapter: PANaCEa ToolRegistry → LangChain StructuredTool
 *
 * Converts PANaCEa-native tool definitions into LangChain `StructuredTool`
 * instances that the orchestrator's LangGraph agents can bind and call.
 * This bridges the two agent systems without creating a hard dependency
 * between the orchestrator package and the root `lib/` directory.
 *
 * The adapter defines its own minimal type surface — consumers pass in
 * tool objects that conform to this interface at runtime. This keeps the
 * orchestrator package self-contained while still allowing clinical tools
 * to be used by ops agents.
 *
 * @module packages/agent-orchestrator/src/tools/from-registry
 */

import { tool as langchainTool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { z } from 'zod';

// ─── Local type surface (mirrors lib/services/agents/types.ts) ──────────────

/** Per-invocation context passed to every tool's execute(). */
export interface ToolExecutionContext {
  userId: string;
  env: Record<string, unknown>;
  prisma?: unknown;
  signal?: AbortSignal;
  log?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}

/** Category determines whether a tool is allowed in a given agent mode. */
export type ToolCategory = 'read' | 'compute' | 'write';

/**
 * Definition of a single tool the agent can call.
 * Mirrors the shape from lib/services/agents/types.ts so PANaCEa-native
 * tools can be passed directly without conversion.
 */
export interface PanaceaToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  category: ToolCategory;
  timeoutMs?: number;
  execute: (input: TInput, ctx: ToolExecutionContext) => Promise<TOutput>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPanaceaTool = PanaceaToolDefinition<any, any>;

// ─── Conversion ─────────────────────────────────────────────────────────────

/**
 * Default context factory — returns a minimal synthetic context.
 * Override per-invocation to inject userId, env, Prisma client, etc.
 */
const defaultCtxFactory = (): Partial<ToolExecutionContext> => ({});

/**
 * Convert a single PANaCEa-style tool definition into a LangChain StructuredTool.
 *
 * The resulting tool:
 * - Has the same `name` and `description` (LLM sees identical interface)
 * - Uses the same Zod `inputSchema` for argument validation
 * - Wraps `execute()` with a synthetic ToolExecutionContext
 * - Reports tool errors as string returns so the model can self-correct
 */
export function panaceaToolToLangChain(
  panaceaTool: AnyPanaceaTool,
  ctxFactory: () => Partial<ToolExecutionContext> = defaultCtxFactory,
): StructuredToolInterface {
  const buildCtx = (): ToolExecutionContext => {
    const partial = ctxFactory();
    return {
      userId: partial.userId ?? 'orchestrator',
      env: partial.env ?? {},
      prisma: partial.prisma,
      signal: partial.signal,
      log:
        partial.log ??
        ((level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void => {
          const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
          fn(`[panacea-tool:${panaceaTool.name}] ${msg}`, data ?? '');
        }),
    };
  };

  return langchainTool(
    async (input: Record<string, unknown>): Promise<string> => {
      const ctx = buildCtx();
      try {
        const result = await panaceaTool.execute(input, ctx);
        if (typeof result === 'string') return result;
        return JSON.stringify(result, null, 2);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Tool "${panaceaTool.name}" failed: ${msg}`;
      }
    },
    {
      name: panaceaTool.name,
      description: panaceaTool.description,
      schema: panaceaTool.inputSchema as z.ZodObject<z.ZodRawShape>,
    },
  );
}

/**
 * Convert an array of PANaCEa-style tool definitions into LangChain StructuredTools.
 */
export function panaceaToolsToLangChain(
  panaceaTools: AnyPanaceaTool[],
  ctxFactory?: () => Partial<ToolExecutionContext>,
): StructuredToolInterface[] {
  return panaceaTools.map((t) => panaceaToolToLangChain(t, ctxFactory));
}

/**
 * Merge orchestrator-native LangChain tools with PANaCEa clinical tools.
 *
 * This is the primary entry point for agent builders that want both:
 * 1. Ops tools (Linear, GitHub, Sentry, Qdrant memory) — already LangChain tools
 * 2. Clinical tools (library search, blueprint coverage, FSRS status) — converted here
 *
 * Deduplicates by name — LangChain-native tools win on collision.
 */
export function mergeTools(
  lcTools: StructuredToolInterface[],
  panaceaTools: AnyPanaceaTool[],
  ctxFactory?: () => Partial<ToolExecutionContext>,
): StructuredToolInterface[] {
  const converted = panaceaToolsToLangChain(panaceaTools, ctxFactory);
  const seen = new Set(lcTools.map((t) => t.name));
  const unique = [...lcTools];
  for (const tool of converted) {
    if (!seen.has(tool.name)) {
      unique.push(tool);
      seen.add(tool.name);
    }
  }
  return unique;
}
