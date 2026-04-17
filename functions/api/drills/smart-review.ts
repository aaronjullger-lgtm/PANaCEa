/**
 * GET /api/drills/smart-review
 * Fetch SRS items due for review with context
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SmartReviewSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(SmartReviewSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/drills/smart-review');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return {
        data: { error: 'User not found', message: 'Your user account has not been synced yet.' },
        status: 404,
      };
    }

    const userId = user.id;
    const now = new Date();

    const srsItems = await prisma.sRSItem.findMany({
      where: { userId, dueDate: { lte: now } },
      orderBy: [{ dueDate: 'asc' }, { difficulty: 'desc' }],
      take: 20,
    });

    type SRSItemResult = {
      id: string;
      questionId: string;
      dueDate: Date;
      interval: number;
      difficulty: number;
      fsrsStability: number | null;
      repetition: number;
    };

    // SRSItem has no Question relation, so we fetch questions separately and
    // merge them in. Frontend (SmartReviewMode) needs the full question payload
    // (stem, choices, correctAnswer, explanation) to render the review UI —
    // without this the mode would crash or show a blank card.
    const questionIds = srsItems.map((item: SRSItemResult) => item.questionId);
    const questions = questionIds.length
      ? await prisma.question.findMany({
          where: { id: { in: questionIds } },
          select: {
            id: true,
            question: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            system: true,
            difficulty: true,
          },
        })
      : [];

    type QuestionRow = {
      id: string;
      question: string;
      options: unknown;
      correctAnswer: string;
      explanation: string | null;
      system: string | null;
      difficulty: string | null;
    };
    const questionById = new Map<string, QuestionRow>(
      questions.map((q: QuestionRow) => [q.id, q])
    );

    const reviewItems = srsItems
      .map((item: SRSItemResult) => {
        const q = questionById.get(item.questionId);
        // Orphaned SRSItems (Question was deleted) shouldn't block the queue —
        // skip them. Filter runs after the map so counters stay accurate.
        if (!q) return null;

        const overdueDays = Math.floor(
          (now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // SmartReviewMode expects uppercase enum: OVERDUE | WEAK_SPOT | NEW | DUE
        let srsReason: 'OVERDUE' | 'WEAK_SPOT' | 'NEW' | 'DUE' = 'DUE';
        if (overdueDays > 7) srsReason = 'OVERDUE';
        else if (item.difficulty > 0.5) srsReason = 'WEAK_SPOT';
        else if (item.repetition < 2) srsReason = 'NEW';

        // options is stored as Json in Prisma. Normalize to array of
        // { text, value } | string so the frontend's ReviewItem.question.choices
        // type is satisfied without further transformation.
        let choices: Array<{ text: string; value: string } | string> = [];
        if (Array.isArray(q.options)) {
          choices = q.options as Array<{ text: string; value: string } | string>;
        }

        return {
          id: item.id,
          questionId: item.questionId,
          dueDate: item.dueDate,
          overdueDays,
          difficulty: item.difficulty,
          interval: item.interval,
          stability: item.fsrsStability,
          srsReason,
          question: {
            id: q.id,
            stem: q.question,
            choices,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? '',
            system: q.system ?? '',
            difficulty: q.difficulty ?? 'medium',
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    type ReviewItemOut = (typeof reviewItems)[number];
    const totalDue = reviewItems.length;
    const hardCount = reviewItems.filter(
      (i: ReviewItemOut) => i.srsReason === 'WEAK_SPOT'
    ).length;
    const overdueCount = reviewItems.filter(
      (i: ReviewItemOut) => i.srsReason === 'OVERDUE'
    ).length;
    const newCount = reviewItems.filter((i: ReviewItemOut) => i.srsReason === 'NEW').length;

    logger.info('Fetched smart review items', { userId: auth.userId, totalDue });

    // success: true lets the frontend distinguish a successful empty queue
    // ("you're all caught up — Brain Upgraded!") from a silent server failure.
    return {
      data: {
        success: true,
        items: reviewItems,
        stats: { totalDue, hardCount, overdueCount, newCount },
      },
    };
  } catch (error) {
    logger.error('smart-review error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch review items');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
