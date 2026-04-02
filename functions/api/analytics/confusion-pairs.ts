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

    // Find attempts where user selected a different condition than the correct one
    const confusionAttempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        wasCorrect: false,
        conditionId: { not: null },
        selectedConditionId: { not: null },
      },
      select: {
        conditionId: true,
        selectedConditionId: true,
        system: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    // Aggregate confusion pairs
    const pairCounts = new Map<string, { correct: string; selected: string; system: string | null; count: number; lastSeen: Date }>();

    for (const a of confusionAttempts) {
      if (!a.conditionId || !a.selectedConditionId) continue;
      const key = `${a.conditionId}|${a.selectedConditionId}`;
      const existing = pairCounts.get(key);
      if (existing) {
        existing.count += 1;
        if (a.createdAt > existing.lastSeen) existing.lastSeen = a.createdAt;
      } else {
        pairCounts.set(key, {
          correct: a.conditionId,
          selected: a.selectedConditionId,
          system: a.system,
          count: 1,
          lastSeen: a.createdAt,
        });
      }
    }

    const pairs = Array.from(pairCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((p, i) => ({
        id: `cp-${i}`,
        correctConditionId: p.correct,
        selectedConditionId: p.selected,
        system: p.system,
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
