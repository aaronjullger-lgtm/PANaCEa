/**
 * SubAgentBuilder — Deep Agents-style subagent patterns for TypeScript/LangGraphJS.
 *
 * The Deep Agents SDK (Python) provides `create_deep_agent` with built-in subagent
 * spawning, context isolation, structured output, and streaming. This module brings
 * equivalent patterns to the TypeScript agent-orchestrator:
 *
 *   1. SubAgentDefinition — typed config for specialized subagents
 *   2. buildSubAgent — wraps an existing CompiledAgent as a callable subagent
 *   3. fanOutSubAgents — parallel dispatch with result aggregation
 *   4. SubAgentResult — typed structured output envelope
 *
 * These compose with the existing `buildAgent` factory — no breaking changes.
 *
 * @module packages/agent-orchestrator/src/orchestrator/subAgentBuilder
 */

import type { CompiledAgent } from './factory.js';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { AgentRole } from '../tools/index.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Configuration for a specialized subagent. Mirrors Deep Agents SubAgent dict. */
export interface SubAgentDefinition {
  /** Unique identifier — the orchestrator uses this name when delegating. */
  name: string;
  /** Action-oriented description so the orchestrator knows when to delegate. */
  description: string;
  /** System prompt for the subagent (does NOT inherit from parent). */
  systemPrompt: string;
  /** Tools available to this subagent. Keep minimal — only what's needed. */
  tools?: StructuredToolInterface[];
  /** Optional model override (provider:model format). Defaults to parent model. */
  model?: string;
  /** Max tool-call loops before the subagent stops. */
  recursionLimit?: number;
  /** Tags for Langfuse/LangSmith filtering. */
  tags?: string[];
}

/** Structured output from a subagent invocation. */
export interface SubAgentResult<T = unknown> {
  /** Subagent name (matches SubAgentDefinition.name). */
  agentName: string;
  /** Whether the subagent completed successfully. */
  success: boolean;
  /** Final assistant response text. */
  output: string;
  /** Structured data if response_format was provided. */
  data?: T;
  /** Error message if success is false. */
  error?: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Tool calls made during execution. */
  toolCalls: number;
}

/** Options for fanOutSubAgents parallel dispatch. */
export interface FanOutOptions {
  /** Max concurrent subagents (default: 4). */
  concurrency?: number;
  /** Timeout per subagent in ms (default: 120_000). */
  timeoutMs?: number;
  /** If true, continues on individual failures (default: true). */
  continueOnError?: boolean;
}

// ─── Builder ────────────────────────────────────────────────────────────────

/**
 * Build a callable subagent from a definition + the parent agent's LLM config.
 *
 * This wraps the existing `buildAgent` factory so subagents get the same
 * tracing, checkpointing, and tool-binding as top-level agents — but with
 * isolated system prompts and tool sets.
 */
export async function buildSubAgent(
  def: SubAgentDefinition,
  parentModel?: string,
): Promise<CompiledAgent> {
  const { buildAgent } = await import('./factory.js');

  return buildAgent({
    role: (def.name as AgentRole) ?? 'content-enrichment',
    tools: def.tools ?? [],
    systemPrompt: def.systemPrompt,
    traceName: `panacea:subagent:${def.name}`,
    tags: def.tags ?? ['panacea', 'subagent', def.name],
    recursionLimit: def.recursionLimit ?? 8,
    model: def.model ?? parentModel,
  });
}

// ─── Invocation helpers ─────────────────────────────────────────────────────

/**
 * Invoke a subagent and return a structured result envelope.
 *
 * Handles error wrapping, timing, and tool-call counting so the orchestrator
 * gets a consistent shape regardless of subagent implementation.
 */
export async function invokeSubAgent<T = unknown>(
  agent: CompiledAgent,
  agentName: string,
  input: string,
  threadId?: string,
): Promise<SubAgentResult<T>> {
  const start = Date.now();
  try {
    const result = await agent.invoke({
      messages: [{ role: 'user', content: input }],
      threadId: threadId ?? `subagent-${agentName}-${Date.now()}`,
    });

    const output = finalResponse(result.messages);
    const toolCalls = result.messages.filter(
      (m) => m.role === 'tool' || (m as { tool_calls?: unknown[] }).tool_calls?.length,
    ).length;

    // Attempt to parse structured data from the output if it looks like JSON
    let data: T | undefined;
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ?? output.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        data = JSON.parse(jsonMatch[1]!) as T;
      } catch {
        // Not JSON — that's fine, output is plain text
      }
    }

    return {
      agentName,
      success: true,
      output,
      data,
      durationMs: Date.now() - start,
      toolCalls,
    };
  } catch (err) {
    return {
      agentName,
      success: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
      toolCalls: 0,
    };
  }
}

// ─── Fan-out ────────────────────────────────────────────────────────────────

/**
 * Dispatch multiple subagents in parallel with concurrency control.
 *
 * Each subagent gets the same input. Results are collected and returned
 * in definition order. Individual failures don't block siblings when
 * continueOnError is true (default).
 *
 * Usage:
 * ```ts
 * const results = await fanOutSubAgents(
 *   [cmrrDef, stagingDef, pearlDef],
 *   "Heart failure with reduced ejection fraction",
 *   { concurrency: 3 },
 * );
 * ```
 */
export async function fanOutSubAgents(
  definitions: SubAgentDefinition[],
  input: string,
  options: FanOutOptions = {},
): Promise<SubAgentResult[]> {
  const { concurrency = 4, timeoutMs = 120_000, continueOnError = true } = options;

  const results: SubAgentResult[] = new Array(definitions.length);
  const errors: Array<{ index: number; error: string }> = [];

  // Process in batches of `concurrency`
  for (let i = 0; i < definitions.length; i += concurrency) {
    const batch = definitions.slice(i, i + concurrency);
    const batchPromises = batch.map(async (def, batchIdx) => {
      const globalIdx = i + batchIdx;
      try {
        const agent = await buildSubAgent(def);
        const timeoutPromise = new Promise<SubAgentResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Subagent "${def.name}" timed out after ${timeoutMs}ms`)), timeoutMs),
        );
        const result = await Promise.race([invokeSubAgent(agent, def.name, input), timeoutPromise]);
        results[globalIdx] = result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (!continueOnError) throw err;
        errors.push({ index: globalIdx, error: errorMsg });
        results[globalIdx] = {
          agentName: def.name,
          success: false,
          output: '',
          error: errorMsg,
          durationMs: 0,
          toolCalls: 0,
        };
      }
    });

    await Promise.all(batchPromises);
  }

  if (errors.length > 0 && !continueOnError) {
    throw new Error(`Subagent fan-out failed: ${errors.map((e) => `[${e.index}] ${e.error}`).join('; ')}`);
  }

  return results;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Extract the final assistant response from a message list.
 * Mirrors factory.ts:finalResponse but usable without importing factory.
 */
export function finalResponse(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'ai' || messages[i]?.role === 'assistant') {
      return messages[i]?.content ?? '';
    }
  }
  return messages.at(-1)?.content ?? '';
}

/**
 * Merge multiple SubAgentResults into a single synthesized output.
 * Useful when the orchestrator needs to combine parallel subagent findings.
 */
export function synthesizeResults(results: SubAgentResult[]): string {
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const parts: string[] = [];

  if (successful.length > 0) {
    parts.push(`## Subagent Results (${successful.length} succeeded)`);
    for (const r of successful) {
      parts.push(`### ${r.agentName} (${r.durationMs}ms, ${r.toolCalls} tool calls)`);
      parts.push(r.output.slice(0, 2000));
      parts.push('');
    }
  }

  if (failed.length > 0) {
    parts.push(`## Failures (${failed.length} failed)`);
    for (const r of failed) {
      parts.push(`- **${r.agentName}**: ${r.error ?? 'unknown error'}`);
    }
  }

  return parts.join('\n');
}
