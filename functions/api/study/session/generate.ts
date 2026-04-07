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
import {
  reserveFromReservoir,
  requestRefill,
  deriveScope,
} from '../../../../lib/services/reservoir';
import { inferLearnerPhase } from '../../../../lib/nccpa-question-weighting';

// ─── Schema ────────────────────────────────────────────────────────────────
// Shared schema — single source of truth for this endpoint's request contract.
// To change the /api/study/session/generate contract, edit lib/api/schemas/sessions.ts.

import { SessionGenerateRequestSchema } from '../../../../lib/api/schemas/sessions';
// Size bounds are enforced by the shared schema; override min/max to match runtime constants.
const SessionGenerateSchema = z.object({
  body: SessionGenerateRequestSchema.extend({
    size: z.number().int().min(MIN_SESSION_SIZE).max(MAX_SESSION_SIZE).default(20),
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

      // Look up internal user ID + profile fields for phase inference
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: {
          id: true,
          currentRotation: true,
          eorTestDate: true,
          rotationEndDate: true,
          examDate: true,
          yearInProgram: true,
          trainingPhase: true,
        },
      });

      // Infer learner phase from profile (didactic / clinical / pance_prep)
      const learnerPhase = inferLearnerPhase(user);

      const scope = deriveScope(body.mode, { system: body.system, conditionId: body.conditionId });
      const sessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // ── Step 1: Try reservoir first ──
      let reservoirSource = false;
      let reservoirCount = 0;
      let result: any;

      try {
        const reserved = await reserveFromReservoir(
          prisma, user.id, scope, body.size, sessionId
        );
        reservoirCount = reserved.length;

        if (reserved.length >= body.size) {
          // Happy path: full session from reservoir
          const questions = await hydrateReservoirQuestions(prisma, reserved);
          reservoirSource = true;

          result = {
            sessionId,
            questions,
            metadata: {
              dueReviewCount: reserved.filter((r: any) => r.isReview).length,
              newCardCount: reserved.filter((r: any) => !r.isReview).length,
              systemDistribution: countSystems(questions),
              estimatedMinutes: Math.ceil((questions.length * 90) / 60),
              mode: body.mode,
              blueprintStage: body.blueprintStage,
              learnerPhase,
              source: 'reservoir',
            },
          };
        }
      } catch (reservoirErr: any) {
        // Reservoir failed — fall through to on-demand
        logger.info('Reservoir unavailable, falling back to on-demand', {
          error: reservoirErr.message,
        });
      }

      // ── Step 2: Fall back to on-demand if reservoir didn't fully cover ──
      if (!result) {
        const onDemandResult = await selectSessionQuestions(prisma, {
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

        result = {
          ...onDemandResult,
          metadata: {
            ...onDemandResult.metadata,
            learnerPhase,
            source: reservoirCount > 0 ? 'mixed' : 'on_demand',
          },
        };
      }

      // ── Step 3: Trigger background refill (fire-and-forget) ──
      if (context.waitUntil) {
        context.waitUntil(
          requestRefill(prisma, user.id, scope, 'post_session', learnerPhase)
            .catch((err: any) => logger.info('Background refill request failed', { error: err.message }))
        );
      }

      logger.info('Session generated', {
        sessionId: result.sessionId,
        mode: body.mode,
        questionCount: result.questions.length,
        dueReviews: result.metadata.dueReviewCount,
        newCards: result.metadata.newCardCount,
        stage: body.blueprintStage,
        source: result.metadata.source || 'on_demand',
        reservoirHit: reservoirSource,
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

// ─── Reservoir Helpers ──────────────────────────────────────────────────────

/**
 * Hydrate reserved reservoir items into full SelectedQuestion objects.
 */
async function hydrateReservoirQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  reserved: any[]
): Promise<any[]> {
  const questionIds = reserved.map((r: any) => r.questionId);

  // Fetch from PreGeneratedQuestion
  const preGenerated = await prisma.preGeneratedQuestion.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      questionData: true,
      system: true,
      difficulty: true,
      conditionId: true,
    },
  });

  // Fetch from Question table (for any not found in PreGeneratedQuestion)
  const preGenIds = new Set(preGenerated.map((q: any) => q.id));
  const remainingIds = questionIds.filter((id: string) => !preGenIds.has(id));
  let standardQuestions: any[] = [];
  if (remainingIds.length > 0) {
    standardQuestions = await prisma.question.findMany({
      where: { id: { in: remainingIds } },
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        system: true,
        difficulty: true,
        conditionId: true,
        category: true,
        topic: true,
        vignette: true,
      },
    });
  }

  // Build lookup
  const questionMap = new Map<string, any>();
  for (const q of preGenerated) {
    const data = q.questionData as any;
    questionMap.set(q.id, {
      id: q.id,
      question: data?.question || data?.stem || '',
      vignette: data?.vignette || null,
      options: data?.options || [],
      correctAnswer: data?.correctAnswer || data?.answer || '',
      correctAnswerIndex: data?.correctAnswerIndex ?? 0,
      explanation: data?.explanation || data?.rationale || null,
      system: q.system || data?.system || null,
      category: data?.subcategory || null,
      topic: data?.conditionName || null,
      difficulty: q.difficulty || data?.difficulty || null,
      conditionId: q.conditionId || null,
    });
  }
  for (const q of standardQuestions) {
    questionMap.set(q.id, {
      id: q.id,
      question: q.question || '',
      vignette: q.vignette || null,
      options: q.options || [],
      correctAnswer: q.correctAnswer || '',
      correctAnswerIndex: 0,
      explanation: q.explanation || null,
      system: q.system || null,
      category: q.category || null,
      topic: q.topic || null,
      difficulty: q.difficulty || null,
      conditionId: q.conditionId || null,
    });
  }

  // Return in reservoir priority order, with source annotation
  return reserved
    .map((r: any) => {
      const q = questionMap.get(r.questionId);
      if (!q) return null;
      return {
        ...q,
        source: r.isReview ? 'due_review' : 'new_card',
      };
    })
    .filter(Boolean);
}

/** Count questions per system for metadata */
function countSystems(questions: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    const sys = q.system || 'UNKNOWN';
    counts[sys] = (counts[sys] || 0) + 1;
  }
  return counts;
}
