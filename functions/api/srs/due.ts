/**
 * SRS Due Items API
 * GET /api/srs/due
 *
 * Fetch canonical FSRS due items for the authenticated user.
 *
 * Legacy SRSItem is deprecated. This compatibility endpoint keeps the old route
 * alive for clients that need a due queue/count, but reads from the
 * authoritative Card, UserTopicProgress, and UserProgress stores.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserId } from '../_shared/user-resolver';

function parseLimit(value?: string): number {
  const parsed = value ? Number.parseInt(value, 10) : 100;
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(parsed, 200));
}

const ProgressContextSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.toUpperCase() : value),
  z.enum(['READINESS', 'TARGETED']).optional()
);

const SRSDueSchema = z.object({
  limit: z.string().optional().transform(parseLimit),
  progressContext: ProgressContextSchema,
  context: ProgressContextSchema,
}).transform(({ limit, progressContext, context }) => ({
  limit,
  progressContext: progressContext ?? context,
}));

type DueItem = {
  id: string;
  source: 'card' | 'user_topic_progress' | 'user_progress';
  questionId: string | null;
  conditionId: string | null;
  taskType: string | null;
  progressContext: string | null;
  dueDate: string;
  overdueDays: number;
  priority: number;
  [key: string]: unknown;
};

function conditionKey(item: Pick<DueItem, 'conditionId' | 'progressContext'>): string | null {
  if (!item.conditionId) return null;
  return `${item.progressContext ?? 'UNKNOWN'}:${item.conditionId}`;
}

function taskKey(item: Pick<DueItem, 'conditionId' | 'progressContext' | 'taskType'>): string | null {
  const base = conditionKey(item);
  if (!base) return null;
  return `${base}:${item.taskType ?? 'general'}`;
}

function suppressDuplicateDueRows(params: {
  cardItems: DueItem[];
  topicItems: DueItem[];
  conditionItems: DueItem[];
}): { items: DueItem[]; suppressedDuplicates: number } {
  const { cardItems, topicItems, conditionItems } = params;

  const cardTaskKeys = new Set(cardItems.map(taskKey).filter((key): key is string => Boolean(key)));
  const keptTopicItems = topicItems.filter((item) => {
    const key = taskKey(item);
    return !key || !cardTaskKeys.has(key);
  });

  const specificConditionKeys = new Set(
    [...cardItems, ...keptTopicItems]
      .map(conditionKey)
      .filter((key): key is string => Boolean(key))
  );
  const keptConditionItems = conditionItems.filter((item) => {
    const key = conditionKey(item);
    return !key || !specificConditionKeys.has(key);
  });

  const items = [...cardItems, ...keptTopicItems, ...keptConditionItems];
  return {
    items,
    suppressedDuplicates: cardItems.length + topicItems.length + conditionItems.length - items.length,
  };
}

export const onRequestGet = authenticatedEndpoint(SRSDueSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/srs/due');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const userId = await resolveOrCreateUserId(prisma, auth.userId);
    const now = new Date();
    const { limit, progressContext } = validated;
    const progressContextFilter = progressContext ? { progressContext } : {};

    const [cardProgress, topicProgress, conditionProgress] = await Promise.all([
      prisma.card.findMany({
        where: {
          userId,
          due: { lte: now },
          ...progressContextFilter,
        },
        orderBy: [{ due: 'asc' }, { difficulty: 'desc' }],
        take: limit,
        select: {
          id: true,
          questionId: true,
          progressContext: true,
          due: true,
          stability: true,
          difficulty: true,
          state: true,
          Question: {
            select: {
              conditionId: true,
              medicalContentId: true,
              system: true,
              taskType: true,
              lifecycleStatus: true,
              qaStatus: true,
            },
          },
        },
      }),
      prisma.userTopicProgress.findMany({
        where: {
          userId,
          nextReviewDate: { lte: now },
          ...progressContextFilter,
        },
        orderBy: [{ nextReviewDate: 'asc' }, { difficulty: 'desc' }],
        take: limit,
        select: {
          id: true,
          conditionId: true,
          taskType: true,
          progressContext: true,
          stability: true,
          difficulty: true,
          state: true,
          nextReviewDate: true,
        },
      }),
      prisma.userProgress.findMany({
        where: {
          userId,
          nextReviewAt: { lte: now },
          ...progressContextFilter,
        },
        orderBy: [{ nextReviewAt: 'asc' }, { fsrsDifficulty: 'desc' }],
        take: limit,
        select: {
          id: true,
          conditionId: true,
          progressContext: true,
          fsrsStability: true,
          fsrsDifficulty: true,
          fsrsState: true,
          nextReviewAt: true,
        },
      }),
    ]);

    const difficultyWeight = (difficulty: number | null | undefined): number => {
      if (difficulty == null || Number.isNaN(difficulty)) return 0.3;
      return Math.max(0.1, Math.min(1, difficulty > 1 ? difficulty / 10 : difficulty));
    };

    const overdueDaysFor = (dueDate: Date): number =>
      Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    const cardItems: DueItem[] = cardProgress
      .filter((item) =>
        item.due != null &&
        item.Question?.lifecycleStatus === 'ACTIVE' &&
        item.Question?.qaStatus === 'APPROVED'
      )
      .map((item) => {
        const dueDate = item.due;
        const overdueDays = overdueDaysFor(dueDate);
        return {
          id: item.id,
          source: 'card' as const,
          questionId: item.questionId,
          conditionId: item.Question?.medicalContentId ?? item.Question?.conditionId ?? null,
          taskType: item.Question?.taskType ?? null,
          progressContext: item.progressContext,
          dueDate: dueDate.toISOString(),
          stability: item.stability,
          difficulty: item.difficulty,
          state: item.state,
          system: item.Question?.system ?? null,
          overdueDays,
          priority: overdueDays * difficultyWeight(item.difficulty),
        };
      });

    const topicItems: DueItem[] = topicProgress
      .filter((item) => item.nextReviewDate != null)
      .map((item) => {
        const dueDate = item.nextReviewDate!;
        const overdueDays = overdueDaysFor(dueDate);
        return {
          id: item.id,
          source: 'user_topic_progress' as const,
          questionId: null,
          conditionId: item.conditionId,
          taskType: item.taskType,
          progressContext: item.progressContext,
          dueDate: dueDate.toISOString(),
          stability: item.stability,
          difficulty: item.difficulty,
          state: item.state,
          overdueDays,
          priority: overdueDays * difficultyWeight(item.difficulty),
        };
      });

    const conditionItems: DueItem[] = conditionProgress
      .filter((item) => item.nextReviewAt != null)
      .map((item) => {
        const dueDate = item.nextReviewAt!;
        const overdueDays = overdueDaysFor(dueDate);
        return {
          id: item.id,
          source: 'user_progress' as const,
          questionId: null,
          conditionId: item.conditionId,
          taskType: null,
          progressContext: item.progressContext,
          dueDate: dueDate.toISOString(),
          fsrsStability: item.fsrsStability,
          fsrsDifficulty: item.fsrsDifficulty,
          fsrsState: item.fsrsState,
          overdueDays,
          priority: overdueDays * difficultyWeight(item.fsrsDifficulty),
        };
      });

    const deduped = suppressDuplicateDueRows({ cardItems, topicItems, conditionItems });
    const enrichedItems = deduped.items
      .sort((a, b) => {
        const dueDelta = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return dueDelta !== 0 ? dueDelta : b.priority - a.priority;
      })
      .slice(0, limit);

    logger.info('SRS due items retrieved', {
      userId: userId.substring(0, 10),
      totalDue: enrichedItems.length,
      dueCards: cardItems.length,
      suppressedDuplicates: deduped.suppressedDuplicates,
      progressContext: progressContext ?? 'ALL',
      limit,
    });

    return {
      data: {
        items: enrichedItems,
        totalDue: enrichedItems.length,
        timestamp: now.toISOString(),
        source: 'canonical_fsrs_progress',
        progressContext: progressContext ?? null,
        suppressedDuplicates: deduped.suppressedDuplicates,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('SRS due items error', {
      error: message,
      userId: auth.userId.substring(0, 10),
    });
    // Return empty result instead of 500 for resilience
    return {
      data: {
        items: [],
        totalDue: 0,
        timestamp: new Date().toISOString(),
        error: 'Unable to load due items. Please try again.',
      },
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
}, { source: 'query' });
