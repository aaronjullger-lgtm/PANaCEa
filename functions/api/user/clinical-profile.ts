import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

/**
 * GET /api/user/clinical-profile
 * Retrieve comprehensive clinical profile with computed metrics
 */
export const onRequestGet = authenticatedEndpoint(z.object({}), async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/clinical-profile');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Fetch user statistics
    const stats = await prisma.userStatistics.findUnique({
      where: { userId: user.id },
    });

    if (!stats) {
      return {
        data: {
          overall: {
            accuracy: 0,
            totalQuestions: 0,
            avgTime: null,
          },
          systemBreakdown: [],
          strengths: [],
          weaknesses: [],
          patterns: {
            rushedSystems: [],
            overthinkingSystems: [],
          },
          diagnosisBias: [],
          studyPatterns: {
            peakHours: [],
            avgSessionLength: null,
          },
        },
      };
    }

    // Calculate overall metrics
    const overall = {
      accuracy: stats.totalQuestions > 0 ? stats.correctAnswers / stats.totalQuestions : 0,
      totalQuestions: stats.totalQuestions,
      avgTime: stats.avgTimePerQuestion,
    };

    // Parse system breakdown
    const systemStatsData = (stats.systemStats as any) || {};
    const systemBreakdown = Object.entries(systemStatsData).map(
      ([system, data]: [string, any]) => ({
        system,
        accuracy: data.accuracy || 0,
        total: data.total || 0,
        correct: data.correct || 0,
        avgTimeMs: data.avgTimeMs || null,
      })
    );

    // Parse diagnosis bias
    const diagnosisBiasData = (stats.diagnosisBias as any) || {};
    const diagnosisBias = Object.entries(diagnosisBiasData)
      .map(([condition, count]) => ({
        condition,
        count: count as number,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 overselected conditions

    // Prepare response
    const profile = {
      overall,
      systemBreakdown,
      strengths: stats.strongestSystems || [],
      weaknesses: stats.weakestSystems || [],
      patterns: {
        rushedSystems: stats.rushedSystems || [],
        overthinkingSystems: stats.overthinkingSystems || [],
      },
      diagnosisBias,
      studyPatterns: {
        peakHours: stats.peakStudyHours || [],
        avgSessionLength: stats.avgSessionLength,
      },
    };

    logger.info('Clinical profile retrieved', {
      userId: user.id,
      totalQuestions: stats.totalQuestions,
      accuracy: overall.accuracy,
    });

    return { data: profile };
  } catch (error) {
    logger.error('Failed to retrieve clinical profile', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to retrieve clinical profile' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
