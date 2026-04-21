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
import { authenticatedEndpoint } from '../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../_shared/endpoint';
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
import { resolveCorrectAnswerIndex } from '../../../../lib/answerLetterMap';
import {
  buildGeneratedStudySessionRecord,
  normalizeSessionGenerateResult,
} from '../../../../lib/sessionGeneration';

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
        return fail(ErrorCode.VALIDATION_FAILED, { message: 'system is required for system mode' });
      }
      if (body.mode === 'subcategory' && (!body.system || !body.subcategory)) {
        return fail(ErrorCode.VALIDATION_FAILED, { message: 'system and subcategory are required for subcategory mode' });
      }
      if (body.mode === 'condition' && !body.conditionId) {
        return fail(ErrorCode.VALIDATION_FAILED, { message: 'conditionId is required for condition mode' });
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
      } catch (reservoirErr: unknown) {
        // Reservoir failed — fall through to on-demand
        logger.info('Reservoir unavailable, falling back to on-demand', {
          error: reservoirErr instanceof Error ? reservoirErr.message : String(reservoirErr),
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

      const normalizedResult = normalizeSessionGenerateResult(result);
      const persistedSession = buildGeneratedStudySessionRecord({
        request: {
          mode: body.mode,
          initialDifficulty: body.initialDifficulty,
          systems: body.systems,
          system: body.system,
          blueprintStage: body.blueprintStage,
          blueprintExamTypes: body.blueprintExamTypes,
          blueprintLabel: body.blueprintLabel,
          sessionLane: body.sessionLane,
        },
        result: normalizedResult,
      });

      await prisma.studySession.upsert({
        where: { id: persistedSession.id },
        create: {
          id: persistedSession.id,
          userId: user.id,
          startedAt: new Date(),
          totalQuestions: persistedSession.totalQuestions,
          mode: persistedSession.mode ?? null,
          focus: persistedSession.focus,
          difficulty: persistedSession.difficulty,
          systemsTargeted: persistedSession.systemsTargeted,
          questionIds: persistedSession.questionIds,
          blueprintStage: persistedSession.blueprintStage ?? null,
          blueprintExamTypes: persistedSession.blueprintExamTypes,
          blueprintLabel: persistedSession.blueprintLabel ?? null,
          sessionType: persistedSession.sessionType ?? null,
          updatedAt: new Date(),
        },
        update: {
          totalQuestions: persistedSession.totalQuestions,
          mode: persistedSession.mode ?? null,
          focus: persistedSession.focus,
          difficulty: persistedSession.difficulty,
          systemsTargeted: persistedSession.systemsTargeted,
          questionIds: persistedSession.questionIds,
          blueprintStage: persistedSession.blueprintStage ?? null,
          blueprintExamTypes: persistedSession.blueprintExamTypes,
          blueprintLabel: persistedSession.blueprintLabel ?? null,
          sessionType: persistedSession.sessionType ?? null,
          updatedAt: new Date(),
        },
      });

      logger.info('Session generated', {
        sessionId: normalizedResult.sessionId,
        mode: body.mode,
        questionCount: normalizedResult.questions.length,
        dueReviews: normalizedResult.metadata.dueReviewCount,
        newCards: normalizedResult.metadata.newCardCount,
        stage: body.blueprintStage,
        source: normalizedResult.metadata.source || 'on_demand',
        reservoirHit: reservoirSource,
      });

      return ok(normalizedResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Session generation failed';
      logger.error('Session generation failed', {
        error: message,
        mode: validated.body.mode,
      });
      return fail(ErrorCode.INTERNAL_ERROR, { message });
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
    const opts = Array.isArray(data?.options) ? data.options : [];
    const rawAns = data?.correctAnswer || data?.answer || '';
    // Patient safety: never silently fall back to 0 (option A). Prefer the
    // server-provided index; if missing/invalid, resolve from the correctAnswer
    // string; otherwise emit -1 so the client normalizer surfaces the data bug.
    let idx: number;
    const providedIdx = typeof data?.correctAnswerIndex === 'number' ? data.correctAnswerIndex : null;
    if (providedIdx !== null && providedIdx >= 0 && providedIdx < opts.length) {
      idx = providedIdx;
    } else {
      const resolved = resolveCorrectAnswerIndex(String(rawAns), opts);
      if (resolved === null) {
        console.error('[session/generate] pre-generated question has unresolvable correctAnswer', {
          questionId: q.id,
          correctAnswer: rawAns,
          optionCount: opts.length,
        });
      }
      idx = resolved ?? -1;
    }
    questionMap.set(q.id, {
      id: q.id,
      question: data?.question || data?.stem || '',
      vignette: data?.vignette || null,
      options: opts,
      correctAnswer: rawAns,
      correctAnswerIndex: idx,
      explanation: data?.explanation || data?.rationale || null,
      system: q.system || data?.system || null,
      category: data?.subcategory || null,
      topic: data?.conditionName || null,
      difficulty: q.difficulty || data?.difficulty || null,
      conditionId: q.conditionId || null,
    });
  }
  for (const q of standardQuestions) {
    const opts = Array.isArray(q.options) ? q.options : [];
    const rawAns = q.correctAnswer || '';
    // Patient safety: standard questions carry correctAnswer as a string
    // (e.g. "B" or the full option text). Resolve to an index; never default
    // to 0 silently — that would grade every unresolved question as "A".
    const resolved = resolveCorrectAnswerIndex(String(rawAns), opts);
    if (resolved === null) {
      console.error('[session/generate] standard question has unresolvable correctAnswer', {
        questionId: q.id,
        correctAnswer: rawAns,
        optionCount: opts.length,
      });
    }
    questionMap.set(q.id, {
      id: q.id,
      question: q.question || '',
      vignette: q.vignette || null,
      options: opts,
      correctAnswer: rawAns,
      correctAnswerIndex: resolved ?? -1,
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
