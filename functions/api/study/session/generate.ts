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
import { createCanonicalQuestionMirrors } from '../../_shared/canonical-question-mirror';
import { selectSessionQuestions } from '../../../../lib/services/conceptQuestionSelector';
import { MIN_SESSION_SIZE, MAX_SESSION_SIZE } from '../../../../lib/constants/sessionDefaults';
import {
  reserveFromReservoir,
  releaseReservation,
  failReservation,
  requestRefill,
  deriveScope,
} from '../../../../lib/services/reservoir';
import { inferLearnerPhase } from '../../../../lib/nccpa-question-weighting';
import { resolveCorrectAnswerIndex } from '../../../../lib/answerLetterMap';
import {
  buildGeneratedStudySessionRecord,
  buildStudySessionQuestionRecords,
  normalizeSessionGenerateResult,
} from '../../../../lib/sessionGeneration';
import { resolveOrCreateUserRecord } from '../../_shared/user-resolver';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../../../../lib/services/questionServingSafety';

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

      // Clerk auth can succeed before the webhook-created User row exists.
      // Bootstrap a minimal row so first-login users can start studying.
      const user = await resolveOrCreateUserRecord(prisma, auth.userId, {
        id: true,
        currentRotation: true,
        eorTestDate: true,
        rotationEndDate: true,
        examDate: true,
        yearInProgram: true,
        trainingPhase: true,
      });

      // Infer learner phase from profile (didactic / clinical / pance_prep)
      const learnerPhase = inferLearnerPhase(user);

      const scope = deriveScope(body.mode, {
        system: body.system,
        subcategory: body.subcategory,
        conditionId: body.conditionId,
      });
      const sessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // ── Step 1: Try reservoir first ──
      let reservoirSource = false;
      let reservoirCount = 0;
      let reservedQuestions: Awaited<ReturnType<typeof reserveFromReservoir>> = [];
      let usableReservedQuestionIds: string[] = [];
      let unusableReservedQuestionIds: string[] = [];
      let result: any;

      try {
        const reserved = await reserveFromReservoir(
          prisma, user.id, scope, body.size, sessionId
        );
        reservedQuestions = reserved;
        reservoirCount = reserved.length;

        if (reserved.length > 0) {
          const questions = filterUsableQuestions(await hydrateReservoirQuestions(prisma, reserved));
          usableReservedQuestionIds = questions.map((question: any) => question.sourceQuestionId ?? question.id);

          if (reserved.length >= body.size && questions.length >= body.size) {
            // Happy path: full session from reservoir
            reservoirSource = true;

            result = {
              sessionId,
              questions,
              metadata: {
                dueReviewCount: questions.filter((q: any) => q.source === 'due_review').length,
                newCardCount: questions.filter((q: any) => q.source !== 'due_review').length,
                systemDistribution: countSystems(questions),
                estimatedMinutes: Math.ceil((questions.length * 90) / 60),
                mode: body.mode,
                blueprintStage: body.blueprintStage,
                learnerPhase,
                source: 'reservoir',
              },
            };
          } else {
            const usableIds = new Set(usableReservedQuestionIds);
            unusableReservedQuestionIds = reserved
              .map((item: any) => item.questionId)
              .filter((questionId: string) => !usableIds.has(questionId));
            logger.info('Reservoir reservation did not hydrate enough production-safe questions', {
              reservedCount: reserved.length,
              usableCount: questions.length,
              unusableCount: unusableReservedQuestionIds.length,
              requestedSize: body.size,
              mode: body.mode,
            });
          }
        }
      } catch (reservoirErr: unknown) {
        // Reservoir failed — fall through to on-demand
        logger.info('Reservoir unavailable, falling back to on-demand', {
          error: reservoirErr instanceof Error ? reservoirErr.message : String(reservoirErr),
        });
      }

      // ── Step 2: Fall back to on-demand if reservoir didn't fully cover ──
      if (!result) {
        if (reservedQuestions.length > 0) {
          const unusableIds = new Set(unusableReservedQuestionIds);
          const releasableQuestionIds = usableReservedQuestionIds.length > 0
            ? usableReservedQuestionIds.filter((questionId) => !unusableIds.has(questionId))
            : reservedQuestions
                .map((item) => item.questionId)
                .filter((questionId) => !unusableIds.has(questionId));

          if (unusableReservedQuestionIds.length > 0) {
            try {
              await failReservation(prisma, sessionId, unusableReservedQuestionIds);
            } catch (failErr: unknown) {
              logger.info('Reservoir reservation failure marking failed', {
                error: failErr instanceof Error ? failErr.message : String(failErr),
                failedCount: unusableReservedQuestionIds.length,
              });
            }
          }

          try {
            if (releasableQuestionIds.length > 0) {
              await releaseReservation(prisma, sessionId, releasableQuestionIds);
            }
          } catch (releaseErr: unknown) {
            logger.info('Partial reservoir reservation release failed', {
              error: releaseErr instanceof Error ? releaseErr.message : String(releaseErr),
              reservedCount: releasableQuestionIds.length,
            });
          }
        }

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

        const safeQuestions = filterUsableQuestions(onDemandResult.questions);
        const fallbackQuestions =
          safeQuestions.length < body.size
            ? await fetchFallbackPregeneratedQuestions(prisma, {
                userId: user.id,
                size: body.size - safeQuestions.length,
                excludeQuestionIds: safeQuestions.map((q: any) => q.id),
                system: body.system,
                conditionId: body.conditionId,
                gatedSystems: body.gatedSystems ?? [],
                blueprintWeights: body.blueprintWeights,
              })
            : [];
        const questions = [...safeQuestions, ...fallbackQuestions].slice(0, body.size);
        if (questions.length < body.size) {
          logger.warn('Study session question pool shortage; refusing learner-facing dynamic generation', {
            requestedSize: body.size,
            availableSafeQuestions: questions.length,
            mode: body.mode,
            system: body.system,
            conditionId: body.conditionId,
          });
        }
        const dynamicQuestions: any[] = [];
        const completedQuestions = [...questions, ...dynamicQuestions].slice(0, body.size);

        result = {
          ...onDemandResult,
          questions: completedQuestions,
          metadata: {
            ...onDemandResult.metadata,
            dueReviewCount: completedQuestions.filter((q: any) => q.source === 'due_review').length,
            newCardCount: completedQuestions.filter((q: any) => q.source !== 'due_review').length,
            systemDistribution: countSystems(completedQuestions),
            estimatedMinutes: Math.ceil((completedQuestions.length * 90) / 60),
            learnerPhase,
            source: dynamicQuestions.length > 0
              ? 'on_demand'
              : fallbackQuestions.length > 0
              ? 'pregenerated_fallback'
              : reservoirCount > 0
                ? 'mixed'
                : 'on_demand',
          },
        };
      }

      // ── Step 3: Trigger background refill (fire-and-forget) ──
      if (context.waitUntil) {
        context.waitUntil(
          Promise.resolve(requestRefill(prisma, user.id, scope, 'post_session', learnerPhase))
            .catch((err: any) => logger.info('Background refill request failed', { error: err.message }))
        );
      }

      const normalizedResult = normalizeSessionGenerateResult(result);
      const canonicalizedPregeneratedIds = await ensureCanonicalQuestionTargetsForPregenerated(
        prisma,
        normalizedResult.questions,
        logger
      );
      if (canonicalizedPregeneratedIds.size > 0) {
        normalizedResult.questions = normalizedResult.questions.map((question) => {
          const sourceQuestionId = question.sourceQuestionId ?? question.id;
          if (question.questionSource !== 'pre_generated' || !canonicalizedPregeneratedIds.has(sourceQuestionId)) {
            return question;
          }

          return {
            ...question,
            questionId: sourceQuestionId,
            canonicalQuestionId: sourceQuestionId,
          };
        });
      }
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
      await persistStudySessionQuestionLinks(
        prisma,
        normalizedResult.sessionId,
        normalizedResult.questions,
        logger
      );

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
      return fail(ErrorCode.INTERNAL_ERROR, {
        message: 'Unable to generate a study session right now. Please try again.',
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { requestsPerMinute: 30 }
);

// ─── Reservoir Helpers ──────────────────────────────────────────────────────

async function ensureCanonicalQuestionTargetsForPregenerated(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  questions: ReturnType<typeof normalizeSessionGenerateResult>['questions'],
  logger: ReturnType<typeof createEndpointLogger>
): Promise<Set<string>> {
  const mirrorInputs = questions
    .filter((question) => question.questionSource === 'pre_generated')
    .flatMap((question) => {
      const id = question.sourceQuestionId ?? question.id;
      if (!id) return [];

      return {
        id,
        questionData: {
          ...question,
          stem: question.question,
          rationale: question.explanation ?? question.rationale ?? '',
        },
        system: question.system ?? 'General',
        difficulty: question.difficulty ?? 'medium',
        conditionId: question.conditionId,
        medicalContentId: question.medicalContentId,
      };
    });

  if (mirrorInputs.length === 0) return new Set();

  try {
    return await createCanonicalQuestionMirrors(prisma as any, mirrorInputs, {
      source: 'pre_generated_approved',
    });
  } catch (error) {
    logger.warn('Failed to pre-canonicalize pre-generated session questions; submit path will retain FK fallback', {
      count: mirrorInputs.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set();
  }
}

async function persistStudySessionQuestionLinks(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  sessionId: string,
  questions: ReturnType<typeof normalizeSessionGenerateResult>['questions'],
  logger: ReturnType<typeof createEndpointLogger>
): Promise<void> {
  const delegate = (prisma as any).studySessionQuestion;
  if (!delegate?.deleteMany || !delegate?.createMany) {
    logger.info('StudySessionQuestion delegate unavailable; session questionIds remain the resume source', {
      sessionId,
    });
    return;
  }

  const records = buildStudySessionQuestionRecords(sessionId, questions);
  try {
    await delegate.deleteMany({ where: { sessionId } });
    if (records.length > 0) {
      await delegate.createMany({
        data: records,
        skipDuplicates: true,
      });
    }
  } catch (error: unknown) {
    logger.warn('StudySessionQuestion link persistence failed; session questionIds remain the fallback source', {
      sessionId,
      recordCount: records.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function normalizeOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((option) => {
        if (typeof option === 'string') return option;
        if (option && typeof option === 'object' && 'text' in option) {
          return String((option as { text?: unknown }).text ?? '');
        }
        return String(option ?? '');
      })
      .map((option) => option.trim())
      .filter(Boolean);
  }

  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .map((option) => String(option ?? '').trim())
      .filter(Boolean);
  }

  return [];
}

function isUsableQuestion(question: any): boolean {
  return (
    question &&
    typeof question.id === 'string' &&
    typeof question.question === 'string' &&
    question.question.trim().length > 0 &&
    Array.isArray(question.options) &&
    question.options.length >= 2 &&
    typeof question.correctAnswerIndex === 'number' &&
    question.correctAnswerIndex >= 0 &&
    question.correctAnswerIndex < question.options.length
  );
}

function filterUsableQuestions(questions: any[]): any[] {
  return Array.isArray(questions) ? questions.filter(isUsableQuestion) : [];
}

async function fetchFallbackPregeneratedQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  options: {
    userId: string;
    size: number;
    excludeQuestionIds: string[];
    system?: string;
    conditionId?: string;
    gatedSystems: string[];
    blueprintWeights: Record<string, number>;
  }
): Promise<any[]> {
  if (options.size <= 0) return [];

  const recentSeen = await prisma.userQuestionSeen.findMany({
    where: { userId: options.userId },
    select: { questionId: true },
    orderBy: { lastSeenAt: 'desc' },
    take: 500,
  });

  const excluded = new Set([
    ...options.excludeQuestionIds,
    ...recentSeen.map((row: any) => row.questionId),
  ]);
  const systemCandidates = Object.keys(options.blueprintWeights ?? {})
    .filter((system) => !options.gatedSystems.includes(system));

  const where: any = withProductionPregeneratedSafety({});
  if (options.conditionId) {
    where.OR = [
      { conditionId: options.conditionId },
      { medicalContentId: options.conditionId },
    ];
  } else if (options.system) {
    where.system = options.system;
  } else if (systemCandidates.length > 0) {
    where.system = { in: systemCandidates };
  }

  const rows = await prisma.preGeneratedQuestion.findMany({
    where,
    select: {
      id: true,
      questionData: true,
      system: true,
      difficulty: true,
      conditionId: true,
      medicalContentId: true,
    },
    orderBy: { generatedAt: 'desc' },
    take: Math.max(options.size * 5, 25),
  });

  const firstPass = rows.filter((row: any) => !excluded.has(row.id));
  const pool = firstPass.length > 0
    ? firstPass
    : rows.filter((row: any) => !options.excludeQuestionIds.includes(row.id));
  const questions: any[] = [];

  for (const row of pool) {
    if (questions.length >= options.size) break;

    const data = row.questionData as any;
    const opts = normalizeOptions(data?.options ?? data?.answers ?? data?.choices);
    const rawAns = data?.correctAnswer ?? data?.answer ?? data?.correct_option ?? '';
    const providedIdx = typeof data?.correctAnswerIndex === 'number' ? data.correctAnswerIndex : null;
    const resolvedIdx =
      providedIdx !== null && providedIdx >= 0 && providedIdx < opts.length
        ? providedIdx
        : resolveCorrectAnswerIndex(String(rawAns), opts);

    const question = {
      id: row.id,
      question: data?.question || data?.stem || data?.vignette || '',
      vignette: data?.vignette || null,
      options: opts,
      correctAnswer: String(rawAns || (resolvedIdx !== null ? opts[resolvedIdx] : '')),
      correctAnswerIndex: resolvedIdx ?? -1,
      explanation: data?.explanation || data?.rationale || null,
      system: row.system || data?.system || null,
      category: data?.subcategory || data?.category || null,
      topic: data?.conditionName || data?.topic || null,
      difficulty: row.difficulty || data?.difficulty || null,
      conditionId: row.conditionId || data?.conditionId || null,
      medicalContentId: row.medicalContentId || data?.medicalContentId || null,
      canonicalQuestionId: null,
      sourceQuestionId: row.id,
      questionSource: 'pre_generated',
      pearls: Array.isArray(data?.pearls) ? data.pearls : [],
      source: 'new_card',
    };

    if (isUsableQuestion(question)) {
      questions.push(question);
    }
  }

  return questions;
}

function normalizeDifficulty(value: unknown): string {
  if (typeof value === 'number') {
    if (value < 0.4) return 'easy';
    if (value > 0.7) return 'hard';
    return 'medium';
  }
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
}

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
    where: withProductionPregeneratedSafety({ id: { in: questionIds } }),
    select: {
      id: true,
      questionData: true,
      system: true,
      difficulty: true,
      conditionId: true,
      medicalContentId: true,
    },
  });

  // Fetch from Question table (for any not found in PreGeneratedQuestion)
  const preGenIds = new Set(preGenerated.map((q: any) => q.id));
  const remainingIds = questionIds.filter((id: string) => !preGenIds.has(id));
  let standardQuestions: any[] = [];
  if (remainingIds.length > 0) {
    standardQuestions = await prisma.question.findMany({
      where: withProductionQuestionSafety({ id: { in: remainingIds } }),
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        system: true,
        difficulty: true,
        conditionId: true,
        medicalContentId: true,
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
    const opts = normalizeOptions(data?.options ?? data?.answers ?? data?.choices);
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
      medicalContentId: q.medicalContentId || data?.medicalContentId || null,
      canonicalQuestionId: null,
      sourceQuestionId: q.id,
      questionSource: 'pre_generated',
    });
  }
  for (const q of standardQuestions) {
    const opts = normalizeOptions(q.options);
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
      medicalContentId: q.medicalContentId || null,
      canonicalQuestionId: q.id,
      sourceQuestionId: q.id,
      questionSource: 'question',
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
