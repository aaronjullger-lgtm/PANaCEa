/**
 * POST /api/agents/infra-health
 *
 * Infrastructure Health Agent endpoint. Runs the agent loop with
 * infrastructure tools to audit database integrity, FSRS calibration,
 * and overall system health.
 *
 * Uses INFRA_TOOLS: database_integrity_check, fsrs_calibration_status.
 *
 * Auth: authenticatedEndpoint (Clerk token required).
 * Rate limit: 10 req/min.
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
} from '../../../../lib/services/agents';
import {
  INFRA_TOOLS,
} from '../../../../lib/services/agents/tools';

// ─── Request schema ─────────────────────────────────────────────────────────

const RequestSchema = z.object({
  action: z.enum([
    'db_integrity',
    'fsrs_health',
    'full_health',
  ]).describe('What health check to perform'),
  userId: z.string().optional()
    .describe('Check FSRS health for a specific user (fsrs_health only)'),
  includeSteps: z.boolean().optional(),
  customInstruction: z.string().max(500).optional(),
});

type Request = z.infer<typeof RequestSchema>;

// ─── Action → agent prompt mapping ─────────────────────────────────────────

function buildAgentPrompt(action: Request['action'], req: Request): string {
  const userContext = req.userId ? ` for user ${req.userId}` : '';

  switch (action) {
    case 'db_integrity':
      return `Run a database integrity check on PANaCEa.
1. Check for orphan records across all key relationships (QuestionAttempt, ReviewLog, Card, StudentReservoirItem, ItemDifficulty).
2. Report orphan counts per table and severity.
3. Provide an overall database health status.`;
    case 'fsrs_health':
      return `Check FSRS scheduling health${userContext}.
1. Count active cards, overdue items, and ease hell cases.
2. Check difficulty distribution and stability averages.
3. Calculate the 7-day review backlog.
4. Report calibration status (healthy/warning/critical) and any issues found.`;
    case 'full_health':
      return `Run a comprehensive infrastructure health check on PANaCEa.
1. Check database integrity (orphan records across all key relationships).
2. Check FSRS calibration status (overdue cascades, ease hell, difficulty compression).
3. Report overall health status with all issues found, sorted by severity.`;
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  RequestSchema,
  async (context: AuthenticatedContext & ValidatedContext<Request>) => {
    const { env, auth, validated, waitUntil } = context;
    const log = createEndpointLogger('/api/agents/infra-health', auth.userId);

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const registry = new ToolRegistry(INFRA_TOOLS);
      const toolNames = INFRA_TOOLS.map((t) => t.name);

      const userPrompt = validated.customInstruction
        ?? buildAgentPrompt(validated.action, validated);

      const result = await runAgent({
        userMessage: userPrompt,
        registry,
        config: {
          allowedTools: toolNames,
          allowedCategories: ['read'],
          maxIterations: validated.action === 'full_health' ? 4 : 2,
          telemetryEndpoint: '/api/agents/infra-health',
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

      return { data: payload };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('Infra health agent failed', { error: message });
      return { status: 500, error: 'Infrastructure health agent run failed' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
