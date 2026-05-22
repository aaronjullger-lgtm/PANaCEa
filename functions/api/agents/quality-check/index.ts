/**
 * POST /api/agents/quality-check
 *
 * Content Quality & Verification Agent endpoint. Runs the agent loop
 * with quality/verification tools to audit content health, check
 * psychometrics, and verify medical accuracy.
 *
 * Uses the QUALITY_TOOLS registry: content_health_audit,
 * question_quality_check, condition_verify.
 *
 * Auth: authenticatedEndpoint (Clerk token required).
 * Rate limit: 10 req/min (expensive tool execution).
 */

import { z } from 'zod';
import {
  authenticatedEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import {
  runAgent,
  ToolRegistry,
  type AgentRunResult,
} from '../../../../lib/services/agents';
import { logAgentTelemetry } from '../../../../lib/services/agents/telemetry';
import {
  QUALITY_TOOLS,
} from '../../../../lib/services/agents/tools';

// ─── Request schema ─────────────────────────────────────────────────────────

const RequestSchema = z.object({
  action: z.enum([
    'audit_all',
    'check_question',
    'verify_condition',
    'scan_quality',
  ]).describe('What quality action to perform'),
  targetId: z.string().optional()
    .describe('Question or condition ID for targeted checks'),
  targetName: z.string().max(200).optional()
    .describe('Condition name for search-based checks'),
  system: z.string().max(64).optional()
    .describe('Organ system filter'),

  /** When true, include the full agent transcript in the response. */
  includeSteps: z.boolean().optional(),
  /** Override the auto-generated prompt with custom instructions. */
  customInstruction: z.string().max(500).optional(),
});

type Request = z.infer<typeof RequestSchema>;

// ─── Action → agent prompt mapping ─────────────────────────────────────────

function buildAgentPrompt(action: Request['action'], req: Request): string {
  const target = req.targetId ? ` (ID: ${req.targetId})` : '';
  const name = req.targetName ? ` for "${req.targetName}"` : '';
  const sys = req.system ? ` in the ${req.system} system` : '';

  switch (action) {
    case 'audit_all':
      return `Run a comprehensive content quality audit${sys}. 
1. Check content health across all relevant questions.
2. Identify questions below the health threshold.
3. Flag any conditions with AI refusal language or missing required fields.
4. Report the top issues sorted by severity.`;
    case 'check_question':
      return `Analyze the psychometric quality of question${target}${sys}.
1. Check its attempt count, correct rate, and difficulty.
2. Identify any psychometric issues (discrimination, difficulty extremes, high switches).
3. Report whether it needs the self-refine pipeline.`;
    case 'verify_condition':
      return `Verify the clinical accuracy and completeness of condition${target}${name}${sys}.
1. Check for AI refusal language in overview, diagnosis, and treatment fields.
2. Verify all required fields are present and meet minimum thresholds.
3. Check if content is stale (not updated recently).
4. Report a quality score and list of issues.`;
    case 'scan_quality':
      return `Scan for content quality issues across questions${sys}.
1. Find questions with high flag counts or low health scores.
2. Run psychometric checks on under-performing items.
3. Identify conditions needing medical review.
4. Report the worst offenders first.`;
    default:
      return 'Run a content quality audit and report all issues found.';
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  RequestSchema,
  async (context: AuthenticatedContext & ValidatedContext<Request>) => {
    const { env, auth, validated, waitUntil } = context;
    const log = createEndpointLogger('/api/agents/quality-check', auth.userId);

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const registry = new ToolRegistry(QUALITY_TOOLS);
      const toolNames = QUALITY_TOOLS.map((t) => t.name);

      const userPrompt = validated.customInstruction
        ?? buildAgentPrompt(validated.action, validated);

      const result = await runAgent({
        userMessage: userPrompt,
        registry,
        config: {
          allowedTools: toolNames,
          allowedCategories: ['read'],
          maxIterations: validated.action === 'audit_all' ? 6 : 4,
          telemetryEndpoint: '/api/agents/quality-check',
        },
        toolContext: {
          prisma,
          userId: auth.userId,
          env: env as Record<string, unknown>,
          log: (level, msg, data) => {
            if (level === 'error') log.error(msg, data as Record<string, unknown>);
            else if (level === 'warn') log.warn(msg, data as Record<string, unknown>);
            else log.info(msg, data as Record<string, unknown>);
          },
        },
        geminiContext: {
          env: env as AuthenticatedContext['env'] & { GEMINI_API_KEY: string },
          auth: { userId: auth.userId },
          waitUntil,
        },
      });

      const payload: Record<string, unknown> = {
        action: validated.action,
        finalText: result.finalText,
        stopReason: result.stopReason,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
      };
      if (result.error) payload.error = result.error;
      if (validated.includeSteps) payload.steps = result.steps;

      logAgentTelemetry({
        endpoint: '/api/agents/quality-check',
        action: validated.action,
        userId: auth.userId,
        stopReason: result.stopReason,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
        timestamp: new Date().toISOString(),
      });

      return { data: payload };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Quality check agent failed', { error: message });
      return { status: 500, error: 'Quality check agent run failed' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
