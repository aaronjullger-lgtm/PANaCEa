import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { validateRequest, DrillSubmitReviewSchema } from '../_shared/schemas';
import { calculateParTime } from '../../../lib/utils/questionComplexity';
import { updateReviewOutcome } from '../../../lib/services/srsService';
import { FSRS, Rating } from '../../../lib/fsrs';
import { updateUserProgressWithHistory } from '../../../lib/services/userProgressService';
import { CloudflareContext } from '../_shared/types';
import { 
  deriveImplicitRating, 
  serializeImplicitMetrics,
  type ImplicitBehaviorMetrics 
} from '../../../lib/implicit-metrics';
import { 
  buildCircadianContext, 
  applyCircadianModifier,
  serializeCircadianContext 
} from '../../../lib/circadian';
import { propagateRecallToSiblings } from '../../../lib/services/semanticSiblingService';
import { applyAttemptToUserStatistics, updateTimingAggregates } from '../../../lib/services/userStatisticsService';

/**
 * Question data structure from PreGeneratedQuestion.questionData field
 */
interface QuestionData {
  stem?: string;
  question?: string;
  vignette?: string;
  text?: string;
  correctAnswer?: string;
  answer?: string;
  correct_option?: string;
  correctChoice?: string;
  correctIndex?: number;
  options?: Array<{ value?: string; text?: string; label?: string } | string>;
  choices?: Array<{ value?: string; text?: string; label?: string } | string>;
  [key: string]: unknown;
}

function findSelectedOption(
  pool: Array<{ value?: string; text?: string; label?: string; conditionId?: string; condition_id?: string; conditionRef?: string; medicalContentId?: string; condition?: string; conditionName?: string; id?: string }> | string[] | undefined,
  selectedAnswer: string
) {
  if (!Array.isArray(pool)) return null;

  for (const option of pool) {
    if (typeof option === 'string') {
      if (option === selectedAnswer) {
        return { label: option };
      }
      continue;
    }

    const label = option.value ?? option.text ?? option.label ?? option.conditionName ?? option.condition ?? option.id;
    if (label === selectedAnswer) {
      return {
        label,
        conditionId: option.conditionId ?? option.condition_id ?? option.conditionRef ?? option.medicalContentId ?? option.id,
        conditionName: option.conditionName ?? option.condition ?? label,
      };
    }
  }

  return null;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context: CloudflareContext) => {
  const { request, env } = context;
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const clerkId = await verifyAuthToken(request, env);
    if (!clerkId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Validate request body with Zod schema
    const validation = await validateRequest(request, DrillSubmitReviewSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }

    const { 
      questionId, 
      selectedAnswer, 
      timeSpentMs,
      // Implicit behavior metrics (Phase 2)
      timeToFirstClick,
      answerSwitches,
      totalDwellTime,
      timezone,
      wakeTimeHHMM,
    } = validation.data;

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Look up user by clerkId to get internal database ID
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'User not found',
        message: 'Your user account has not been synced yet.',
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const userId = user.id;

    const question = await prisma.preGeneratedQuestion.findUnique({ where: { id: questionId } });

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const qData = (question.questionData as QuestionData) || {};

    let correctAnswer: string | null =
      qData.correctAnswer ?? qData.answer ?? qData.correct_option ?? qData.correctChoice ?? null;

    if (correctAnswer === null && typeof qData.correctIndex === 'number') {
      const pool = Array.isArray(qData.options) ? qData.options : qData.choices;
      if (Array.isArray(pool) && pool[qData.correctIndex]) {
        const candidate = pool[qData.correctIndex];
        if (typeof candidate === 'string') {
          correctAnswer = candidate;
        } else if (typeof candidate === 'object' && candidate !== null) {
          correctAnswer = candidate.value ?? candidate.text ?? candidate.label ?? null;
        }
      }
    }

    const isCorrect = correctAnswer !== null
      ? selectedAnswer === correctAnswer
      : (qData.options || qData.choices || []).some((opt: unknown) => {
          if (typeof opt === 'string') return opt === selectedAnswer;
          if (typeof opt === 'object' && opt !== null) {
            const optObj = opt as { value?: string; text?: string; label?: string };
            const val = optObj.value ?? optObj.text ?? optObj.label;
            return val === selectedAnswer;
          }
          return false;
        });

    const optionPool = (qData.options || qData.choices) as Array<{ value?: string; text?: string; label?: string; conditionId?: string; condition_id?: string; conditionRef?: string; medicalContentId?: string; condition?: string; conditionName?: string; id?: string }> | string[] | undefined;
    const selectedMeta = findSelectedOption(optionPool, selectedAnswer);

    const parTimeMs = calculateParTime({
      ...qData,
      stem: qData.stem || qData.question || qData.vignette || qData.text || '',
      choices: qData.choices || qData.options || [],
    });

    const numericTime = typeof timeSpentMs === 'number' ? timeSpentMs : Number(timeSpentMs) || 0;

    // Build circadian context for time-of-day optimization
    const circadianContext = buildCircadianContext(
      { typicalWakeTime: wakeTimeHHMM }, // UserCircadianPrefs
      timezone || undefined // Override timezone (defaults to browser timezone)
    );

    // Build implicit behavior metrics (Phase 2: Zero-Friction)
    const behaviorMetrics: ImplicitBehaviorMetrics = {
      timeToFirstClick: timeToFirstClick ?? numericTime,
      answerSwitches: answerSwitches ?? 0,
      totalDwellTime: totalDwellTime ?? numericTime,
      isCorrect,
      parTimeMs,
    };

    // Derive rating from implicit behavior instead of buttons
    const implicitResult = deriveImplicitRating(behaviorMetrics);
    const rating = implicitResult.rating;
    
    // Legacy quality mapping for backward compatibility
    const quality = rating === Rating.Again ? 1 
      : rating === Rating.Hard ? 2 
      : rating === Rating.Easy ? 5 
      : 4;

    // Feed into FSRS with dynamic baseline
    const srsResult = updateReviewOutcome(userId, questionId, {
      quality,
      timeToAnswer: numericTime,
      baselineTime: parTimeMs,
    });

    // Update aggregated user statistics for clinical profile
    try {
      await applyAttemptToUserStatistics(prisma as any, userId, {
        system: (question as any).system || (qData as any).system || undefined,
        isCorrect,
        timeSpentMs: numericTime,
        selectedCondition: selectedMeta?.conditionId ?? selectedMeta?.label ?? null,
        correctCondition: question.conditionId ?? null,
        timestamp: new Date(),
      });

      await updateTimingAggregates(prisma as any, userId, { refreshPeakHours: true });
    } catch (statsError) {
      console.warn('Failed to update user statistics after review', statsError);
    }

    // If question has conditionId, also update UserProgress with review history
    if (question.conditionId) {
      try {
        // Get or create FSRS card for this condition
        const fsrs = new FSRS();
        const existingProgress = await prisma.userProgress.findUnique({
          where: {
            userId_conditionId: {
              userId,
              conditionId: question.conditionId,
            },
          },
        });

        const fsrsCardData = (existingProgress?.fsrsCard as Record<string, unknown>) || {};
        const currentCard = {
          stability: typeof fsrsCardData.stability === 'number' ? fsrsCardData.stability : 0,
          difficulty: typeof fsrsCardData.difficulty === 'number' ? fsrsCardData.difficulty : 0,
          state: typeof fsrsCardData.state === 'number' ? fsrsCardData.state : 0,
          elapsed_days: typeof fsrsCardData.elapsed_days === 'number' ? fsrsCardData.elapsed_days : 0,
          scheduled_days: typeof fsrsCardData.scheduled_days === 'number' ? fsrsCardData.scheduled_days : 0,
          reps: typeof fsrsCardData.reps === 'number' ? fsrsCardData.reps : 0,
          lapses: typeof fsrsCardData.lapses === 'number' ? fsrsCardData.lapses : 0,
          last_review: typeof fsrsCardData.last_review === 'string' ? new Date(fsrsCardData.last_review) : new Date(),
        };

        const { card: rawCard } = fsrs.next(currentCard, new Date(), rating);

        // Apply circadian modifier to stability
        const modifiedStability = applyCircadianModifier(
          rawCard.stability,
          circadianContext
        );

        const updatedCard = {
          ...rawCard,
          stability: modifiedStability,
        };

        await updateUserProgressWithHistory(prisma, {
          userId,
          conditionId: question.conditionId,
          fsrsCard: updatedCard,
          rating,
          accuracy: isCorrect ? 1.0 : 0.0,
        });

        // Propagate recall to semantic siblings (Phase 2: KAR3L)
        try {
          const siblingBoosts = await propagateRecallToSiblings(
            question.conditionId,
            rating
          );
          // Store boost records for future application (logged for now)
          if (siblingBoosts.length > 0) {
            console.log(`KAR3L: Propagated ${rating === Rating.Again ? 'penalty' : 'boost'} to ${siblingBoosts.length} siblings of ${question.conditionId}`);
          }
        } catch (siblingError) {
          // Don't fail if sibling propagation fails
          console.warn('KAR3L propagation error:', siblingError);
        }
      } catch (progressError) {
        console.warn('Failed to update UserProgress:', progressError);
        // Don't fail the entire request if progress update fails
      }
    }

    // Record confusion pairs when the user answers incorrectly
    if (!isCorrect) {
      try {
        const correctWhere: Array<Record<string, unknown>> = [];
        if (question.medicalContentId) correctWhere.push({ id: question.medicalContentId });
        if (question.conditionId) correctWhere.push({ conditionId: question.conditionId });
        if (typeof qData.condition === 'string') {
          correctWhere.push({ condition: { equals: qData.condition, mode: 'insensitive' as const } });
        }

        const selectedWhere: Array<Record<string, unknown>> = [];
        if (selectedMeta?.conditionId) {
          selectedWhere.push({ id: selectedMeta.conditionId });
          selectedWhere.push({ conditionId: selectedMeta.conditionId });
        }
        if (selectedMeta?.conditionName) {
          selectedWhere.push({ condition: { equals: selectedMeta.conditionName, mode: 'insensitive' as const } });
        }

        const [correctContent, selectedContent] = await Promise.all([
          correctWhere.length
            ? prisma!.medicalContent.findFirst({
                where: { OR: correctWhere },
                select: { id: true, condition: true, conditionId: true },
              })
            : null,
          selectedWhere.length
            ? prisma!.medicalContent.findFirst({
                where: { OR: selectedWhere },
                select: { id: true, condition: true, conditionId: true },
              })
            : null,
        ]);

        if (correctContent && selectedContent && correctContent.id !== selectedContent.id) {
          await prisma!.confusionPair.upsert({
            where: {
              userId_correctConditionId_selectedConditionId: {
                userId,
                correctConditionId: correctContent.id,
                selectedConditionId: selectedContent.id,
              },
            },
            create: {
              userId,
              correctConditionId: correctContent.id,
              selectedConditionId: selectedContent.id,
              realCondition: correctContent.condition,
              mistakenFor: selectedContent.condition,
              realConditionId: correctContent.conditionId,
              mistakenForId: selectedContent.conditionId,
            },
            update: {
              count: { increment: 1 },
              realCondition: correctContent.condition,
              mistakenFor: selectedContent.condition,
              realConditionId: correctContent.conditionId,
              mistakenForId: selectedContent.conditionId,
            },
          });
        }
      } catch (confusionError) {
        console.warn('Failed to record confusion pair', confusionError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        isCorrect,
        quality,
        parTimeMs,
        timeSpentMs: numericTime,
        // Phase 2: Zero-Friction metrics
        implicitMetrics: {
          rating,
          confidence: implicitResult.confidence,
          latencyRatio: numericTime / parTimeMs,
          answerSwitches: answerSwitches ?? 0,
        },
        circadian: {
          phase: circadianContext.circadianPhase,
          stabilityModifier: circadianContext.stabilityModifier,
          localHour: circadianContext.localHour,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('submit-review error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit review', details: error?.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
};
