/**
 * POST /api/cron/calibrate-items
 *
 * Batch psychometric calibration cron job.
 * Reads QuestionAttempt data, computes Elo difficulty + CTT metrics per question,
 * flags poor-quality items, and stores calibration results in KV cache.
 *
 * Designed to run daily via Cloudflare Cron Triggers or manual invocation.
 *
 * @see lib/services/itemCalibrationService.ts
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import type { CloudflareEnv } from '../_shared/types';
import {
  batchCalibrateItems,
  summarizeCalibration,
  MIN_OBSERVATIONS,
  type AttemptRecord,
  type ItemCalibration,
} from '../../../lib/services/itemCalibrationService';

const BodySchema = z
  .object({
    /** Only calibrate items with attempts since this date */
    since: z.string().datetime().optional(),
    /** Override minimum observation threshold */
    minResponses: z.number().int().min(5).max(500).optional(),
  })
  .optional()
  .default({});

type Env = CloudflareEnv & { CACHE?: KVNamespace };

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
  const { env, validated } = context as {
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const minResponses = validated?.minResponses ?? MIN_OBSERVATIONS;

  try {
    // 1. Determine time window
    const sinceDate = validated?.since
      ? new Date(validated.since)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // default: last 90 days

    // 2. Query attempts with user accuracy for ability ranking
    // First, compute per-user accuracy
    const userStats = await prisma.$queryRaw<
      Array<{ userId: string; accuracy: number }>
    >`
      SELECT "userId", 
             CASE WHEN COUNT(*) > 0 
                  THEN COUNT(*) FILTER (WHERE "wasCorrect" = true)::float / COUNT(*)::float 
                  ELSE 0.5 
             END as accuracy
      FROM "QuestionAttempt"
      WHERE "createdAt" >= ${sinceDate}
        AND "isMainSession" = true
      GROUP BY "userId"
      HAVING COUNT(*) >= 10
    `;
    const userAccuracyMap = new Map(userStats.map((u) => [u.userId, u.accuracy]));

    if (userAccuracyMap.size === 0) {
      return {
        data: {
          message: 'No eligible users found (need >=10 attempts each)',
          calibrated: 0,
          summary: null,
        },
      };
    }

    // 3. Query question attempts
    const rawAttempts = await prisma.questionAttempt.findMany({
      where: {
        createdAt: { gte: sinceDate },
        isMainSession: true,
        userId: { in: Array.from(userAccuracyMap.keys()) },
      },
      select: {
        questionId: true,
        userId: true,
        wasCorrect: true,
        selectedAnswer: true,
        timeSpentMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (rawAttempts.length === 0) {
      return {
        data: { message: 'No attempts found in time window', calibrated: 0, summary: null },
      };
    }

    // 4. Group by question and build AttemptRecord arrays
    const attemptsByQuestion = new Map<string, AttemptRecord[]>();
    for (const raw of rawAttempts) {
      if (!raw.questionId) continue;
      const record: AttemptRecord = {
        questionId: raw.questionId,
        userId: raw.userId,
        wasCorrect: raw.wasCorrect,
        selectedAnswer: raw.selectedAnswer ?? '',
        timeSpentMs: raw.timeSpentMs ?? 0,
        userAccuracy: userAccuracyMap.get(raw.userId) ?? 0.5,
        createdAt: raw.createdAt,
      };

      const list = attemptsByQuestion.get(raw.questionId) ?? [];
      list.push(record);
      attemptsByQuestion.set(raw.questionId, list);
    }

    // 5. Run batch calibration
    const calibrations = batchCalibrateItems(attemptsByQuestion, undefined, minResponses);
    const summary = summarizeCalibration(calibrations);

    // 6. Store results in KV cache
    const kvNamespace = env.CACHE;
    if (kvNamespace) {
      const storePromises: Promise<void>[] = [];
      for (const [questionId, cal] of calibrations) {
        storePromises.push(
          kvNamespace.put(
            `item-cal:${questionId}`,
            JSON.stringify(cal),
            { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
          )
        );
      }
      // Store summary too
      storePromises.push(
        kvNamespace.put(
          'item-cal:_summary',
          JSON.stringify({ ...summary, calibratedAt: new Date().toISOString() }),
          { expirationTtl: 7 * 24 * 60 * 60 }
        )
      );
      await Promise.all(storePromises);
    }

    // 7. Log flagged items for monitoring
    const flaggedItems: Array<{ questionId: string; flag: string; issues: string[] }> = [];
    for (const [questionId, cal] of calibrations) {
      if (cal.qualityFlag === 'poor' || cal.qualityFlag === 'remove') {
        flaggedItems.push({
          questionId,
          flag: cal.qualityFlag,
          issues: cal.qualityIssues,
        });
      }
    }

    return {
      data: {
        calibrated: calibrations.size,
        skipped: attemptsByQuestion.size - calibrations.size,
        totalAttempts: rawAttempts.length,
        uniqueQuestions: attemptsByQuestion.size,
        uniqueUsers: userAccuracyMap.size,
        summary,
        flaggedItems: flaggedItems.slice(0, 50),
        calibratedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[calibrate-items]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Calibration failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
