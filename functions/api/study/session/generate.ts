/**
 * API: POST /api/study/session/generate
 *
 * Generates a study session by selecting questions through the concept-level
 * FSRS pipeline. Bridges blueprint resolution → concept selection → question serving.
 *
 * Request body:
 *   - mode: 'adaptive' | 'system' | 'subcategory' | 'condition'
 *   - size: number (10-50)
 *   - blueprintWeights: Record<string, number>
 *   - system?: string (required for system/subcategory modes)
 *   - subcategory?: string (required for subcategory mode)
 *   - conditionId?: string (required for condition mode)
 *   - boostSystems?: string[]
 *   - suppressSystems?: string[]
 *   - perSystemCaps?: Record<string, number>
 *   - blueprintStage: string
 *   - blueprintExamTypes?: string[]
 *   - blueprintLabel?: string
 *   - urgencyMultiplier?: number
 *   - gatedSystems?: string[]
 *
 * Response: { sessionId, questions[], metadata }
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { selectSessionQuestions } from '../../../../lib/services/conceptQuestionSelector';
import { MIN_SESSION_SIZE, MAX_SESSION_SIZE } from '../../../../lib/constants/sessionDefaults';

// ─── Schema ────────────────────────────────────────────────────────────────

const SessionGenerateSchema = z.object({
  body: z.object({
    mode: z.enum(['adaptive', 'system', 'subcategory', 'condition', 'review', 'focused']).default('adaptive'),
    size: z.number().int().min(MIN_SESSION_SIZE).max(MAX_SESSION_SIZE).default(20),
    blueprintWeights: z.record(z.string(), z.number()).default({}),

    // Scope filters
    system: z.string().optional(),
    subcategory: z.string().optional(),
    conditionId: z.string().optional(),

    // Distribution constraints
    boostSystems: z.array(z.string()).optional(),
    suppressSystems: z.array(z.string()).optional(),
    perSystemCaps: z.record(z.string(), z.number()).optional(),

    // Learner context
    blueprintStage: z.string().default('general'),
    blueprintExamTypes: z.array(z.string()).optional(),
    blueprintLabel: z.string().optional(),
    urgencyMultiplier: z.number().min(0).max(3).default(1),
    gatedSystems: z.array(z.string()).optional(),
  }),
});

// ─── CORS ───────────────────────────────────────────────────────────────────

export const onRequestOptions = withCors();

// ─── Handler ────────────────────────────────────────────────────────────────

export const onRequestPost = authenticatedEndpoint(
  SessionGenerateSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/study/session/generate');
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const body = validated.body;

      // Validate mode-specific requirements
      if (body.mode === 'system' && !body.system) {
        return new Response(
          JSON.stringify({ error: 'system is required for system mode' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (body.mode === 'subcategory' && (!body.system || !body.subcategory)) {
        return new Response(
          JSON.stringify({ error: 'system and subcategory are required for subcategory mode' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (body.mode === 'condition' && !body.conditionId) {
        return new Response(
          JSON.stringify({ error: 'conditionId is required for condition mode' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Look up internal user ID from Clerk ID
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      // Generate session
      const result = await selectSessionQuestions(prisma, {
        userId: user.id,
        mode: body.mode as any,
        size: body.size,
        blueprintWeights: body.blueprintWeights,
        system: body.system,
        subcategory: body.subcategory,
        conditionId: body.conditionId,
        boostSystems: body.boostSystems,
        suppressSystems: body.suppressSystems,
        perSystemCaps: body.perSystemCaps,
        blueprintStage: body.blueprintStage as any,
        urgencyMultiplier: body.urgencyMultiplier,
        gatedSystems: body.gatedSystems,
      });

      logger.info('Session generated', {
        sessionId: result.sessionId,
        mode: body.mode,
        questionCount: result.questions.length,
        dueReviews: result.metadata.dueReviewCount,
        newCards: result.metadata.newCardCount,
        stage: body.blueprintStage,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      logger.error('Session generation failed', {
        error: err.message,
        mode: validated.body.mode,
      });
      return new Response(
        JSON.stringify({ error: err.message ?? 'Session generation failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
