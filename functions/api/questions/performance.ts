/**
 * Question Performance Analytics API
 * GET /api/questions/performance
 * Returns question-level performance metrics for content quality analysis
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const PerformanceSchema = z.object({
  query: z.object({
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    order: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(PerformanceSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/performance');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const limit = parseInt(validated.query?.limit || '50');
    const sortBy = validated.query?.sortBy || 'accuracy';
    const order = validated.query?.order || 'asc';

    // Get per-question accuracy with raw SQL
    const rawStats = (await prisma.$queryRaw`
      SELECT 
        "questionId",
        COUNT(*) as "totalAttempts",
        SUM(CASE WHEN "wasCorrect" = true THEN 1 ELSE 0 END) as "correctAttempts",
        AVG("timeSpentMs") as "avgTimeMs",
        ROUND(
          (SUM(CASE WHEN "wasCorrect" = true THEN 1 ELSE 0 END)::decimal / COUNT(*)) * 100, 
          1
        ) as "accuracy"
      FROM "QuestionAttempt"
      GROUP BY "questionId"
      HAVING COUNT(*) >= 5
      ORDER BY 
        CASE WHEN ${sortBy} = 'accuracy' THEN 
          (SUM(CASE WHEN "wasCorrect" = true THEN 1 ELSE 0 END)::decimal / COUNT(*))
        END ${order === 'asc' ? 'ASC' : 'DESC'},
        CASE WHEN ${sortBy} = 'attempts' THEN COUNT(*) END ${order === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ${limit}
    `) as Array<{
      questionId: string;
      totalAttempts: bigint;
      correctAttempts: bigint;
      avgTimeMs: number | null;
      accuracy: number;
    }>;

    const questionIds = rawStats.map((s) => s.questionId);

    // Get flag counts
    const flagCounts = await prisma.questionFlag.groupBy({
      by: ['questionId'],
      where: { questionId: { in: questionIds } },
      _count: { id: true },
    });

    const flagCountMap = new Map<string, number>(flagCounts.map((f) => [f.questionId, f._count.id]));

    // Get question details
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, questionText: true, system: true, conditionId: true },
    });

    type QuestionData = (typeof questions)[number];
    const questionMap = new Map<string, QuestionData>(questions.map((q) => [q.id, q]));

    // Combine all data
    const performanceData = rawStats.map((stat) => {
      const question = questionMap.get(stat.questionId);
      const flagCount = flagCountMap.get(stat.questionId) || 0;
      return {
        questionId: stat.questionId,
        questionText: question?.questionText?.slice(0, 100) + '...' || 'Unknown',
        system: question?.system || 'Unknown',
        conditionId: question?.conditionId || null,
        totalAttempts: Number(stat.totalAttempts),
        correctAttempts: Number(stat.correctAttempts),
        accuracy: Number(stat.accuracy),
        avgTimeMs: stat.avgTimeMs ? Math.round(Number(stat.avgTimeMs)) : null,
        flagCount,
        qualityScore: calculateQualityScore(Number(stat.accuracy), flagCount, Number(stat.totalAttempts)),
      };
    });

    // Sort by quality score if requested
    if (sortBy === 'quality') {
      performanceData.sort((a, b) =>
        order === 'asc' ? a.qualityScore - b.qualityScore : b.qualityScore - a.qualityScore
      );
    }

    // Calculate summary statistics
    const summary = {
      totalQuestionsAnalyzed: performanceData.length,
      avgAccuracy:
        performanceData.length > 0
          ? Math.round((performanceData.reduce((sum, q) => sum + q.accuracy, 0) / performanceData.length) * 10) / 10
          : 0,
      lowAccuracyCount: performanceData.filter((q) => q.accuracy < 50).length,
      highFlagCount: performanceData.filter((q) => q.flagCount >= 3).length,
      needsReviewCount: performanceData.filter((q) => q.qualityScore < 50).length,
    };

    logger.info('Question performance fetched', { userId: auth.userId, questionsAnalyzed: performanceData.length });

    return { data: { success: true, data: { questions: performanceData, summary } } };
  } catch (error) {
    logger.error('Failed to get question performance', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to get question performance');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/**
 * Calculate a quality score (0-100) for a question
 */
function calculateQualityScore(accuracy: number, flagCount: number, totalAttempts: number): number {
  let score = accuracy;
  const flagPenalty = Math.min(flagCount * 10, 30);
  score -= flagPenalty;
  const confidenceBoost = Math.min(totalAttempts / 5, 10);
  score += confidenceBoost;
  return Math.max(0, Math.min(100, Math.round(score)));
}
