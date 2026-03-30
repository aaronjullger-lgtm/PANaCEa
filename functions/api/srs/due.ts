/**
 * SRS Due Items API
 * GET /api/srs/due
 *
 * Fetch all SRS items due for review for the authenticated user
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SRSDueSchema = z.object({
  query: z
    .object({
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? Math.min(Number(val), 200) : 100)),
    })
    .optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(SRSDueSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/srs/due');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Look up user by clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      logger.warn('User not found in database', { clerkId: auth.userId.substring(0, 10) });
      return {
        data: { error: 'User not found. Please refresh and try again.' },
        status: 404,
      };
    }

    const userId = user.id;
    const now = new Date();
    const limit = validated.query?.limit || 100;

    // Fetch all SRS items due for review
    const dueItems = await prisma.sRSItem.findMany({
      where: {
        userId,
        dueDate: {
          lte: now,
        },
      },
      orderBy: [
        { dueDate: 'asc' }, // Most overdue first
        { difficulty: 'desc' }, // Harder questions prioritized
      ],
      take: limit,
      select: {
        id: true,
        questionId: true,
        interval: true,
        dueDate: true,
        difficulty: true,
        easiness: true,
        repetition: true,
        fsrsStability: true,
        fsrsDifficulty: true,
        fsrsState: true,
      },
    });

    // Calculate overdue days for each item
    type DueItem = (typeof dueItems)[0];
    const enrichedItems = dueItems
      .filter((item: DueItem) => item.dueDate != null)
      .map((item: DueItem) => {
        const overdueDays = Math.floor(
          (now.getTime() - item.dueDate!.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          ...item,
          overdueDays: Math.max(0, overdueDays),
          priority: overdueDays * (item.difficulty ?? 0.3), // Default difficulty if null
        };
      });

    logger.info('SRS due items retrieved', {
      userId: userId.substring(0, 10),
      totalDue: enrichedItems.length,
      limit,
    });

    return {
      data: {
        items: enrichedItems,
        totalDue: enrichedItems.length,
        timestamp: now.toISOString(),
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
});
