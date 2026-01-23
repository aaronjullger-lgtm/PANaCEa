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

    type SRSItemResult = { id: string; questionId: string; dueDate: Date; difficulty: number; fsrsStability: number | null; repetition: number };
    const reviewItems = srsItems.map((item: SRSItemResult) => {
      const overdueDays = Math.floor(
        (now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      let reason = 'due';
      if (overdueDays > 7) reason = 'overdue';
      else if (item.difficulty > 0.5) reason = 'hard';
      else if (item.repetition < 2) reason = 'new';

      return {
        id: item.id,
        questionId: item.questionId,
        dueDate: item.dueDate,
        overdueDays,
        difficulty: item.difficulty,
        stability: item.fsrsStability,
        reason,
      };
    });

    type ReviewItem = { id: string; questionId: string; dueDate: Date; overdueDays: number; difficulty: number; stability: number | null; reason: string };
    const totalDue = reviewItems.length;
    const hardCount = reviewItems.filter((i: ReviewItem) => i.reason === 'hard').length;
    const overdueCount = reviewItems.filter((i: ReviewItem) => i.reason === 'overdue').length;
    const newCount = reviewItems.filter((i: ReviewItem) => i.reason === 'new').length;

    logger.info('Fetched smart review items', { userId: auth.userId, totalDue });

    return {
      data: {
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
