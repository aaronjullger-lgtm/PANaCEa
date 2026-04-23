/**
 * GET /api/questions/pool-status
 * Get the status of the pre-generated question pool
 * Shows availability by system and overall health
 */

import { z } from 'zod';
import { getSystemWeight } from '../../../lib/constants/blueprint';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';

const PoolStatusSchema = z.object({
  query: z.object({}),
});

const POOL_LOW_THRESHOLD = 20; // fallback global threshold
const BASE_THRESHOLD_MULTIPLIER = 200;

function getSystemThreshold(system: string): number {
  const weight = getSystemWeight(system);
  const threshold = Math.round(weight * BASE_THRESHOLD_MULTIPLIER);
  return Math.max(10, threshold);
}

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

export const onRequestGet = authenticatedEndpoint(PoolStatusSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/questions/pool-status');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const MAX_SEEN_LOOKUP = 5_000;

  try {
    const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });

    const [groupedCounts, totalInPool, mainQuestionCount, seenQuestions] = await Promise.all([
      prisma.preGeneratedQuestion.groupBy({
        by: ['system'],
        where: { system: { in: SYSTEMS } },
        _count: { id: true },
      }),
      prisma.preGeneratedQuestion.count(),
      prisma.question.count(),
      prisma.userQuestionSeen.findMany({
        where: { userId: user.id },
        select: { questionId: true },
        orderBy: { lastSeenAt: 'desc' },
        take: MAX_SEEN_LOOKUP,
      }),
    ]);

    const systemCounts: Record<string, { total: number; userSeen: number; userFresh: number }> = {};
    const systemThresholds: Record<string, number> = {};

    for (const system of SYSTEMS) {
      const group = groupedCounts.find((entry) => entry.system === system);
      systemCounts[system] = {
        total: group?._count.id ?? 0,
        userSeen: 0,
        userFresh: group?._count.id ?? 0,
      };
      systemThresholds[system] = getSystemThreshold(system);
    }

    const seenIds = seenQuestions.map((entry) => entry.questionId);
    let totalUserSeen = 0;
    if (seenIds.length > 0) {
      const seenPoolQuestions = await prisma.preGeneratedQuestion.findMany({
        where: {
          id: { in: seenIds },
          system: { in: SYSTEMS },
        },
        select: { id: true, system: true },
      });

      totalUserSeen = seenPoolQuestions.length;
      for (const seen of seenPoolQuestions) {
        const system = seen.system ?? 'UNKNOWN';
        if (!systemCounts[system]) continue;
        systemCounts[system].userSeen += 1;
      }
      for (const system of SYSTEMS) {
        const counts = systemCounts[system]!;
        counts.userFresh = Math.max(0, counts.total - counts.userSeen);
      }
    }

    // Identify systems that need more questions in the pool (per‑system thresholds)
    const lowSystems = SYSTEMS.filter((s) => (systemCounts[s]?.total ?? 0) < systemThresholds[s]!);

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
          systemThresholds,
          lowSystems,
          overallHealthy: lowSystems.length === 0,
          needsGeneration: lowSystems.length > 0,
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
