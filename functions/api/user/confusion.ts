import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ConfusionGetSchema = z.object({
  query: z.object({
    limit: z.string().regex(/^\d+$/).optional().default('10'),
  }),
});

const ConfusionPostSchema = z.object({
  body: z.object({
    correctConditionId: z.string().min(1),
    selectedConditionId: z.string().min(1),
  }),
});

/**
 * GET /api/user/confusion
 * Fetch user's top confusion pairs
 */
export const onRequestGet = authenticatedEndpoint(ConfusionGetSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/confusion [GET]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const limit = parseInt(validated.query.limit, 10);

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Fetch top confusion pairs ordered by count
    const confusionPairs = await prisma.confusionPair.findMany({
      where: { userId: user.id },
      include: {
        CorrectCondition: {
          select: { id: true, condition: true, system: true },
        },
        SelectedCondition: {
          select: { id: true, condition: true, system: true },
        },
      },
      orderBy: { count: 'desc' },
      take: limit,
    });

    const pairs = confusionPairs.map((pair) => ({
      id: pair.id,
      correctConditionId: pair.correctConditionId,
      selectedConditionId: pair.selectedConditionId,
      correctCondition: pair.CorrectCondition?.condition || pair.realCondition,
      selectedCondition: pair.SelectedCondition?.condition || pair.mistakenFor,
      count: pair.count,
      lastOccurred: pair.lastOccurrence.toISOString(),
      severity:
        pair.count >= 10
          ? 'critical'
          : pair.count >= 5
            ? 'high'
            : pair.count >= 3
              ? 'medium'
              : 'low',
    }));

    logger.info(`Fetched ${pairs.length} confusion pairs for user ${user.id}`);

    return { data: { pairs, total: pairs.length } };
  } catch (error) {
    logger.error('Failed to fetch confusion pairs', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to fetch confusion pairs' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * POST /api/user/confusion
 * Manually track a confusion pair (or increment existing)
 */
export const onRequestPost = authenticatedEndpoint(ConfusionPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/confusion [POST]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { correctConditionId, selectedConditionId } = validated.body;

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Validate that both conditions exist
    const [correctContent, selectedContent] = await Promise.all([
      prisma.medicalContent.findUnique({
        where: { id: correctConditionId },
        select: { id: true, condition: true, conditionId: true },
      }),
      prisma.medicalContent.findUnique({
        where: { id: selectedConditionId },
        select: { id: true, condition: true, conditionId: true },
      }),
    ]);

    if (!correctContent || !selectedContent) {
      return { status: 404, error: 'One or both conditions not found' };
    }

    if (correctContent.id === selectedContent.id) {
      return { status: 400, error: 'Cannot create confusion pair for the same condition' };
    }

    // Upsert confusion pair
    const confusionPair = await prisma.confusionPair.upsert({
      where: {
        userId_correctConditionId_selectedConditionId: {
          userId: user.id,
          correctConditionId: correctContent.id,
          selectedConditionId: selectedContent.id,
        },
      },
      create: {
        userId: user.id,
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
      },
    });

    logger.info('Confusion pair tracked', {
      userId: user.id,
      pairId: confusionPair.id,
      count: confusionPair.count,
    });

    return {
      data: {
        success: true,
        confusionPair: {
          id: confusionPair.id,
          count: confusionPair.count,
          shouldGenerateComparison: confusionPair.count >= 3,
        },
      },
    };
  } catch (error) {
    logger.error('Failed to track confusion pair', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to track confusion pair' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
