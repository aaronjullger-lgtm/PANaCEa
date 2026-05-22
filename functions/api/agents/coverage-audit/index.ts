/**
 * POST /api/agents/coverage-audit
 *
 * Blueprint & Drill Coverage Agent endpoint. Runs the agent loop
 * with coverage tools to audit NCCPA blueprint coverage and drill
 * content distribution.
 *
 * Uses COVERAGE_TOOLS: blueprint_coverage_check, drill_coverage_check.
 *
 * Auth: authenticatedEndpoint (Clerk token required).
 * Rate limit: 15 req/min.
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
import { logAgentTelemetry } from '../../../../lib/services/agents/telemetry';
import {
  COVERAGE_TOOLS,
} from '../../../../lib/services/agents/tools';

// ─── Request schema ─────────────────────────────────────────────────────────

const RequestSchema = z.object({
  action: z.enum([
    'blueprint_coverage',
    'drill_coverage',
    'full_coverage',
  ]).describe('What coverage analysis to perform'),
  system: z.string().max(64).optional()
    .describe('Organ system filter (omit for all systems)'),
  drillType: z.string().max(64).optional()
    .describe('Drill type filter (e.g. "AnatomyDrill")'),

  includeSteps: z.boolean().optional(),
  customInstruction: z.string().max(500).optional(),
});

type Request = z.infer<typeof RequestSchema>;

// ─── Action → agent prompt mapping ─────────────────────────────────────────

function buildAgentPrompt(action: Request['action'], req: Request): string {
  const sys = req.system ? ` for ${req.system}` : '';
  const drill = req.drillType ? ` of type ${req.drillType}` : '';

  switch (action) {
    case 'blueprint_coverage':
      return `Analyze NCCPA 2025 blueprint coverage${sys}.
1. Check actual vs target question counts for each system.
2. Identify systems with critical coverage gaps (coverage < 50%).
3. Prioritize which systems need question generation first.
4. Report coverage ratios, deficits, and status for each system.`;
    case 'drill_coverage':
      return `Audit drill content coverage${drill}${sys}.
1. Check item counts for each drill type.
2. Identify drill types below the minimum threshold (25 items).
3. Flag drill types with zero content (critical).
4. Report which drill types need content generation.`;
    case 'full_coverage':
      return `Run a comprehensive coverage audit${sys}.
1. Check blueprint coverage for all organ systems.
2. Audit drill content across all 13 drill types.
3. Identify both question gaps and drill gaps.
4. Report the top priority areas for content generation.`;
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  RequestSchema,
  async (context: AuthenticatedContext & ValidatedContext<Request>) => {
    const { env, auth, validated, waitUntil } = context;
    const log = createEndpointLogger('/api/agents/coverage-audit', auth.userId);

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const registry = new ToolRegistry(COVERAGE_TOOLS);
      const toolNames = COVERAGE_TOOLS.map((t) => t.name);

      const userPrompt = validated.customInstruction
        ?? buildAgentPrompt(validated.action, validated);

      const result = await runAgent({
        userMessage: userPrompt,
        registry,
        config: {
          allowedTools: toolNames,
          allowedCategories: ['read'],
          maxIterations: validated.action === 'full_coverage' ? 6 : 4,
          telemetryEndpoint: '/api/agents/coverage-audit',
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
        endpoint: '/api/agents/coverage-audit',
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
      log.error('Coverage audit agent failed', { error: message });
      return { status: 500, error: 'Coverage audit agent run failed' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
