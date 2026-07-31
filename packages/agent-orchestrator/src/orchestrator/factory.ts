/**
 * Agent factory — builds a compiled LangGraph ReAct agent per role.
 *
 * Uses `createReactAgent` from `@langchain/langgraph/prebuilt` (confirmed export
 * path from langchain-ai/langgraphjs source, researched 2026-07). This gives us
 * the standard 2-node ReAct loop (llmCall → toolNode → llmCall … → END) with
 * tool binding, message history, recursion limit, and optional checkpointing
 * all handled internally — agents only supply an llm, tools, and a prompt.
 *
 * Tracing: every invocation gets the Langfuse CallbackHandler attached via
 * getTracingCallbacks(). LangSmith is env-driven (LANGSMITH_TRACING=true) and
 * instruments automatically — no per-call handler needed.
 *
 * Memory: long-term recall/remember happens *inside* agent tools (see tools/),
 * not via LangGraph checkpointing. Checkpoints short-circuit when the process
 * restarts; Qdrant is what gives agents continuity across runs.
 *
 * @module packages/agent-orchestrator/src/orchestrator/factory
 */

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { getLLM } from '../clients/llm.js';
import { getTracingCallbacks } from '../clients/tracing.js';
import { getCheckpointSaver } from '../clients/checkpoint.js';
import { optionalEnv } from '../config/env.js';
import type { AgentRole } from '../tools/index.js';

export interface BuildAgentOptions {
  role: AgentRole;
  tools: StructuredToolInterface[];
  systemPrompt: string;
  /** Trace name surfaced in Langfuse (max readability). */
  traceName?: string;
  /** Langfuse tags — filterable in the UI. */
  tags?: string[];
  /** Max tool-call loops before the graph stops. */
  recursionLimit?: number;
  /** Override the default model (env ORCHESTRATOR_MODEL). */
  model?: string;
  /**
   * Structured output schema (Deep Agents response_format pattern).
   * When provided, the agent's final response is parsed against this schema.
   * Accepts a Zod schema, JSON Schema object, or a provider-native format string.
   *
   * Example: `responseFormat: z.object({ severity: z.enum(['low','medium','high']), summary: z.string() })`
   */
  responseFormat?: unknown;
}

export interface CompiledAgent {
  role: AgentRole;
  traceName: string;
  invoke: (input: {
    messages: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }>;
    threadId?: string;
    /** Optional structured output schema for this specific invocation. */
    responseFormat?: unknown;
  }) => Promise<{
    messages: Array<{ role: string; content: string; tool_calls?: unknown[] }>;
    /** Parsed structured output if response_format was provided. */
    structuredOutput?: unknown;
  }>;
  streamEvents?: (input: {
    messages: Array<{ role: 'user' | 'system' | 'assistant' | 'tool'; content: string }>;
    threadId?: string;
  }) => AsyncIterable<{ event: string; data: unknown }>;
}

/**
 * Build a runnable LangGraph ReAct agent.
 *
 * Implemented as an async factory because createReactAgent + getLLM +
 * getTracingCallbacks are all async (dynamic optional-dep imports). The
 * returned CompiledAgent hides the LangGraph-isms behind a tiny stable surface
 * so the CLI, server, and tests all share one invocation path.
 */
export async function buildAgent(opts: BuildAgentOptions): Promise<CompiledAgent> {
  const llm: BaseChatModel = await getLLM(opts.model);
  const callbacks: BaseCallbackHandler[] = await getTracingCallbacks();
  const checkpointSaver = await getCheckpointSaver();

  const traceName = opts.traceName ?? `panacea:${opts.role}`;
  const tags = opts.tags ?? ['panacea', opts.role, optionalEnv('ORCHESTRATOR_ENV', 'development')];

  // createReactAgent signature (from docs/grep_app confirmation):
  //   createReactAgent({ llm, tools, messageModifier, checkpointSaver })
  const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
  const { SystemMessage } = await import('@langchain/core/messages');

  type CompiledGraph = {
    invoke: (input: unknown, config?: { callbacks?: BaseCallbackHandler[]; recursionLimit?: number; configurable?: { thread_id?: string } }) => Promise<{
      messages: Array<{ _getType: () => string; content: unknown; tool_calls?: unknown[] }>;
    }>;
    streamEvents: (input: unknown, options: { version: 'v2' }, config?: { callbacks?: BaseCallbackHandler[]; recursionLimit?: number; configurable?: { thread_id?: string } }) => AsyncIterable<{ event: string; data: unknown }>;
  };

  // Cast through unknown — the SqliteSaver/MemorySaver runtime shape satisfies
  // BaseCheckpointSaver but the orchestrator keeps the dep optional, so we can't
  // import the type without making it a hard dependency.
  type CreateReactParams = Parameters<typeof createReactAgent>[0];
  const agentParams: CreateReactParams = {
    llm,
    tools: opts.tools,
    messageModifier: new SystemMessage(opts.systemPrompt),
  };
  if (checkpointSaver) {
    (agentParams as { checkpointSaver?: unknown }).checkpointSaver = checkpointSaver;
  }
  const graph = (await createReactAgent(agentParams)) as unknown as CompiledGraph;

  return {
    role: opts.role,
    traceName,
    async invoke(input) {
      const config = {
        callbacks,
        recursionLimit: opts.recursionLimit ?? 12,
        configurable: { thread_id: input.threadId ?? `panacea-${opts.role}-${Date.now()}` },
      };

      const raw = await graph.invoke({ messages: input.messages }, config);

      // Normalize LangChain message objects to a plain shape for the CLI/server.
      const messages = (raw.messages ?? []).map((m) => {
        const type = typeof m._getType === 'function' ? m._getType() : 'unknown';
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return { role: type, content, tool_calls: m.tool_calls };
      });

      // Attempt structured output parsing if response_format was requested
      let structuredOutput: unknown;
      const responseFormat = input.responseFormat ?? opts.responseFormat;
      if (responseFormat) {
        const lastMsg = messages.at(-1)?.content ?? '';
        structuredOutput = tryParseStructuredOutput(lastMsg, responseFormat);
      }

      return { messages, structuredOutput };
    },
    async *streamEvents(input) {
      const config = {
        callbacks,
        recursionLimit: opts.recursionLimit ?? 12,
        configurable: { thread_id: input.threadId ?? `panacea-${opts.role}-${Date.now()}` },
      };
      for await (const chunk of graph.streamEvents({ messages: input.messages }, { version: 'v2' }, config)) {
        yield chunk;
      }
    },
  };
}

/**
 * Extract the agent's final assistant response text (last non-tool message).
 * Convenience for the CLI + dashboard.
 */
export function finalResponse(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'ai' || messages[i]?.role === 'assistant') return messages[i]?.content ?? '';
  }
  return messages.at(-1)?.content ?? '';
}

function tryParseStructuredOutput(content: string, schema: unknown): unknown {
  // Extract JSON from markdown code blocks or raw text
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!jsonMatch?.[1]) return undefined;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    // If schema is a Zod schema, validate
    if (typeof (schema as { safeParse?: (v: unknown) => { success: boolean; data: unknown } }).safeParse === 'function') {
      const result = (schema as { safeParse: (v: unknown) => { success: boolean; data: unknown } }).safeParse(parsed);
      return result.success ? result.data : undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}