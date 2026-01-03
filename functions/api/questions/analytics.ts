/**
 * Question Analytics API
 * 
 * Comprehensive analytics for questions:
 * - Question performance statistics
 * - Difficulty analysis
 * - System/condition coverage
 * - Flag/issue tracking
 * - Generation quality metrics
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface PagesContext {
  request: Request;
  env: Env;
}

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

interface QualityMetrics {
  flaggedCount: number;
  resolvedCount: number;
  avgResolutionTimeHours: number;
  topFlagReasons: Array<{ reason: string; count: number }>;
  questionsWithIssues: number;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Get question analytics
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Auth is optional for basic stats, required for detailed analytics
    const auth = await authenticateRequest(context.request, context.env);
    
    const url = new URL(context.request.url);
    const view = url.searchParams.get('view') || 'overview'; // overview, system, pool, quality
    const system = url.searchParams.get('system');
    const detailed = url.searchParams.get('detailed') === 'true';

    if (detailed && !auth) {
      return createErrorResponse('Authentication required for detailed analytics', 401);
    }

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
        const questionId = url.searchParams.get('questionId');
        if (!questionId) {
          return createErrorResponse('questionId required', 400);
        }
        response = await getQuestionDetails(prisma, questionId);
        break;
      default:
        return createErrorResponse('Invalid view parameter', 400);
    }

    return createSuccessResponse({
      view,
      timestamp: new Date().toISOString(),
      ...response,
    });
  } catch (error) {
    console.error('[QuestionAnalytics] Error:', error);
    return createErrorResponse('Failed to fetch analytics', 500);
  } finally {
    await prisma.$disconnect();
  }
}

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
  // Get question counts by system
  const questionsBySystem = await prisma.question.groupBy({
    by: ['system'],
    _count: { id: true },
  });

  // Get attempt stats by system
  const attemptsBySystem = await prisma.questionAttempt.groupBy({
    by: ['system'],
    _count: { id: true },
    _sum: { wasCorrect: false }, // Will need to calculate differently
  });

  // Get correct counts separately
  const correctBySystem = await prisma.questionAttempt.groupBy({
    by: ['system'],
    where: { wasCorrect: true },
    _count: { id: true },
  });

  const correctMap = new Map<string | null, number>(
    correctBySystem.map(c => [c.system, c._count.id])
  );
  const attemptsMap = new Map<string | null, number>(
    attemptsBySystem.map(a => [a.system, a._count.id])
  );

  const systems: SystemStats[] = questionsBySystem.map(qs => {
    const system = qs.system;
    const questionCount = qs._count.id;
    const totalAttempts: number = attemptsMap.get(system) || 0;
    const correctAttempts: number = correctMap.get(system) || 0;
    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

    // Coverage score: ratio of questions with attempts
    // Would need a more complex query for this - simplifying for now
    const coverageScore = totalAttempts > 0 ? Math.min(100, (totalAttempts / questionCount) * 10) : 0;

    return {
      system,
      questionCount,
      totalAttempts,
      correctAttempts,
      accuracy: Math.round(accuracy * 100) / 100,
      avgDifficulty: 0.5, // Placeholder - would need actual difficulty data
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

  const [
    totalPregen,
    usedPregen,
    last24h,
    last7d,
    last30d,
    bySystem,
  ] = await Promise.all([
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

  // Get used counts by system
  const usedBySystem = await prisma.preGeneratedQuestion.groupBy({
    by: ['system'],
    where: { usedAt: { not: null } },
    _count: { id: true },
  });

  const usedMap = new Map<string, number>(
    usedBySystem.map(u => [u.system, u._count.id])
  );

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
  const [
    totalFlags,
    resolvedFlags,
    pendingFlags,
    flagsByType,
  ] = await Promise.all([
    prisma.questionFlag.count(),
    prisma.questionFlag.count({ where: { status: 'resolved' } }),
    prisma.questionFlag.count({ where: { status: 'pending' } }),
    prisma.questionFlag.groupBy({
      by: ['flagType'],
      _count: { id: true },
    }),
  ]);

  const topReasons = flagsByType
    .map(f => ({ reason: f.flagType, count: f._count.id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get unique questions with flags
  const uniqueFlagged = await prisma.questionFlag.findMany({
    distinct: ['questionId'],
    select: { questionId: true },
  });

  return {
    quality: {
      totalFlags,
      resolvedFlags,
      pendingFlags,
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
    prisma.question.findUnique({
      where: { id: questionId },
    }),
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
  const correctAttempts = attempts.filter(a => a.wasCorrect).length;
  const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

  // Calculate time stats
  const timesMs = attempts.filter(a => a.timeSpentMs).map(a => a.timeSpentMs!);
  const avgTimeMs = timesMs.length > 0 ? timesMs.reduce((a, b) => a + b, 0) / timesMs.length : 0;

  // Determine difficulty based on accuracy
  let difficultyRating: 'easy' | 'medium' | 'hard' = 'medium';
  if (accuracy >= 80) difficultyRating = 'easy';
  else if (accuracy < 50) difficultyRating = 'hard';

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
      pending: flags.filter(f => f.status === 'pending').length,
      resolved: flags.filter(f => f.status === 'resolved').length,
      types: [...new Set(flags.map(f => f.flagType))],
    },
    recentAttempts: attempts.slice(0, 10).map(a => ({
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
  // Get questions with their attempt stats
  const attempts = await prisma.questionAttempt.groupBy({
    by: ['questionId'],
    where: system ? { system } : undefined,
    _count: { id: true },
    _sum: { wasCorrect: false }, // Will calculate separately
  });

  // Get correct counts
  const correctCounts = await prisma.questionAttempt.groupBy({
    by: ['questionId'],
    where: {
      ...(system ? { system } : {}),
      wasCorrect: true,
    },
    _count: { id: true },
  });

  const correctMap = new Map<string, number>(
    correctCounts.map(c => [c.questionId, c._count.id])
  );

  // Calculate accuracy for each question
  const stats = attempts
    .filter(a => a._count.id >= 5) // Minimum 5 attempts for meaningful data
    .map(a => {
      const totalAttempts = a._count.id;
      const correctAttempts: number = correctMap.get(a.questionId) || 0;
      const accuracy = (correctAttempts / totalAttempts) * 100;

      let difficultyRating: 'easy' | 'medium' | 'hard' = 'medium';
      if (accuracy >= 80) difficultyRating = 'easy';
      else if (accuracy < 50) difficultyRating = 'hard';

      return {
        questionId: a.questionId,
        totalAttempts,
        correctAttempts,
        accuracy: Math.round(accuracy * 100) / 100,
        avgTimeMs: 0, // Would need additional query
        flagCount: 0, // Would need additional query
        difficultyRating,
      };
    });

  // Sort by accuracy
  if (type === 'best') {
    return stats.sort((a, b) => b.accuracy - a.accuracy).slice(0, limit);
  } else {
    return stats.sort((a, b) => a.accuracy - b.accuracy).slice(0, limit);
  }
}
