/**
 * User Confusion Tracking API
 *
 * POST /api/user/confusion    - Upsert a confusion pair when a user answers incorrectly
 * GET  /api/user/confusion    - Fetch a user's top confusion pairs
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ConfusionPostSchema = z.object({
  body: z.object({
    correctConditionId: z.string().min(1),
    selectedConditionId: z.string().min(1),
  }).refine((data) => data.correctConditionId !== data.selectedConditionId, {
    message: 'correctConditionId and selectedConditionId must differ',
  }),
});

const ConfusionGetSchema = z.object({
  query: z.object({
    limit: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

/**
 * Upsert a confusion pair for the authenticated user
 */
export const onRequestPost = authenticatedEndpoint(ConfusionPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/confusion');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const { correctConditionId, selectedConditionId } = validated.body;

    // Fetch condition metadata for compatibility fields
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
      return {
        data: { error: 'One or more condition IDs are invalid' },
        status: 404,
      };
    }

    const pair = await prisma.confusionPair.upsert({
      where: {
        userId_correctConditionId_selectedConditionId: {
          userId: auth.userId,
          correctConditionId,
          selectedConditionId,
        },
      },
      create: {
        userId: auth.userId,
        correctConditionId,
        selectedConditionId,
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
      include: {
        CorrectCondition: { select: { id: true, condition: true, system: true } },
        SelectedCondition: { select: { id: true, condition: true, system: true } },
      },
    });

    logger.info('Tracked confusion pair', {
      userId: auth.userId,
      correctConditionId,
      selectedConditionId,
      count: pair.count,
    });

    return { data: { success: true, pair } };
  } catch (error) {
    logger.error('Error tracking confusion', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to track confusion');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * Fetch top confusion pairs for the authenticated user
 */
export const onRequestGet = authenticatedEndpoint(ConfusionGetSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/confusion');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const limit = Math.min(parseInt(validated.query?.limit || '10', 10), 25);

    const pairs = await prisma.confusionPair.findMany({
      where: { userId: auth.userId },
      include: {
        CorrectCondition: { select: { id: true, condition: true, system: true } },
        SelectedCondition: { select: { id: true, condition: true, system: true } },
      },
      orderBy: [{ count: 'desc' }, { lastOccurrence: 'desc' }],
      take: limit,
    });

    const payload = pairs.map((pair) => ({
      id: pair.id,
      count: pair.count,
      correctConditionId: pair.correctConditionId ?? pair.CorrectCondition?.id ?? null,
      selectedConditionId: pair.selectedConditionId ?? pair.SelectedCondition?.id ?? null,
      correctCondition: pair.CorrectCondition?.condition ?? pair.realCondition,
      selectedCondition: pair.SelectedCondition?.condition ?? pair.mistakenFor,
      correctSystem: pair.CorrectCondition?.system ?? null,
      selectedSystem: pair.SelectedCondition?.system ?? null,
      lastOccurred: pair.lastOccurrence,
    }));

    logger.info('Fetched confusion pairs', {
      userId: auth.userId,
      count: payload.length,
    });

    return {
      data: {
        success: true,
        pairs: payload,
        total: payload.length,
      },
    };
  } catch (error) {
    logger.error('Error fetching confusion pairs', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch confusion pairs');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
