/**
 * GET /api/study/daily-load
 *
 * Returns personalized daily study load recommendation based on
 * review debt, fatigue, accuracy, and exam proximity.
 *
 * @see lib/services/dailyLoadRecommendationService.ts — Pure computation
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import type { CloudflareEnv } from '../_shared/types';
import {
  recommendDailyLoad,
  computeSystemPriority,
  type LearnerLoadProfile,
} from '../../../lib/services/dailyLoadRecommendationService';

const EmptySchema = z.object({});

type Env = CloudflareEnv;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof EmptySchema>;
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Resolve Clerk id to internal User.id — all user-owned tables use the internal id.
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return Response.json(
        { error: 'User not found', meta: { status: 'user_not_synced' } },
        { status: 404 }
      );
    }

    // Parallel data fetching
    const [phenotype, dueReviewCount, recentAttempts, examGoal] = await Promise.all([
      prisma.userStudyPhenotype.findUnique({
        where: { userId },
        select: {
          avgDailyQuestions: true,
          currentStreak: true,
          burnoutRisk: true,
        },
      }),
      prisma.userProgress.count({
        where: { userId, nextReviewAt: { lte: new Date() } },
      }),
      prisma.questionAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { wasCorrect: true },
      }),
      prisma.userGoal.findFirst({
        where: { userId, goalType: 'EXAM_DATE' },
        select: { targetDate: true },
      }),
    ]);

    // Compute recent accuracy
    const correctCount = recentAttempts.filter((a) => a.wasCorrect).length;
    const recentAccuracy = recentAttempts.length > 0
      ? correctCount / recentAttempts.length
      : 0.7; // optimistic default

    // Days until exam
    let daysUntilExam: number | null = null;
    if (examGoal?.targetDate) {
      const diff = new Date(examGoal.targetDate).getTime() - Date.now();
      daysUntilExam = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const profile: LearnerLoadProfile = {
      historicalDailyAvg: phenotype?.avgDailyQuestions ?? 20,
      recentAccuracy,
      currentStreak: phenotype?.currentStreak ?? 0,
      burnoutRiskScore: phenotype?.burnoutRisk ?? 0,
      dueReviewCount,
      daysUntilExam,
      blueprintGapSystems: [],
    };

    const recommendation = recommendDailyLoad(profile);
    const systemPriority = computeSystemPriority(profile);

    return Response.json({
      recommendation,
      systemPriority,
      profile: {
        dueReviews: dueReviewCount,
        streak: phenotype?.currentStreak ?? 0,
        accuracy: Math.round(recentAccuracy * 100),
        daysUntilExam,
      },
    });
  } catch (error) {
    console.error('Error computing daily load:', error);
    return Response.json(
      { error: 'Failed to compute daily load recommendation' },
      { status: 500 }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
