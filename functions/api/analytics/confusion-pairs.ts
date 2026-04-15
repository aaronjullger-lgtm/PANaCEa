/**
 * API Endpoint: GET /api/analytics/confusion-pairs
 *
 * Returns confusion pair data — conditions that users frequently confuse.
 * Derived from QuestionAttempt records where selectedCondition ≠ correctCondition.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';

const ConfusionPairsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  }).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ConfusionPairsSchema, async (context) => {
  const { env, auth, validated } = context;
  const limit = validated.query?.limit ?? 50;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return { data: { success: false, error: 'User not found' }, status: 404 };
    }

    // Read the canonical confusion-pair table rather than reconstructing pairs from attempts.
    const confusionAttempts = await prisma.confusionPair.findMany({
      where: {
        userId,
      },
      select: {
        correctConditionId: true,
        selectedConditionId: true,
        realCondition: true,
        mistakenFor: true,
        count: true,
        lastOccurrence: true,
      },
      take: 2000,
    });

    // Aggregate confusion pairs
    const pairCounts = new Map<
      string,
      {
        correctConditionId: string | null;
        selectedConditionId: string | null;
        realCondition: string;
        mistakenFor: string;
        count: number;
        lastSeen: Date;
      }
    >();

    for (const a of confusionAttempts) {
      const key = `${a.correctConditionId ?? a.realCondition}|${a.selectedConditionId ?? a.mistakenFor}`;
      const existing = pairCounts.get(key);
      if (existing) {
        existing.count += a.count ?? 1;
        if (a.lastOccurrence > existing.lastSeen) existing.lastSeen = a.lastOccurrence;
      } else {
        pairCounts.set(key, {
          correctConditionId: a.correctConditionId,
          selectedConditionId: a.selectedConditionId,
          realCondition: a.realCondition,
          mistakenFor: a.mistakenFor,
          count: a.count ?? 1,
          lastSeen: a.lastOccurrence,
        });
      }
    }

    const pairs = Array.from(pairCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((p, i) => ({
        id: `cp-${i}`,
        correctConditionId: p.correctConditionId ?? null,
        selectedConditionId: p.selectedConditionId ?? null,
        realCondition: p.realCondition,
        mistakenFor: p.mistakenFor,
        frequency: p.count,
        lastSeen: p.lastSeen.toISOString(),
      }));

    return {
      data: { success: true, confusionPairs: pairs, total: pairs.length },
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
