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
