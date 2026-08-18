/**
 * Agent Primitive Types
 *
 * Shared types for the PANaCEa agent framework — tool definitions, runner
 * config, step log, and structured result. Everything in this file is
 * Edge-runtime safe (no Node APIs, no Prisma client imports).
 */

import type { z } from 'zod';
import type { GeminiModelId } from '../../../functions/api/_shared/ai-service';

// ─── Tool Definition ────────────────────────────────────────────────────────

/**
 * Per-invocation context passed to every tool's `execute()`.
 * The Prisma client is typed as `unknown` here so this file has zero
 * Prisma import cost — tools cast it themselves if they need the client.
 */
export interface ToolExecutionContext {
  /** Prisma Edge client (may be undefined for tools that do not touch DB). */
  prisma?: unknown;
  /** Authenticated Clerk user ID of the student making the request. */
  userId: string;
  /** Cloudflare env bindings (GEMINI_API_KEY, DATABASE_URL, KV, etc.). */
  env: Record<string, unknown>;
  /**
   * Abort signal for cooperative cancellation. Tools that hit the network
   * or run long computations should pass this to `fetch()` and long loops.
   */
  signal?: AbortSignal;
  /** Structured logger hook — tools can emit breadcrumbs. */
  log?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}

/**
 * Category determines whether a tool is allowed in a given agent mode.
 * - `read`:    fetches data, no side effects                (always safe)
 * - `compute`: transforms data or calls an external API     (safe for most agents)
 * - `write`:            mutates user state, database rows, etc.      (requires explicit allow)
 * - `canonical_write`:  verified pipeline writes (e.g. submitDrillReview) — never duplicates FSRS
 */
export type ToolCategory = 'read' | 'compute' | 'write' | 'canonical_write';

/**
 * Cost hint lets the runner rank tools and can be surfaced in telemetry.
 * It is NOT enforced — purely advisory.
 */
export type ToolCostHint = 'cheap' | 'medium' | 'expensive';

/**
 * Definition of a single tool the agent can call.
 *
 * Tools are written with full TypeScript types via the generics, but are
 * exposed to the LLM via a JSON Schema that matches Gemini's
 * `functionDeclarations` format.
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Snake_case function name as it will appear in Gemini's tool declarations. */
  name: string;
  /**
   * LLM-facing description. Write this for the model, not the human —
   * explain WHEN to use the tool, not just what it does. The model reads
   * this to decide whether to call you.
   */
  description: string;
  /** Zod schema used to validate arguments from the model at execution time. */
  inputSchema: z.ZodType<TInput>;
  /**
   * JSON Schema passed to Gemini inside `functionDeclarations`. Must mirror
   * `inputSchema`. Kept manual (vs. auto-generated from Zod) to avoid the
   * `zod-to-json-schema` runtime dependency and to give authors full control.
   */
  parametersJsonSchema: Record<string, unknown>;
  /** Category — used by the runner to filter tools based on agent mode. */
  category: ToolCategory;
  /** Cost hint for telemetry and model routing. */
  costHint?: ToolCostHint;
  /**
   * Hard timeout in milliseconds. If `execute()` does not resolve in this
   * window, the runner aborts it and reports a `TOOL_TIMEOUT` error to
   * the model so it can decide how to recover.
   */
  timeoutMs?: number;
  /** The actual work. Receives validated input and the execution context. */
  execute: (input: TInput, ctx: ToolExecutionContext) => Promise<TOutput>;
}

// ─── Agent Configuration ────────────────────────────────────────────────────

/**
 * Options controlling a single `runAgent()` call.
 */
export interface AgentRunConfig {
  /** Names of tools from the registry that this run is allowed to call. */
  allowedTools: string[];
  /** Which tool categories are permitted. Default: `['read', 'compute']`. */
  allowedCategories?: ToolCategory[];
  /** Maximum number of Gemini round-trips before the runner bails. Default: 6. */
  maxIterations?: number;
  /** Maximum tool calls per iteration. Default: 4. */
  maxToolCallsPerIteration?: number;
  /** Gemini model. Defaults to FLASH_2_5 via the runner. */
  model?: GeminiModelId;
  /** Sampling temperature. Default: 0.2 for clinical determinism. */
  temperature?: number;
  /** Max output tokens per turn. Default: 2048. */
  maxOutputTokens?: number;
  /** Override the default clinical study system prompt. */
  systemInstruction?: string;
  /**
   * Optional per-request user context appended to the system instruction
   * (e.g., current rotation, exam date).
   */
  userContext?: {
    currentRotation?: string | null;
    examDate?: string | null;
    focusSystem?: string | null;
  };
  /**
   * Endpoint name forwarded to `callGemini` for token tracking.
   * Example: `'/api/agents/run'`.
   */
  telemetryEndpoint?: string;
}

// ─── Transcript / Step Log ──────────────────────────────────────────────────

export type AgentRole = 'user' | 'model' | 'tool';

export interface AgentTextPart {
  type: 'text';
  text: string;
}

export interface AgentFunctionCallPart {
  type: 'function_call';
  name: string;
  args: Record<string, unknown>;
}

export interface AgentFunctionResultPart {
  type: 'function_result';
  name: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export type AgentPart = AgentTextPart | AgentFunctionCallPart | AgentFunctionResultPart;

/**
 * A single turn in the agent transcript. Used for observability and
 * UI replay. One user turn, one model turn, and any number of tool
 * turns make up a complete iteration.
 */
export interface AgentStep {
  iteration: number;
  role: AgentRole;
  parts: AgentPart[];
  /** Milliseconds elapsed during this step (model call OR tool execution). */
  durationMs?: number;
}

// ─── Result ─────────────────────────────────────────────────────────────────

export type AgentStopReason =
  | 'completed'         // Model returned a final text answer with no tool calls.
  | 'max_iterations'    // Runner hit maxIterations before the model finalized.
  | 'tool_error'        // A tool failed in a non-recoverable way.
  | 'model_error'       // Gemini returned an error the runner could not recover from.
  | 'safety_block'      // Model output was blocked by Gemini safety filters.
  | 'aborted';          // AbortSignal fired.

export interface AgentRunResult {
  /** Final text answer shown to the user. Empty string if the run did not complete. */
  finalText: string;
  /** Why the loop stopped. */
  stopReason: AgentStopReason;
  /** Full transcript, including tool calls and results, for replay/audit. */
  steps: AgentStep[];
  /** Total Gemini turns (request/response pairs) executed. */
  iterations: number;
  /** Aggregate token counts across all Gemini calls in this run. */
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  /** Total wall-clock duration of the run in milliseconds. */
  durationMs: number;
  /** Error details if stopReason indicates failure. */
  error?: {
    message: string;
    code?: string;
  };
}
