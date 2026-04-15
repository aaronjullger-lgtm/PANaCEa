/**
 * GET /api/analytics/readiness-projection?examDate=2026-07-15
 *
 * Returns comprehensive exam readiness projection with calibrated
 * confidence intervals and forward decay estimates.
 *
 * Uses FSRS card-level states aggregated via Beta-Binomial posteriors
 * and harmonic mean stability to produce per-system and overall
 * readiness with projected PANCE score ranges.
 *
 * @see lib/services/readinessProjectionService.ts
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';
import {
  computeExamReadiness,
  type CardState,
} from '../../../lib/services/readinessProjectionService';

const QuerySchema = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(QuerySchema, async (context) => {
  const { env, validated, auth } = context as {
    env: CloudflareEnv;
    validated: z.infer<typeof QuerySchema>;
    auth: { userId: string };
  };

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, ['DATABASE_URL']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // 1. Parse exam date
    let daysUntilExam: number | null = null;
    if (validated.examDate) {
      const examDate = new Date(validated.examDate);
      const now = new Date();
      daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    }

    // 2. Fetch UserProgress records (READINESS context)
    const progressRecords = await prisma.userProgress.findMany({
      where: {
        userId: auth.userId,
        progressContext: 'READINESS',
      },
      select: {
        conditionId: true,
        fsrsStability: true,
        fsrsDifficulty: true,
        fsrsState: true,
        totalAttempts: true,
        correctCount: true,
        lastReviewAt: true,
        system: true,
      },
    });

    if (progressRecords.length === 0) {
      return {
        data: {
          message: 'No study data found. Start studying to see readiness projections.',
          overallReadiness: 0,
          projectedAtExam: 0,
          systems: [],
          riskLevel: 'critical',
        },
        headers: { 'Cache-Control': 'private, max-age=300' },
      };
    }

    // 3. Build CardState array
    const now = new Date();
    const cards: CardState[] = progressRecords
      .filter((p) => p.fsrsStability != null && p.fsrsStability > 0)
      .map((p) => {
        const elapsedDays = p.lastReviewAt
          ? (now.getTime() - p.lastReviewAt.getTime()) / (24 * 60 * 60 * 1000)
          : 30;
        const stability = p.fsrsStability ?? 1;

        // Compute current R from FSRS v6 curve
        const factor = 19 / 81;
        const decay = -0.5;
        const retrievability = Math.pow(1 + factor * elapsedDays / stability, decay);

        return {
          conditionId: p.conditionId,
          system: p.system ?? 'unknown',
          stability,
          difficulty: p.fsrsDifficulty ?? 5,
          retrievability: Math.max(0, Math.min(1, retrievability)),
          lastReviewAt: p.lastReviewAt ?? now,
          totalAttempts: p.totalAttempts,
          correctCount: p.correctCount,
        };
      });

    // 4. Compute projection
    const projection = computeExamReadiness(cards, daysUntilExam);

    return {
      data: projection,
      headers: { 'Cache-Control': 'private, max-age=300' },
    };
  } catch (error) {
    console.error('[readiness-projection]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Readiness projection failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
