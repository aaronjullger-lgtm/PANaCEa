/**
 * POST /api/agents/verify-condition
 *
 * Medical Content Verification Agent endpoint. Targets a specific
 * condition for clinical accuracy validation using the condition_verify
 * tool plus optional cross-references.
 *
 * Uses QUALITY_TOOLS: condition_verify (primary),
 * plus clinical_library_search for cross-referencing.
 *
 * Auth: authenticatedEndpoint (Clerk token required).
 * Rate limit: 20 req/min.
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
  clinicalLibrarySearchTool,
  conditionVerifyTool,
} from '../../../../lib/services/agents/tools';

// ─── Request schema ─────────────────────────────────────────────────────────

const RequestSchema = z.object({
  conditionId: z.string().min(1).max(64).optional()
    .describe('Condition ID to verify. Required unless conditionName is provided.'),
  conditionName: z.string().min(2).max(200).optional()
    .describe('Condition name to search and verify. Required unless conditionId is provided.'),
  /** When true, also cross-reference with clinical library search results. */
  crossReference: z.boolean().optional()
    .describe('Also search for related conditions to cross-reference. Default false.'),
  includeSteps: z.boolean().optional(),
  customInstruction: z.string().max(500).optional(),
})
  .refine(
    (data) => data.conditionId || data.conditionName,
    { message: 'Either conditionId or conditionName is required' }
  );

type Request = z.infer<typeof RequestSchema>;

// ─── Action → agent prompt mapping ─────────────────────────────────────────

function buildAgentPrompt(req: Request): string {
  const target = req.conditionId
    ? `Verify condition with ID: ${req.conditionId}`
    : `Search for and verify condition named: ${req.conditionName}`;

  const crossRef = req.crossReference
    ? '\nAfter verification, also search for related conditions and cross-reference findings.'
    : '';

  return `${target}.
1. Check for AI-generated refusal/hallucination language in the content.
2. Verify all required fields are present: overview (≥100 chars), symptoms (≥3), clinical pearls (≥2), diagnosis (≥50 chars), treatment.
3. Check if the content is stale (not updated in >365 days).
4. Report an overall quality score and list every issue found.${crossRef}`;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  RequestSchema,
  async (context: AuthenticatedContext & ValidatedContext<Request>) => {
    const { env, auth, validated, waitUntil } = context;
    const log = createEndpointLogger('/api/agents/verify-condition', auth.userId);

    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const tools = validated.crossReference
        ? [conditionVerifyTool, clinicalLibrarySearchTool]
        : [conditionVerifyTool];
      const registry = new ToolRegistry(tools);

      const userPrompt = validated.customInstruction
        ?? buildAgentPrompt(validated);

      const result = await runAgent({
        userMessage: userPrompt,
        registry,
        config: {
          allowedTools: tools.map((t) => t.name),
          allowedCategories: ['read'],
          maxIterations: validated.crossReference ? 4 : 2,
          telemetryEndpoint: '/api/agents/verify-condition',
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
        conditionId: validated.conditionId,
        conditionName: validated.conditionName,
        crossReferenced: validated.crossReference ?? false,
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
      log.error('Verify condition agent failed', { error: message });
      return { status: 500, error: 'Verify condition agent run failed' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
