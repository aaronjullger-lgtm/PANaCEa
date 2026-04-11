/**
 * Gemini Agent Client
 *
 * Thin adapter on top of the project's existing `callGemini()` helper
 * (`functions/api/_shared/ai-service.ts`). Adds:
 *
 *   1. Multi-turn conversation management with function-call parts.
 *   2. A response parser that extracts BOTH text and `functionCall` parts
 *      from `result.raw.candidates[0].content.parts`. (The base
 *      `callGemini()` parser only surfaces text.)
 *   3. Helpers to build `functionResponse` parts for the next turn.
 *
 * This file does not call Gemini directly — it delegates everything to
 * `callGemini()` so we inherit token tracking, error classification,
 * safety blocks, and retry semantics for free.
 */

import {
  callGemini,
  type GeminiContent,
  type GeminiModelId,
  GeminiModel,
} from '../../../functions/api/_shared/ai-service';

// ─── Wire-format types ──────────────────────────────────────────────────────

/**
 * Subset of the Gemini API `Part` union we care about. The full shape has
 * fields for inlineData (images), fileData, codeExecutionResult, etc., but
 * the agent runner only needs `text`, `functionCall`, and `functionResponse`.
 */
export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | {
      functionResponse: {
        name: string;
        response: Record<string, unknown>;
      };
    };

/**
 * Wider version of `GeminiContent` that allows functionCall/functionResponse
 * parts. The upstream type in `ai-service.ts` only types text and inlineData
 * parts, so we widen here for the agent runner's turn history.
 */
export interface AgentContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

// ─── Response parsing ───────────────────────────────────────────────────────

export interface ParsedTurn {
  /** Concatenated text from all `text` parts. Empty string when absent. */
  text: string;
  /** All function calls in order. Gemini can emit multiple per turn. */
  functionCalls: Array<{ name: string; args: Record<string, unknown> }>;
  /** True if prompt feedback indicated a safety block. */
  blocked: boolean;
  /** Reason returned by Gemini if blocked. */
  blockReason?: string;
  /** Token usage for this turn. */
  usage: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Parse a raw Gemini response (the `.raw` field of what `callGemini()`
 * returns) into a structured turn. Defensive: every access is guarded
 * because the wire format nests candidates → content → parts with
 * optional fields at every level.
 */
export function parseGeminiTurn(raw: unknown): ParsedTurn {
  const r = raw as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      content?: { parts?: unknown[] };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const blockReason = r?.promptFeedback?.blockReason;
  const usage = {
    input: r?.usageMetadata?.promptTokenCount ?? 0,
    output: r?.usageMetadata?.candidatesTokenCount ?? 0,
    total: r?.usageMetadata?.totalTokenCount ?? 0,
  };

  if (blockReason) {
    return { text: '', functionCalls: [], blocked: true, blockReason, usage };
  }

  const candidate = r?.candidates?.[0];
  const parts = (candidate?.content?.parts ?? []) as unknown[];

  let text = '';
  const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  for (const rawPart of parts) {
    const part = rawPart as Record<string, unknown>;
    // Skip "thought" parts so internal reasoning never leaks into text.
    if (part.thought === true) continue;

    if (typeof part.text === 'string') {
      text += part.text;
      continue;
    }

    if (
      part.functionCall &&
      typeof part.functionCall === 'object'
    ) {
      const fc = part.functionCall as {
        name?: unknown;
        args?: unknown;
      };
      if (typeof fc.name === 'string') {
        functionCalls.push({
          name: fc.name,
          args: (fc.args as Record<string, unknown>) ?? {},
        });
      }
    }
  }

  return { text, functionCalls, blocked: false, usage };
}

// ─── Tool-result → functionResponse turn ───────────────────────────────────

/**
 * Build a single `user`-role content entry containing one or more
 * `functionResponse` parts. Per Gemini's contract, multiple tool results
 * are packed into the same user turn so the model sees them together.
 */
export function buildFunctionResponseTurn(
  results: Array<{ name: string; response: Record<string, unknown> }>
): AgentContent {
  return {
    role: 'user',
    parts: results.map((r) => ({
      functionResponse: {
        name: r.name,
        response: r.response,
      },
    })),
  };
}

// ─── Single-turn Gemini call wrapper ────────────────────────────────────────

export interface AgentTurnRequest {
  systemInstruction: string;
  contents: AgentContent[];
  functionDeclarations: Array<Record<string, unknown>>;
  model?: GeminiModelId;
  temperature?: number;
  maxOutputTokens?: number;
  telemetryEndpoint?: string;
  signal?: AbortSignal;
}

export interface AgentTurnContext {
  env: { GEMINI_API_KEY: string; DATABASE_URL?: string; [key: string]: unknown };
  auth?: { userId?: string };
  waitUntil?: (p: Promise<unknown>) => void;
}

/**
 * Execute a single Gemini turn with tools. Returns the structured
 * parse. Thin wrapper around `callGemini()`.
 *
 * Note: `callGemini`'s `tools` option passes through directly to the
 * request body, so function declarations work unchanged.
 */
export async function runAgentTurn(
  ctx: AgentTurnContext,
  req: AgentTurnRequest
): Promise<ParsedTurn> {
  // Cast to the upstream `GeminiContent[]` type. Our `AgentContent` is a
  // superset (it allows function parts), but `callGemini` passes the
  // contents through verbatim so the cast is safe at runtime.
  const contents = req.contents as unknown as GeminiContent[];

  const result = await callGemini(
    {
      env: ctx.env as AgentTurnContext['env'] & { GEMINI_API_KEY: string },
      auth: ctx.auth,
      waitUntil: ctx.waitUntil as ((p: Promise<unknown>) => void) | undefined as never,
    },
    {
      model: req.model ?? GeminiModel.FLASH_2_5,
      systemInstruction: req.systemInstruction,
      contents,
      tools: req.functionDeclarations,
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens ?? 2048,
      },
      endpoint: req.telemetryEndpoint ?? '/api/agents/run',
      signal: req.signal,
    }
  );

  return parseGeminiTurn(result.raw);
}
