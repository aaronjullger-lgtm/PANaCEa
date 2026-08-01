/**
 * POST /api/agents/run
 *
 * General-purpose agent runner endpoint. Accepts a student message plus an
 * optional tool allow-list and executes the PANaCEa agent loop to
 * completion. Returns the final text, stop reason, token usage, and
 * iteration count. By default the full step transcript is withheld from
 * the response (it is only useful for debugging and bloats payloads);
 * clients can opt in via `includeSteps: true`.
 *
 * Design constraints:
 *  - Edge-runtime safe: no `process.env`, no Node APIs.
 *  - Prisma Edge client with `safePrismaDisconnect` in finally.
 *  - `aiEndpoint` wrapper enforces auth + 25 req/min rate limit.
 *  - Clinical safety: default allowlist is read-only tools.
 */

import { z } from 'zod';
import {
  aiEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  runAgent,
  type AgentRunResult,
  type ToolCategory,
  type ToolExecutionContext,
} from '../../../lib/services/agents';
import {
  createDefaultToolRegistry,
  DEFAULT_TOOL_NAMES,
} from '../../../lib/services/agents/tools';
import { logAgentTelemetry } from '../../../lib/services/agents/telemetry';

// ─── Request schema ─────────────────────────────────────────────────────────

const AgentRunRequestSchema = z.object({
  /** The student's prompt. */
  message: z
    .string()
    .min(1, 'message is required')
    .max(4000, 'message must be under 4000 characters'),

  /**
   * Optional explicit tool allow-list. When omitted, the endpoint uses the
   * full DEFAULT_TOOL_NAMES set (clinical_library_search,
   * user_progress_summary, fsrs_due_count).
   */
  allowedTools: z
    .array(z.string().min(1).max(64))
    .max(16, 'at most 16 tools may be allowed per run')
    .optional(),

  /** Only categories in this list may execute. Defaults to read-only. */
  allowedCategories: z
    .array(z.enum(['read', 'compute', 'write']))
    .optional(),

  /** Max model round-trips. Clamped to 10 to keep the endpoint bounded. */
  maxIterations: z.number().int().min(1).max(10).optional(),

  /** Gemini model override. Defaults to FLASH_2_5 via the runner. */
  model: z.string().min(1).max(80).optional(),

  /** Sampling temperature. Default 0.2 (clinical determinism). */
  temperature: z.number().min(0).max(1).optional(),

  /** Max output tokens per turn. */
  maxOutputTokens: z.number().int().min(256).max(4096).optional(),

  /**
   * Optional per-request user context injected into the system prompt.
   * Lets the agent personalize advice without another DB round trip.
   */
  userContext: z
    .object({
      currentRotation: z.string().max(64).nullable().optional(),
      examDate: z.string().max(40).nullable().optional(),
      focusSystem: z.string().max(64).nullable().optional(),
    })
    .optional(),

  /**
   * When true, the response includes the full `steps[]` transcript for
   * debugging and observability. Default false to keep payloads small.
   */
  includeSteps: z.boolean().optional(),
});

type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

interface AgentRunHandlerContext
  extends AuthenticatedContext,
    ValidatedContext<AgentRunRequest> {}

// ─── Response shape ─────────────────────────────────────────────────────────

interface AgentRunResponsePayload {
  finalText: string;
  stopReason: AgentRunResult['stopReason'];
  iterations: number;
  tokensUsed: AgentRunResult['tokensUsed'];
  durationMs: number;
  error?: AgentRunResult['error'];
  steps?: AgentRunResult['steps'];
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = aiEndpoint(
  AgentRunRequestSchema,
  async (context: AgentRunHandlerContext) => {
    const { env, auth, validated, waitUntil } = context;
    const log = createEndpointLogger('/api/agents/run', auth.userId);

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const registry = createDefaultToolRegistry();
      const allowedTools =
        validated.allowedTools && validated.allowedTools.length > 0
          ? validated.allowedTools
          : [...DEFAULT_TOOL_NAMES];

      const allowedCategories: ToolCategory[] =
        (validated.allowedCategories as ToolCategory[] | undefined) ?? ['read'];

      const toolContext: ToolExecutionContext = {
        prisma,
        userId: auth.userId,
        env: env as Record<string, unknown>,
        log: (level, message, data) => {
          if (level === 'error') log.error(message, data as Record<string, unknown>);
          else if (level === 'warn') log.warn(message, data as Record<string, unknown>);
          else log.info(message, data as Record<string, unknown>);
        },
      };

      const result = await runAgent({
        userMessage: validated.message,
        registry,
        config: {
          allowedTools,
          allowedCategories,
          maxIterations: validated.maxIterations,
          model: validated.model,
          temperature: validated.temperature,
          maxOutputTokens: validated.maxOutputTokens,
          userContext: validated.userContext ?? undefined,
          telemetryEndpoint: '/api/agents/run',
        },
        toolContext,
        geminiContext: {
          env: env as AuthenticatedContext['env'] & { GEMINI_API_KEY: string },
          auth: { userId: auth.userId },
          waitUntil,
        },
      });

      const payload: AgentRunResponsePayload = {
        finalText: result.finalText,
        stopReason: result.stopReason,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
      };
      if (result.error) payload.error = result.error;
      if (validated.includeSteps) payload.steps = result.steps;

      logAgentTelemetry({
        endpoint: '/api/agents/run',
        action: 'general',
        userId: auth.userId,
        stopReason: result.stopReason,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
        timestamp: new Date().toISOString(),
      });

      // Non-completed runs still return 200 with a stopReason — the client
      // renders the failure surface-side. 5xx is reserved for infra faults.
      return { data: payload };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Agent run failed', { error: message });
      return {
        status: 500,
        error: 'Agent run failed',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
