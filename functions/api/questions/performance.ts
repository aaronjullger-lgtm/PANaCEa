/**
 * Question Performance Analytics API
 * GET /api/questions/performance
 * Returns question-level performance metrics for content quality analysis
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;

  try {
    // Verify auth (optional - could be admin only)
    const authResult = await verifyAuthToken(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ 
        success: true, 
        data: { questions: [], summary: {} }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sortBy = url.searchParams.get('sortBy') || 'accuracy'; // accuracy, attempts, flags
    const order = url.searchParams.get('order') || 'asc'; // asc for worst first

    const prisma = createEdgePrismaClient(env);

    try {
      // Get question attempt statistics grouped by questionId
      const questionStats = await prisma.questionAttempt.groupBy({
        by: ['questionId'],
        _count: {
          id: true,
        },
        _sum: {
          wasCorrect: false, // Doesn't work this way, we need a different approach
        },
        _avg: {
          timeSpentMs: true,
        },
      });

      // Get per-question accuracy (we need to do this differently)
      const rawStats = await prisma.$queryRaw`
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
      ` as Array<{
        questionId: string;
        totalAttempts: bigint;
        correctAttempts: bigint;
        avgTimeMs: number | null;
        accuracy: number;
      }>;

      // Get flag counts for these questions
      const questionIds = rawStats.map(s => s.questionId);
      
      const flagCounts = await prisma.questionFlag.groupBy({
        by: ['questionId'],
        where: {
          questionId: { in: questionIds }
        },
        _count: {
          id: true
        }
      });

      const flagCountMap = new Map<string, number>(
        flagCounts.map(f => [f.questionId, f._count.id])
      );

      // Get question details for context
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          questionText: true,
          system: true,
          conditionId: true,
        }
      });

      type QuestionData = typeof questions[number];
      const questionMap = new Map<string, QuestionData>(questions.map(q => [q.id, q]));

      // Combine all data
      const performanceData = rawStats.map(stat => {
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
          qualityScore: calculateQualityScore(
            Number(stat.accuracy),
            flagCount,
            Number(stat.totalAttempts)
          ),
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
        avgAccuracy: performanceData.length > 0 
          ? Math.round(performanceData.reduce((sum, q) => sum + q.accuracy, 0) / performanceData.length * 10) / 10
          : 0,
        lowAccuracyCount: performanceData.filter(q => q.accuracy < 50).length,
        highFlagCount: performanceData.filter(q => q.flagCount >= 3).length,
        needsReviewCount: performanceData.filter(q => q.qualityScore < 50).length,
      };

      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          questions: performanceData,
          summary
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } finally {
      await prisma.$disconnect();
    }

  } catch (error) {
    console.error('Failed to get question performance:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to get question performance' 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

/**
 * Calculate a quality score (0-100) for a question
 * Lower score = needs more review
 */
function calculateQualityScore(
  accuracy: number,
  flagCount: number,
  totalAttempts: number
): number {
  // Start with accuracy as base
  let score = accuracy;
  
  // Penalize for flags (each flag reduces score by 10, max 30 penalty)
  const flagPenalty = Math.min(flagCount * 10, 30);
  score -= flagPenalty;
  
  // Boost confidence for more attempts (up to +10 for 50+ attempts)
  const confidenceBoost = Math.min(totalAttempts / 5, 10);
  score += confidenceBoost;
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}
