/**
 * Question Quality Analytics API
 *
 * Provides aggregated quality metrics for questions:
 * - Quality score distribution
 * - Validation status breakdown
 * - System coverage gaps
 * - Flag rate tracking
 *
 * Security: Admin-only endpoint with enterprise middleware
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { adminEndpoint } from '../_shared/middleware';
import { questionQualityQuerySchema } from '../_shared/zodSchemas';

export const onRequestGet = adminEndpoint(
  questionQualityQuerySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const params = context.validated;

      // Build where clause
      const where: any = {};
      if (params.system) where.system = params.system;
      if (params.validationStatus) where.validationStatus = params.validationStatus;

      // Get questions with quality data
      const questions = await prisma.preGeneratedQuestion.findMany({
        where,
        select: {
          id: true,
          system: true,
          difficulty: true,
          questionType: true,
          qualityScore: true,
          conditionAccuracy: true,
          contentRelevance: true,
          distracorQuality: true,
          validationStatus: true,
          timesServed: true,
          timesCorrect: true,
          timesIncorrect: true,
          flagCount: true,
          flagRate: true,
          generatedAt: true,
        },
        orderBy: { generatedAt: 'desc' },
        take: params.limit,
      });

      // Calculate aggregated stats
      const totalCount = await prisma.preGeneratedQuestion.count({ where });

      // Validation status breakdown
      const statusBreakdown = await prisma.preGeneratedQuestion.groupBy({
        by: ['validationStatus'],
        _count: true,
        where,
      });

      // System coverage
      const systemCoverage = await prisma.preGeneratedQuestion.groupBy({
        by: ['system'],
        _count: true,
        _avg: {
          qualityScore: true,
          flagRate: true,
        },
        where: { validationStatus: 'approved' },
      });

      // Quality score distribution
      const qualityDistribution = {
        excellent: 0, // 80-100
        good: 0, // 60-79
        fair: 0, // 40-59
        poor: 0, // 0-39
      };

      questions.forEach((q) => {
        const score = q.qualityScore ?? 0;
        if (score >= 80) qualityDistribution.excellent++;
        else if (score >= 60) qualityDistribution.good++;
        else if (score >= 40) qualityDistribution.fair++;
        else qualityDistribution.poor++;
      });

      // Top flagged questions
      const topFlagged = await prisma.preGeneratedQuestion.findMany({
        where: { flagCount: { gt: 0 }, ...where },
        select: {
          id: true,
          system: true,
          questionType: true,
          flagCount: true,
          flagRate: true,
          qualityScore: true,
          validationStatus: true,
        },
        orderBy: { flagCount: 'desc' },
        take: 10,
      });

      // Recently validated
      const recentlyValidated = await prisma.preGeneratedQuestion.findMany({
        where: { validatedAt: { not: null }, ...where },
        select: {
          id: true,
          system: true,
          validationStatus: true,
          validatedAt: true,
          validatedBy: true,
          qualityScore: true,
        },
        orderBy: { validatedAt: 'desc' },
        take: 10,
      });

      // Calculate overall stats
      const avgQualityScore =
        questions.reduce((sum, q) => sum + (q.qualityScore ?? 0), 0) / questions.length || 0;
      const avgFlagRate =
        questions.reduce((sum, q) => sum + (q.flagRate ?? 0), 0) / questions.length || 0;
      const totalServed = questions.reduce((sum, q) => sum + q.timesServed, 0);
      const totalCorrect = questions.reduce((sum, q) => sum + q.timesCorrect, 0);
      const overallAccuracy =
        totalServed > 0
          ? totalCorrect / (totalCorrect + questions.reduce((sum, q) => sum + q.timesIncorrect, 0))
          : 0;

      return {
        status: 200,
        data: {
          overview: {
            totalQuestions: totalCount,
            avgQualityScore: Math.round(avgQualityScore * 10) / 10,
            avgFlagRate: Math.round(avgFlagRate * 1000) / 1000,
            totalServed,
            overallAccuracy: Math.round(overallAccuracy * 1000) / 10,
          },
          statusBreakdown: statusBreakdown.map((s) => ({
            status: s.validationStatus,
            count: s._count,
          })),
          qualityDistribution,
          systemCoverage: systemCoverage.map((s) => ({
            system: s.system || 'Unknown',
            count: s._count,
            avgQualityScore: s._avg.qualityScore ? Math.round(s._avg.qualityScore * 10) / 10 : null,
            avgFlagRate: s._avg.flagRate ? Math.round(s._avg.flagRate * 1000) / 1000 : null,
          })),
          topFlagged,
          recentlyValidated,
          questions: questions.slice(0, 20), // Limit detail view
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);