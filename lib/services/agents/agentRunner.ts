/**
 * Agent Runner
 *
 * The control loop that glues the tool registry, the Gemini client, and
 * the prompt engineering together. One call to `runAgent()` executes an
 * entire conversation — from the user's initial message, through any
 * number of tool calls, to the final text answer.
 *
 * Design notes:
 * - The loop is iterative, not recursive, to keep stack depth bounded and
 *   make the control flow obvious when debugging.
 * - Every iteration is fully logged into `steps[]` so the UI can replay
 *   the agent's reasoning and Sentry can attach breadcrumbs.
 * - Tools are executed in parallel within a single turn when Gemini emits
 *   multiple function calls at once (a common pattern for "independent
 *   lookups"). Parallelism is capped by `maxToolCallsPerIteration`.
 * - All errors from tools are surfaced to the model as a `functionResponse`
 *   with an `error` field — the model decides how to recover, which is
 *   almost always more useful than hard-failing the run.
 */

import { ZodError } from 'zod';
import {
  CLINICAL_STUDY_AGENT_PROMPT,
  buildUserContextAddendum,
} from './prompts';
import {
  buildFunctionDeclarations,
  type AnyToolDefinition,
  type ToolRegistry,
} from './toolRegistry';
import type {
  AgentPart,
  AgentRunConfig,
  AgentRunResult,
  AgentStep,
  AgentStopReason,
  ToolExecutionContext,
} from './types';
import {
  runLLMTurn,
  buildFunctionResponseTurn,
  type AgentContent,
  type AgentTurnContext,
} from './llmTurnClient';
import type { ParsedTurn } from './geminiAgentClient';

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 6;
const DEFAULT_MAX_TOOL_CALLS_PER_ITERATION = 4;
const DEFAULT_TOOL_TIMEOUT_MS = 8000;

// ─── Public entry point ────────────────────────────────────────────────────

export interface RunAgentArgs {
  /** The student's initial prompt. */
  userMessage: string;
  /** Tool registry to draw from. */
  registry: ToolRegistry;
  /** Per-run configuration (allowed tools, model, etc.). */
  config: AgentRunConfig;
  /** Execution context shared with every tool call. */
  toolContext: ToolExecutionContext;
  /** Gemini call context (env, auth, waitUntil). */
  geminiContext: AgentTurnContext;
}

/**
 * Run an agent to completion. Never throws — failure cases are returned
 * in the `stopReason` + `error` fields of the result so callers can
 * render them consistently.
 */
export async function runAgent(args: RunAgentArgs): Promise<AgentRunResult> {
  const { userMessage, registry, config, toolContext, geminiContext } = args;
  const startedAt = Date.now();

  // 1. Resolve tool selection up front. A malformed selection is a
  //    programmer error — fail fast with a clear message.
  let selectedTools: AnyToolDefinition[];
  try {
    selectedTools = registry.select(
      config.allowedTools,
      config.allowedCategories ?? ['read', 'compute']
    );
  } catch (err) {
    return errorResult(
      'model_error',
      err instanceof Error ? err.message : String(err),
      'TOOL_SELECTION_FAILED',
      startedAt
    );
  }

  const toolsByName = new Map(selectedTools.map((t) => [t.name, t]));
  const functionDeclarations = buildFunctionDeclarations(selectedTools);

  // 2. Build the system instruction (static prompt + per-request addendum).
  const baseSystem = config.systemInstruction ?? CLINICAL_STUDY_AGENT_PROMPT;
  const contextAddendum = config.userContext
    ? buildUserContextAddendum(config.userContext)
    : '';
  const systemInstruction = baseSystem + contextAddendum;

  // 3. Seed conversation history with the student's message.
  const contents: AgentContent[] = [
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ];

  // 4. Loop.
  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxCallsPerIter =
    config.maxToolCallsPerIteration ?? DEFAULT_MAX_TOOL_CALLS_PER_ITERATION;

  const steps: AgentStep[] = [
    {
      iteration: 0,
      role: 'user',
      parts: [{ type: 'text', text: userMessage }],
    },
  ];

  const tokensUsed = { input: 0, output: 0, total: 0 };
  let iterations = 0;

  for (let i = 1; i <= maxIterations; i++) {
    iterations = i;

    // Check abort signal before each iteration.
    if (toolContext.signal?.aborted) {
      return finalize(
        steps,
        '',
        'aborted',
        iterations,
        tokensUsed,
        startedAt,
        { message: 'Run aborted by caller', code: 'ABORTED' }
      );
    }

    // --- 4a. LLM turn (provider-agnostic) ---
    let turn: ParsedTurn;
    const turnStart = Date.now();
    try {
      turn = await runLLMTurn(geminiContext, {
        systemInstruction,
        contents,
        functionDeclarations,
        model: config.model ?? 'gpt-4o-mini',
        temperature: config.temperature ?? 0.2,
        maxOutputTokens: config.maxOutputTokens ?? 2048,
        signal: toolContext.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toolContext.log?.('error', 'LLM turn failed', { iteration: i, message });
      return finalize(
        steps,
        '',
        'model_error',
        iterations,
        tokensUsed,
        startedAt,
        { message, code: 'LLM_CALL_FAILED' }
      );
    }

    // Accumulate tokens even on blocked turns.
    tokensUsed.input += turn.usage.input;
    tokensUsed.output += turn.usage.output;
    tokensUsed.total += turn.usage.total;

    if (turn.blocked) {
      const msg = `Gemini safety filter blocked the response: ${turn.blockReason ?? 'unknown'}`;
      steps.push({
        iteration: i,
        role: 'model',
        parts: [{ type: 'text', text: msg }],
        durationMs: Date.now() - turnStart,
      });
      return finalize(
        steps,
        '',
        'safety_block',
        iterations,
        tokensUsed,
        startedAt,
        { message: msg, code: 'SAFETY_BLOCK' }
      );
    }

    // --- 4b. Record the model step. ---
    const modelParts: AgentPart[] = [];
    if (turn.text) modelParts.push({ type: 'text', text: turn.text });
    for (const fc of turn.functionCalls) {
      modelParts.push({ type: 'function_call', name: fc.name, args: fc.args });
    }
    steps.push({
      iteration: i,
      role: 'model',
      parts: modelParts,
      durationMs: Date.now() - turnStart,
    });

    // --- 4c. If no function calls, we're done. ---
    if (turn.functionCalls.length === 0) {
      return finalize(
        steps,
        turn.text,
        'completed',
        iterations,
        tokensUsed,
        startedAt
      );
    }

    // Add the assistant's turn to conversation history so the next turn
    // has the full context including the functionCall parts.
    contents.push({
      role: 'model',
      parts: [
        ...(turn.text ? [{ text: turn.text } as const] : []),
        ...turn.functionCalls.map((fc) => ({
          functionCall: { name: fc.name, args: fc.args },
        })),
      ],
    });

    // --- 4d. Enforce per-iteration tool-call cap. ---
    const callsToRun = turn.functionCalls.slice(0, maxCallsPerIter);
    if (turn.functionCalls.length > maxCallsPerIter) {
      toolContext.log?.(
        'warn',
        `Gemini emitted ${turn.functionCalls.length} function calls in one turn; capping at ${maxCallsPerIter}`
      );
    }

    // --- 4e. Dispatch tool calls in parallel. ---
    const toolResults = await Promise.all(
      callsToRun.map(async (call) => {
        const tool = toolsByName.get(call.name);
        if (!tool) {
          return {
            call,
            ok: false,
            error: `Unknown tool "${call.name}". Allowed tools: ${selectedTools
              .map((t) => t.name)
              .join(', ')}`,
            durationMs: 0,
          };
        }
        return executeToolSafely(tool, call.args, toolContext);
      })
    );

    // --- 4f. Log tool results and build functionResponse turn. ---
    const toolStepParts: AgentPart[] = toolResults.map((r) => ({
      type: 'function_result',
      name: r.call.name,
      ok: r.ok,
      output: 'output' in r ? r.output : undefined,
      error: r.error,
      durationMs: r.durationMs,
    }));
    steps.push({
      iteration: i,
      role: 'tool',
      parts: toolStepParts,
    });

    // Push a single `user` turn carrying every functionResponse.
    contents.push(
      buildFunctionResponseTurn(
        toolResults.map((r) => ({
          name: r.call.name,
          response: r.ok
            ? { result: 'output' in r ? r.output : null }
            : { error: r.error },
        }))
      )
    );
    // Loop continues — Gemini will see the tool results on the next turn.
  }

  // Exhausted iterations without final text.
  return finalize(
    steps,
    '',
    'max_iterations',
    iterations,
    tokensUsed,
    startedAt,
    {
      message: `Agent did not produce a final answer within ${maxIterations} iterations`,
      code: 'MAX_ITERATIONS',
    }
  );
}

// ─── Tool execution with validation + timeout ─────────────────────────────

interface ToolExecutionOk {
  call: { name: string; args: Record<string, unknown> };
  ok: true;
  output: unknown;
  durationMs: number;
  error?: undefined;
}

interface ToolExecutionFail {
  call: { name: string; args: Record<string, unknown> };
  ok: false;
  error: string;
  durationMs: number;
  output?: undefined;
}

type ToolExecutionOutcome = ToolExecutionOk | ToolExecutionFail;

/**
 * Run one tool with input validation, timeout, and total error isolation.
 * Errors are converted to strings the model can read and reason about.
 */
async function executeToolSafely(
  tool: AnyToolDefinition,
  rawArgs: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolExecutionOutcome> {
  const startedAt = Date.now();
  const call = { name: tool.name, args: rawArgs };

  // Zod validation
  const parsed = tool.inputSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      call,
      ok: false,
      error: `Invalid arguments for ${tool.name}: ${formatZodError(parsed.error)}`,
      durationMs: Date.now() - startedAt,
    };
  }

  const timeoutMs = tool.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;

  try {
    const output = await withTimeout(
      tool.execute(parsed.data, ctx),
      timeoutMs,
      tool.name
    );
    return {
      call,
      ok: true,
      output,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.log?.('warn', `Tool "${tool.name}" failed`, { message });
    return {
      call,
      ok: false,
      error: message,
      durationMs: Date.now() - startedAt,
    };
  }
}

function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tool "${label}" timed out after ${ms}ms`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

// ─── Result helpers ────────────────────────────────────────────────────────

function finalize(
  steps: AgentStep[],
  finalText: string,
  stopReason: AgentStopReason,
  iterations: number,
  tokensUsed: { input: number; output: number; total: number },
  startedAt: number,
  error?: { message: string; code?: string }
): AgentRunResult {
  return {
    finalText,
    stopReason,
    steps,
    iterations,
    tokensUsed,
    durationMs: Date.now() - startedAt,
    ...(error ? { error } : {}),
  };
}

function errorResult(
  stopReason: AgentStopReason,
  message: string,
  code: string,
  startedAt: number
): AgentRunResult {
  return {
    finalText: '',
    stopReason,
    steps: [],
    iterations: 0,
    tokensUsed: { input: 0, output: 0, total: 0 },
    durationMs: Date.now() - startedAt,
    error: { message, code },
  };
}
