/**
 * GET /api/questions/pool-status
 * Get the status of the pre-generated question pool
 * Shows availability by system and overall health
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const PoolStatusSchema = z.object({
  query: z.object({}),
});

const POOL_LOW_THRESHOLD = 20;
const SYSTEMS = [
  'CV',
  'PULM',
  'GI',
  'NEURO',
  'MSK',
  'DERM',
  'HEME',
  'ENDO',
  'HEENT',
  'RENAL',
  'REPRO',
  'PSYCH',
  'ID',
  'GU',
];

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(PoolStatusSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/questions/pool-status');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get user ID for personal stats
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    // Get counts by system (total in pool - multi-tenant: all questions are available)
    const systemCounts: Record<string, { total: number; userSeen: number; userFresh: number }> = {};

    for (const system of SYSTEMS) {
      const total = await prisma.preGeneratedQuestion.count({ where: { system } });

      // Get user-specific counts if authenticated
      let userSeen = 0;
      if (user) {
        const seenQuestions = await prisma.userQuestionSeen.findMany({
          where: { userId: user.id },
          select: { questionId: true },
        });
        type SeenItem = (typeof seenQuestions)[0];
        const seenIds = seenQuestions.map((h: SeenItem) => h.questionId);

        if (seenIds.length > 0) {
          userSeen = await prisma.preGeneratedQuestion.count({
            where: { system, id: { in: seenIds } },
          });
        }
      }

      systemCounts[system] = {
        total,
        userSeen,
        userFresh: total - userSeen,
      };
    }

    // Get overall pool count
    const totalInPool = await prisma.preGeneratedQuestion.count();

    // Get user's seen count across all systems
    let totalUserSeen = 0;
    if (user) {
      const allSeenHistory = await prisma.userQuestionSeen.findMany({
        where: { userId: user.id },
        select: { questionId: true },
      });
      type SeenHistoryItem = (typeof allSeenHistory)[0];
      const allSeenIds = allSeenHistory.map((h: SeenHistoryItem) => h.questionId);

      if (allSeenIds.length > 0) {
        totalUserSeen = await prisma.preGeneratedQuestion.count({
          where: { id: { in: allSeenIds } },
        });
      }
    }

    // Get main Question table count
    const mainQuestionCount = await prisma.question.count();

    // Identify systems that need more questions in the pool
    const lowSystems = SYSTEMS.filter((s) => (systemCounts[s]?.total ?? 0) < POOL_LOW_THRESHOLD);

    logger.info('Pool status fetched', { userId: auth.userId, totalInPool, lowSystems });

    return {
      data: {
        pool: {
          total: totalInPool,
          available: totalInPool,
        },
        user: user
          ? {
              seen: totalUserSeen,
              fresh: totalInPool - totalUserSeen,
              percentExplored:
                totalInPool > 0 ? Math.round((totalUserSeen / totalInPool) * 100) : 0,
            }
          : null,
        mainTable: { total: mainQuestionCount },
        bySystem: systemCounts,
        health: {
          threshold: POOL_LOW_THRESHOLD,
          lowSystems,
          overallHealthy: totalInPool >= POOL_LOW_THRESHOLD,
          needsGeneration: lowSystems.length > 0 || totalInPool < POOL_LOW_THRESHOLD,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching pool status', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch pool status');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
