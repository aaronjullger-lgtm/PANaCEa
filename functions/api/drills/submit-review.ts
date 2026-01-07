import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { calculateParTime } from '../../../lib/utils/questionComplexity';
import { updateReviewOutcome } from '../../../lib/services/srsService';
import { FSRS, Rating } from '../../../lib/fsrs';
import { updateUserProgressWithHistory } from '../../../lib/services/userProgressService';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {

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
    const body = await request.json();
    const { questionId, selectedAnswer, timeSpentMs } = body || {};

    if (!questionId || typeof selectedAnswer === 'undefined') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: questionId, selectedAnswer' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

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

    const qData: any = (question as any).questionData || {};

    let correctAnswer: any =
      qData.correctAnswer ?? qData.answer ?? qData.correct_option ?? qData.correctChoice ?? null;

    if (correctAnswer === null && typeof qData.correctIndex === 'number') {
      const pool = Array.isArray(qData.options) ? qData.options : qData.choices;
      if (Array.isArray(pool) && pool[qData.correctIndex]) {
        const candidate = pool[qData.correctIndex];
        correctAnswer = candidate?.value ?? candidate?.text ?? candidate?.label ?? candidate;
      }
    }

    const isCorrect = correctAnswer !== null
      ? selectedAnswer === correctAnswer
      : Boolean((qData.options || qData.choices || []).some((opt: any) => {
          const val = opt?.value ?? opt?.text ?? opt?.label ?? opt;
          return val === selectedAnswer;
        }));

    const parTimeMs = calculateParTime({
      ...qData,
      stem: qData.stem || qData.question || qData.vignette || qData.text || '',
      choices: qData.choices || qData.options || [],
    });

    const numericTime = typeof timeSpentMs === 'number' ? timeSpentMs : Number(timeSpentMs) || 0;

    const quality = !isCorrect
      ? 1 // Again
      : numericTime < parTimeMs * 0.7
        ? 5 // Easy / Fast
        : numericTime < parTimeMs * 1.4
          ? 4 // Good / Normal
          : 2; // Hard / Slow

    // Map quality to FSRS rating
    const rating: Rating = quality <= 1 ? Rating.Again : quality === 2 ? Rating.Hard : quality >= 5 ? Rating.Easy : Rating.Good;

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

        const fsrsCardData: any = existingProgress?.fsrsCard || {};
        const currentCard = {
          stability: fsrsCardData.stability || 0,
          difficulty: fsrsCardData.difficulty || 0,
          state: fsrsCardData.state || 0,
          elapsed_days: fsrsCardData.elapsed_days || 0,
          scheduled_days: fsrsCardData.scheduled_days || 0,
          reps: fsrsCardData.reps || 0,
          lapses: fsrsCardData.lapses || 0,
          last_review: fsrsCardData.last_review ? new Date(fsrsCardData.last_review) : new Date(),
        };

        const { card: updatedCard } = fsrs.next(currentCard, new Date(), rating);

        await updateUserProgressWithHistory(prisma, {
          userId,
          conditionId: question.conditionId,
          fsrsCard: updatedCard,
          rating,
          accuracy: isCorrect ? 1.0 : 0.0,
        });
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
