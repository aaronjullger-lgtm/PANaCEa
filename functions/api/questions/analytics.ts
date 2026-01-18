/**
 * Question Analytics API
 * GET: Comprehensive analytics for questions (performance, difficulty, coverage, quality)
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const AnalyticsGetSchema = z.object({
  query: z.object({
    view: z.string().optional(),
    system: z.string().optional(),
    detailed: z.string().optional(),
    questionId: z.string().optional(),
  }),
});

interface QuestionStats {
  questionId: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  avgTimeMs: number;
  flagCount: number;
  lastAttempt?: Date;
  difficultyRating: 'easy' | 'medium' | 'hard';
}

interface SystemStats {
  system: string;
  questionCount: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  avgDifficulty: number;
  coverageScore: number;
}

interface PoolStats {
  totalQuestions: number;
  usedQuestions: number;
  unusedQuestions: number;
  bySystem: Record<string, { total: number; used: number; unused: number }>;
  generationRate: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(AnalyticsGetSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/analytics');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const view = validated.query?.view || 'overview';
    const system = validated.query?.system || null;
    const detailed = validated.query?.detailed === 'true';
    const questionId = validated.query?.questionId || null;

    let response: Record<string, unknown> = {};

    switch (view) {
      case 'overview':
        response = await getOverviewStats(prisma, system);
        break;
      case 'system':
        response = await getSystemBreakdown(prisma);
        break;
      case 'pool':
        response = await getPoolStats(prisma);
        break;
      case 'quality':
        response = await getQualityMetrics(prisma);
        break;
      case 'question':
        if (!questionId) {
          return { data: { error: 'questionId required' }, status: 400 };
        }
        response = await getQuestionDetails(prisma, questionId);
        break;
      default:
        return { data: { error: 'Invalid view parameter' }, status: 400 };
    }

    logger.info('Question analytics fetched', { userId: auth.userId, view, system });

    return {
      data: {
        view,
        timestamp: new Date().toISOString(),
        ...response,
      },
    };
  } catch (error) {
    logger.error('Error fetching question analytics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch analytics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

// Analytics Helper Functions
async function getOverviewStats(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  system: string | null
): Promise<Record<string, unknown>> {
  const where = system ? { system } : {};

  const [
    totalQuestions,
    totalAttempts,
    correctAttempts,
    recentQuestions,
    topPerformers,
    worstPerformers,
  ] = await Promise.all([
    prisma.question.count({ where }),
    prisma.questionAttempt.count({ where: system ? { system } : undefined }),
    prisma.questionAttempt.count({ where: { ...where, wasCorrect: true } }),
    prisma.question.count({
      where: {
        ...where,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    getTopQuestions(prisma, system, 'best', 5),
    getTopQuestions(prisma, system, 'worst', 5),
  ]);

  const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

  return {
    overview: {
      totalQuestions,
      totalAttempts,
      correctAttempts,
      accuracy: Math.round(accuracy * 100) / 100,
      recentQuestions24h: recentQuestions,
    },
    topPerformers,
    worstPerformers,
  };
}

async function getSystemBreakdown(
  prisma: ReturnType<typeof createEdgePrismaClient>
): Promise<Record<string, unknown>> {
  const questionsBySystem = await prisma.question.groupBy({
    by: ['system'],
    _count: { id: true },
  });

  const attemptsBySystem = await prisma.questionAttempt.groupBy({
    by: ['system'],
    _count: { id: true },
  });

  const correctBySystem = await prisma.questionAttempt.groupBy({
    by: ['system'],
    where: { wasCorrect: true },
    _count: { id: true },
  });

  const correctMap = new Map<string | null, number>(
    correctBySystem.map((c) => [c.system, c._count.id])
  );
  const attemptsMap = new Map<string | null, number>(
    attemptsBySystem.map((a) => [a.system, a._count.id])
  );

  const systems: SystemStats[] = questionsBySystem.map((qs) => {
    const system = qs.system;
    const questionCount = qs._count.id;
    const totalAttempts: number = attemptsMap.get(system) || 0;
    const correctAttempts: number = correctMap.get(system) || 0;
    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
    const coverageScore = totalAttempts > 0 ? Math.min(100, (totalAttempts / questionCount) * 10) : 0;

    return {
      system,
      questionCount,
      totalAttempts,
      correctAttempts,
      accuracy: Math.round(accuracy * 100) / 100,
      avgDifficulty: 0.5,
      coverageScore: Math.round(coverageScore * 100) / 100,
    };
  });

  return {
    systems: systems.sort((a, b) => b.questionCount - a.questionCount),
    totalSystems: systems.length,
  };
}

async function getPoolStats(
  prisma: ReturnType<typeof createEdgePrismaClient>
): Promise<Record<string, unknown>> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalPregen, usedPregen, last24h, last7d, last30d, bySystem] = await Promise.all([
    prisma.preGeneratedQuestion.count(),
    prisma.preGeneratedQuestion.count({ where: { usedAt: { not: null } } }),
    prisma.preGeneratedQuestion.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.preGeneratedQuestion.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.preGeneratedQuestion.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.preGeneratedQuestion.groupBy({
      by: ['system'],
      _count: { id: true },
    }),
  ]);

  const usedBySystem = await prisma.preGeneratedQuestion.groupBy({
    by: ['system'],
    where: { usedAt: { not: null } },
    _count: { id: true },
  });

  const usedMap = new Map<string, number>(usedBySystem.map((u) => [u.system, u._count.id]));

  const systemBreakdown: Record<string, { total: number; used: number; unused: number }> = {};
  for (const s of bySystem) {
    const total = s._count.id;
    const used: number = usedMap.get(s.system) || 0;
    systemBreakdown[s.system] = {
      total,
      used,
      unused: total - used,
    };
  }

  return {
    pool: {
      totalQuestions: totalPregen,
      usedQuestions: usedPregen,
      unusedQuestions: totalPregen - usedPregen,
      utilizationRate: totalPregen > 0 ? Math.round((usedPregen / totalPregen) * 100) : 0,
    },
    bySystem: systemBreakdown,
    generationRate: {
      last24h,
      last7d,
      last30d,
    },
    averageDaily7d: Math.round(last7d / 7),
  };
}

async function getQualityMetrics(
  prisma: ReturnType<typeof createEdgePrismaClient>
): Promise<Record<string, unknown>> {
  const [totalFlags, resolvedFlags, flagsByType] = await Promise.all([
    prisma.questionFlag.count(),
    prisma.questionFlag.count({ where: { status: 'resolved' } }),
    prisma.questionFlag.groupBy({
      by: ['flagType'],
      _count: { id: true },
    }),
  ]);

  const topReasons = flagsByType
    .map((f) => ({ reason: f.flagType, count: f._count.id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const uniqueFlagged = await prisma.questionFlag.findMany({
    distinct: ['questionId'],
    select: { questionId: true },
  });

  return {
    quality: {
      totalFlags,
      resolvedFlags,
      resolutionRate: totalFlags > 0 ? Math.round((resolvedFlags / totalFlags) * 100) : 100,
      uniqueQuestionsWithIssues: uniqueFlagged.length,
    },
    topFlagReasons: topReasons,
    flagsByPriority: {
      high: await prisma.questionFlag.count({ where: { priority: 'high' } }),
      medium: await prisma.questionFlag.count({ where: { priority: 'medium' } }),
      low: await prisma.questionFlag.count({ where: { priority: 'low' } }),
    },
  };
}

async function getQuestionDetails(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  questionId: string
): Promise<Record<string, unknown>> {
  const [question, attempts, flags] = await Promise.all([
    prisma.question.findUnique({ where: { id: questionId } }),
    prisma.questionAttempt.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.questionFlag.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!question) {
    return { error: 'Question not found' };
  }

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.wasCorrect).length;
  const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
  const timesMs = attempts.filter((a) => a.timeSpentMs).map((a) => a.timeSpentMs!);
  const avgTimeMs = timesMs.length > 0 ? timesMs.reduce((a, b) => a + b, 0) / timesMs.length : 0;
  const difficultyRating: 'easy' | 'medium' | 'hard' = accuracy >= 80 ? 'easy' : accuracy < 50 ? 'hard' : 'medium';

  return {
    question: {
      id: question.id,
      system: question.system,
      condition: question.condition,
      difficulty: question.difficulty,
      createdAt: question.createdAt,
    },
    stats: {
      totalAttempts,
      correctAttempts,
      accuracy: Math.round(accuracy * 100) / 100,
      avgTimeMs: Math.round(avgTimeMs),
      difficultyRating,
    },
    flags: {
      count: flags.length,
      pending: flags.filter((f) => f.status === 'pending').length,
      resolved: flags.filter((f) => f.status === 'resolved').length,
      types: [...new Set(flags.map((f) => f.flagType))],
    },
    recentAttempts: attempts.slice(0, 10).map((a) => ({
      wasCorrect: a.wasCorrect,
      timeSpentMs: a.timeSpentMs,
      createdAt: a.createdAt,
    })),
  };
}

async function getTopQuestions(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  system: string | null,
  type: 'best' | 'worst',
  limit: number
): Promise<QuestionStats[]> {
  const attempts = await prisma.questionAttempt.groupBy({
    by: ['questionId'],
    where: system ? { system } : undefined,
    _count: { id: true },
  });

  const correctCounts = await prisma.questionAttempt.groupBy({
    by: ['questionId'],
    where: { ...(system ? { system } : {}), wasCorrect: true },
    _count: { id: true },
  });

  const correctMap = new Map<string, number>(correctCounts.map((c) => [c.questionId, c._count.id]));

  const stats = attempts
    .filter((a) => a._count.id >= 5)
    .map((a) => {
      const totalAttempts = a._count.id;
      const correctAttempts: number = correctMap.get(a.questionId) || 0;
      const accuracy = (correctAttempts / totalAttempts) * 100;
      const difficultyRating: 'easy' | 'medium' | 'hard' = accuracy >= 80 ? 'easy' : accuracy < 50 ? 'hard' : 'medium';

      return {
        questionId: a.questionId,
        totalAttempts,
        correctAttempts,
        accuracy: Math.round(accuracy * 100) / 100,
        avgTimeMs: 0,
        flagCount: 0,
        difficultyRating,
      };
    });

  return type === 'best'
    ? stats.sort((a, b) => b.accuracy - a.accuracy).slice(0, limit)
    : stats.sort((a, b) => a.accuracy - b.accuracy).slice(0, limit);
}
